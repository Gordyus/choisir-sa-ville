import path from "node:path";

import { buildAddressKey, buildAddressLabel, deriveAddressId } from "./addressNormalization.js";
import { aggregateByMutation, buildMutationKey } from "./mutationAggregation.js";
import { parseDvfCsvStreaming } from "./parseDvfCsv.js";
import { BUNDLE_ZOOM, latLngToTile } from "./tileCoords.js";
import type { DvfRawRow, TransactionAddressHistory } from "./types.js";

import { ensureDir, writeJsonAtomic } from "../shared/fileSystem.js";
import type { ExportContext, DvfSourceMeta } from "../shared/types.js";

type AddressAccumulator = {
    addressKey: string;
    inseeCode: string;
    communeName: string;
    streetNumber: string;
    streetName: string;
    rawRows: DvfRawRow[]; // Store raw rows for mutation aggregation
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
    const mutationToAddresses = new Map<string, Set<string>>(); // Track all addresses per mutation
    let totalProcessed = 0;
    let totalAccepted = 0;
    let totalMissingIdMutation = 0;

    for (const source of dvfSources) {
        console.info(`[transactions]   Parsing DVF ${source.year} dept ${source.department}...`);

        const { processed, accepted, missingIdMutationCount } = await parseDvfCsvStreaming(source.filePath, {
            onRow: (row: DvfRawRow) => {
                const addressKey = buildAddressKey(row.inseeCode, row.streetNumber, row.streetName);
                let accumulator = addressMap.get(addressKey);

                const communeName = communeNameByInsee.get(row.inseeCode) ?? row.inseeCode;

                if (!accumulator) {
                    accumulator = {
                        addressKey,
                        inseeCode: row.inseeCode,
                        communeName,
                        streetNumber: row.streetNumber,
                        streetName: row.streetName,
                        rawRows: [],
                        latestDate: row.date,
                        latestLat: row.lat,
                        latestLng: row.lng
                    };
                    addressMap.set(addressKey, accumulator);
                }

                accumulator.rawRows.push(row);

                if (row.date > accumulator.latestDate) {
                    accumulator.latestDate = row.date;
                    accumulator.latestLat = row.lat;
                    accumulator.latestLng = row.lng;
                }

                // Track which addresses are involved in which mutations
                const mutationKey = buildMutationKey(row);
                if (!mutationToAddresses.has(mutationKey)) {
                    mutationToAddresses.set(mutationKey, new Set());
                }
                const addressLabel = buildAddressLabel(row.streetNumber, row.streetName, communeName);
                mutationToAddresses.get(mutationKey)!.add(addressLabel);
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
        totalMissingIdMutation += missingIdMutationCount;
    }

    console.info(
        `[transactions] All files parsed: ${totalProcessed.toLocaleString()} total, ${totalAccepted.toLocaleString()} accepted, ${addressMap.size.toLocaleString()} unique addresses`
    );

    // Log multi-address mutations
    const multiAddressMutations = Array.from(mutationToAddresses.values()).filter(
        (addresses) => addresses.size > 1
    ).length;
    if (multiAddressMutations > 0) {
        console.info(
            `[transactions] ${multiAddressMutations.toLocaleString()} mutations multi-adresses détectées`
        );
    }

    // Log warning if too many rows missing id_mutation
    if (totalAccepted > 0) {
        const missingPercent = (totalMissingIdMutation / totalAccepted) * 100;
        if (missingPercent > 5) {
            console.warn(
                `[transactions] ⚠️  ${missingPercent.toFixed(1)}% of rows (${totalMissingIdMutation.toLocaleString()}/${totalAccepted.toLocaleString()}) are missing id_mutation (pre-2018 data?)`
            );
        } else {
            console.info(
                `[transactions] id_mutation coverage: ${(100 - missingPercent).toFixed(1)}% (${totalMissingIdMutation.toLocaleString()} missing)`
            );
        }
    }

    // Phase 2: Deduplicate raw rows per address, then aggregate by mutation
    console.info("[transactions] Deduplicating and aggregating by mutation...");
    let totalRowsBefore = 0;
    let totalRowsAfterDedup = 0;
    let totalMutations = 0;

    for (const accumulator of addressMap.values()) {
        totalRowsBefore += accumulator.rawRows.length;

        // Deduplicate raw rows by composite key
        const uniqueMap = new Map<string, DvfRawRow>();
        for (const row of accumulator.rawRows) {
            const key = `${row.date}|${row.priceEur}|${row.typeLocal}|${row.surfaceM2 ?? "null"}|${row.idMutation ?? "null"}`;
            if (!uniqueMap.has(key)) {
                uniqueMap.set(key, row);
            }
        }

        const dedupedRows = Array.from(uniqueMap.values());
        totalRowsAfterDedup += dedupedRows.length;

        // Aggregate deduplicated rows into mutations
        const mutations = aggregateByMutation(dedupedRows);
        totalMutations += mutations.length;

        // Store mutations in accumulator (we'll use this for export)
        (accumulator as AddressAccumulator & { mutations: typeof mutations }).mutations = mutations;
    }

    console.info(
        `[transactions] Deduplication: ${totalRowsBefore.toLocaleString()} → ${totalRowsAfterDedup.toLocaleString()} rows (${(totalRowsBefore - totalRowsAfterDedup).toLocaleString()} duplicates removed)`
    );
    console.info(
        `[transactions] Aggregation: ${totalRowsAfterDedup.toLocaleString()} rows → ${totalMutations.toLocaleString()} mutations`
    );

    // Phase 3: Build GeoJSON features and partition into bundles
    console.info("[transactions] Generating GeoJSON and bundles...");
    const geojsonFeatures: GeoJsonFeature[] = [];
    const bundleMap = new Map<string, Map<string, TransactionAddressHistory>>();

    for (const acc of addressMap.values()) {
        // TypeScript: we added mutations in phase 2
        const mutations = (acc as AddressAccumulator & { mutations: TransactionAddressHistory["mutations"] }).mutations;

        // Enrich mutations with related addresses
        for (const mutation of mutations) {
            const allAddresses = mutationToAddresses.get(mutation.mutationId);
            if (allAddresses && allAddresses.size > 1) {
                mutation.relatedAddresses = Array.from(allAddresses).sort();
            }
        }

        const addressId = deriveAddressId(acc.addressKey);
        const tile = latLngToTile(acc.latestLat, acc.latestLng, BUNDLE_ZOOM);
        const bundleKey = `${tile.z}/${tile.x}/${tile.y}`;

        const history: TransactionAddressHistory = {
            id: addressId,
            label: buildAddressLabel(acc.streetNumber, acc.streetName, acc.communeName),
            lat: acc.latestLat,
            lng: acc.latestLng,
            mutations
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
                n: mutations.length
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
