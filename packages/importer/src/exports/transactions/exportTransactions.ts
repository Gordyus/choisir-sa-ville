import path from "node:path";

import { buildAddressKey, buildAddressLabel, deriveAddressId } from "./addressNormalization.js";
import { parseDvfCsvStreaming } from "./parseDvfCsv.js";
import { BUNDLE_ZOOM, latLngToTile } from "./tileCoords.js";
import type { DvfRawRow, TransactionAddressHistory, TransactionLine } from "./types.js";

import { ensureDir, writeJsonAtomic } from "../shared/fileSystem.js";
import type { ExportContext, DvfSourceMeta } from "../shared/types.js";

type AddressAccumulator = {
    addressKey: string;
    inseeCode: string;
    communeName: string;
    streetNumber: string;
    streetName: string;
    transactions: TransactionLine[];
    latestDate: string;
    latestLat: number;
    latestLng: number;
};

type ExportTransactionsParams = {
    context: ExportContext;
    dvfSources: DvfSourceMeta[];
    communeNameByInsee: Map<string, string>;
};

/**
 * Main export function for DVF transaction data.
 * Parses multiple annual per-department DVF CSVs, groups by address, deduplicates, and exports:
 * - addresses.geojson (point layer for MapLibre)
 * - bundles/z15/{x}/{y}.json (transaction history per tile)
 *
 * Returns the list of relative file paths added.
 */
