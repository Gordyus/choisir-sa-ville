import path from "node:path";

import { buildAddressKey, buildAddressLabel, deriveAddressId } from "./addressNormalization.js";
import { parseDvfCsvStreaming } from "./parseDvfCsv.js";
import { BUNDLE_ZOOM, latLngToTile } from "./tileCoords.js";
import type { DvfRawRow, TransactionAddressHistory, TransactionLine } from "./types.js";

import { ensureDir, writeJsonAtomic } from "../shared/fileSystem.js";
import type { ExportContext, SourceMeta } from "../shared/types.js";

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
    dvfSource: SourceMeta;
    communeNameByInsee: Map<string, string>;
};

/**
 * Main export function for DVF transaction data.
 * Parses the DVF CSV, groups by address, and exports:
 * - addresses.geojson (point layer for MapLibre)
 * - bundles/z15/{x}/{y}.json (transaction history per tile)
 *
 * Returns the list of relative file paths added.
 */
export async function exportTransactions({ context, dvfSource, communeNameByInsee }: ExportTransactionsParams): Promise<string[]> {
    const transactionsDir = path.join(context.datasetDir, "transactions");
    await ensureDir(transactionsDir);

    console.info("[transactions] Parsing DVF CSV...");

    // Phase 1: Parse and accumulate by address
    const addressMap = new Map<string, AddressAccumulator>();

    const { processed, accepted } = await parseDvfCsvStreaming(dvfSource.filePath, {
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

            // Update coords to latest transaction
            if (row.date > accumulator.latestDate) {
                accumulator.latestDate = row.date;
                accumulator.latestLat = row.lat;
                accumulator.latestLng = row.lng;
            }
        },
        onProgress: (p, a) => {
            console.info(`[transactions]   processed ${p} rows, accepted ${a}`);
        }
    });

    console.info(`[transactions] Parsed ${processed} rows, accepted ${accepted}, grouped into ${addressMap.size} addresses`);

    // Phase 2: Build GeoJSON features and partition into bundles
    const geojsonFeatures: GeoJsonFeature[] = [];
    const bundleMap = new Map<string, Map<string, TransactionAddressHistory>>();

    for (const acc of addressMap.values()) {
        const addressId = deriveAddressId(acc.addressKey);
        const tile = latLngToTile(acc.latestLat, acc.latestLng, BUNDLE_ZOOM);
        const bundleKey = `${tile.z}/${tile.x}/${tile.y}`;

        // Sort transactions by date descending
        acc.transactions.sort((a, b) => b.date.localeCompare(a.date));

        const history: TransactionAddressHistory = {
            id: addressId,
            label: buildAddressLabel(acc.streetNumber, acc.streetName, acc.communeName),
            lat: acc.latestLat,
            lng: acc.latestLng,
            transactions: acc.transactions
        };

        // GeoJSON feature
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

        // Bundle accumulation
        let bundle = bundleMap.get(bundleKey);
        if (!bundle) {
            bundle = new Map();
            bundleMap.set(bundleKey, bundle);
        }
        bundle.set(addressId, history);
    }

    console.info(`[transactions] Generated ${geojsonFeatures.length} GeoJSON features, ${bundleMap.size} bundles`);

    // Phase 3: Write GeoJSON
    const geojson: GeoJsonFeatureCollection = {
        type: "FeatureCollection",
        features: geojsonFeatures
    };

    const geojsonPath = path.join(transactionsDir, "addresses.geojson");
    await writeJsonAtomic(geojsonPath, geojson);

    const files: string[] = ["transactions/addresses.geojson"];

    // Phase 4: Write bundles
    const bundlesDir = path.join(transactionsDir, "bundles");
    for (const [bundleKey, addressesMap] of bundleMap) {
        const bundlePath = path.join(bundlesDir, `z${bundleKey}.json`);
        const bundleData: Record<string, TransactionAddressHistory> = Object.fromEntries(addressesMap);
        await writeJsonAtomic(bundlePath, bundleData);
        files.push(`transactions/bundles/z${bundleKey}.json`);
    }

    console.info(`[transactions] Wrote ${files.length} files (1 GeoJSON + ${bundleMap.size} bundles)`);

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