export async function exportTransactions({ context, dvfSources, communeNameByInsee }: ExportTransactionsParams): Promise<string[]> {
    const transactionsDir = path.join(context.datasetDir, "transactions");
    await ensureDir(transactionsDir);

    const yearRange = dvfSources.length > 0
        ? `${Math.min(...dvfSources.map((s) => s.year))}–${Math.max(...dvfSources.map((s) => s.year))}`
        : "none";
    console.info(`[transactions] Parsing ${dvfSources.length} DVF files (${yearRange})...`);

    // Phase 1: Parse all source files and accumulate by address
    const addressMap = new Map<string, AddressAccumulator>();
    let totalProcessed = 0;
    let totalAccepted = 0;

    for (const source of dvfSources) {
        console.info(`[transactions]   Parsing DVF ${source.year} dept ${source.department}...`);

        const { processed, accepted } = await parseDvfCsvStreaming(source.filePath, {
            onRow: (row: DvfRawRow) => {
                const addressKey = buildAddressKey(row.inseeCode, row.streetNumber, row.streetName);
                let accumulator = addressMap.get(addressKey);

                if (!accumulator) {
                    accumulator = {
                        addressKey,
                        inseeCode: row.inseeCode,
                        communeName: communeNameByInsee.get(row.inseeCode) ?? row.inseeCode,
                        streetNumber: row.streetNumber,
                        streetName: row.streetName,
                        transactions: [],
                        latestDate: row.date,
                        latestLat: row.lat,
                        latestLng: row.lng
                    };
                    addressMap.set(addressKey, accumulator);
                }

                accumulator.transactions.push({
                    date: row.date,
                    priceEur: row.priceEur,
                    typeLocal: row.typeLocal,
                    surfaceM2: row.surfaceM2,
                    isVefa: row.isVefa
                });

                if (row.date > accumulator.latestDate) {
                    accumulator.latestDate = row.date;
                    accumulator.latestLat = row.lat;
                    accumulator.latestLng = row.lng;
                }
            },
            onProgress: (p, a) => {
                if (p % 500_000 === 0) {
                    console.info(`[transactions]     ${p.toLocaleString()} processed, ${a.toLocaleString()} accepted`);
                }
            }
        });

        console.info(`[transactions]   ✓ DVF ${source.year} dept ${source.department}: ${processed.toLocaleString()} processed, ${accepted.toLocaleString()} accepted`);
        totalProcessed += processed;
        totalAccepted += accepted;
    }

    console.info(
        `[transactions] All files parsed: ${totalProcessed.toLocaleString()} total, ${totalAccepted.toLocaleString()} accepted, ${addressMap.size.toLocaleString()} unique addresses`
    );

    // Phase 2: Deduplicate transactions per address
    console.info("[transactions] Deduplicating transactions...");
    let totalBefore = 0;
    let totalAfter = 0;

    for (const accumulator of addressMap.values()) {
        totalBefore += accumulator.transactions.length;

        const uniqueMap = new Map<string, TransactionLine>();
        for (const tx of accumulator.transactions) {
            const key = `${tx.date}|${tx.priceEur}|${tx.typeLocal}|${tx.surfaceM2 ?? "null"}`;
            if (!uniqueMap.has(key)) {
                uniqueMap.set(key, tx);
            }
        }

        accumulator.transactions = Array.from(uniqueMap.values()).sort((a, b) => b.date.localeCompare(a.date));
        totalAfter += accumulator.transactions.length;
    }

    console.info(
        `[transactions] Dedup: ${totalBefore.toLocaleString()} → ${totalAfter.toLocaleString()} (${(totalBefore - totalAfter).toLocaleString()} duplicates removed)`
    );

    // Phase 3: Build GeoJSON features and partition into bundles
    console.info("[transactions] Generating GeoJSON and bundles...");
    const geojsonFeatures: GeoJsonFeature[] = [];
    const bundleMap = new Map<string, Map<string, TransactionAddressHistory>>();

    for (const acc of addressMap.values()) {
        const addressId = deriveAddressId(acc.addressKey);
        const tile = latLngToTile(acc.latestLat, acc.latestLng, BUNDLE_ZOOM);
        const bundleKey = `${tile.z}/${tile.x}/${tile.y}`;

        const history: TransactionAddressHistory = {
            id: addressId,
            label: buildAddressLabel(acc.streetNumber, acc.streetName, acc.communeName),
            lat: acc.latestLat,
            lng: acc.latestLng,
            transactions: acc.transactions
        };

        geojsonFeatures.push({
            type: "Feature",
            id: addressId,
            geometry: {
                type: "Point",
                coordinates: [acc.latestLng, acc.latestLat]
            },
            properties: {
                id: addressId,
                z: tile.z,
                x: tile.x,
                y: tile.y,
                n: acc.transactions.length
            }
        });

        let bundle = bundleMap.get(bundleKey);
        if (!bundle) {
            bundle = new Map();
            bundleMap.set(bundleKey, bundle);
        }
        bundle.set(addressId, history);
    }

    console.info(`[transactions] Generated ${geojsonFeatures.length.toLocaleString()} features, ${bundleMap.size} bundles`);

    // Phase 4: Write GeoJSON
    const geojson: GeoJsonFeatureCollection = {
        type: "FeatureCollection",
        features: geojsonFeatures
    };

    const geojsonPath = path.join(transactionsDir, "addresses.geojson");
    await writeJsonAtomic(geojsonPath, geojson);

    const files: string[] = ["transactions/addresses.geojson"];

    // Phase 5: Write bundles
    const bundlesDir = path.join(transactionsDir, "bundles");
    for (const [bundleKey, addressesMap] of bundleMap) {
        const bundlePath = path.join(bundlesDir, `z${bundleKey}.json`);
        const bundleData: Record<string, TransactionAddressHistory> = Object.fromEntries(addressesMap);
        await writeJsonAtomic(bundlePath, bundleData);
        files.push(`transactions/bundles/z${bundleKey}.json`);
    }

    console.info(`[transactions] ✓ Wrote ${files.length} files (1 GeoJSON + ${bundleMap.size} bundles)`);

    return files;
}

// Minimal GeoJSON types (no external dependency needed)
type GeoJsonFeature = {
    type: "Feature";
    id: string;
    geometry: {
        type: "Point";
        coordinates: [number, number];
    };
    properties: {
        id: string;
        z: number;
        x: number;
        y: number;
        n: number;
    };
};

type GeoJsonFeatureCollection = {
    type: "FeatureCollection";
    features: GeoJsonFeature[];
};
