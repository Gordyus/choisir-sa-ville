/**
 * Transaction Bundle Loader
 *
 * Loads transaction history data from statically-generated tile bundles.
 * Each bundle contains all transaction addresses within a WebMercator tile at z15.
 *
 * Pattern: Memory-cached, deduped fetch (same as StaticFilesEntityDataProvider).
 */

import type { TransactionAddressData } from "@/lib/selection/types";

import { debugLogEntityFetch } from "@/lib/data/entityFetchDebug";

// ============================================================================
// Constants
// ============================================================================

const MANIFEST_PATH = "/data/current/manifest.json";

// ============================================================================
// Types
// ============================================================================

type BundleKey = string;
type BundleData = Record<string, TransactionAddressData>;

interface ManifestJson {
    datasetVersion: string;
    files: string[];
}

// ============================================================================
// Cache
// ============================================================================

let datasetVersionCache: string | null = null;
let datasetVersionPromise: Promise<string> | null = null;

const bundleCache = new Map<BundleKey, BundleData>();
const pendingBundleFetches = new Map<BundleKey, Promise<BundleData | null>>();

// ============================================================================
// Dataset Version Resolution
// ============================================================================

/**
 * Resolve the current dataset version by fetching and parsing the manifest.
 * Uses an in-memory cache to avoid redundant fetches.
 * 
 * Note: If a fetch is already in-flight when this function is called with a new signal,
 * the new signal will be ignored and the existing fetch will continue. This is acceptable
 * as manifest fetches are small, infrequent, and fast. The abort mechanism is primarily
 * useful for the first call during component mount/unmount cycles.
 */
async function resolveDatasetVersion(signal?: AbortSignal): Promise<string> {
    if (datasetVersionCache) {
        return datasetVersionCache;
    }
    if (!datasetVersionPromise) {
        datasetVersionPromise = fetchDatasetVersion(signal)
            .then((version) => {
                datasetVersionCache = version;
                datasetVersionPromise = null;
                return version;
            })
            .catch((err) => {
                datasetVersionPromise = null;
                throw err;
            });
    }
    return datasetVersionPromise;
}

async function fetchDatasetVersion(signal?: AbortSignal): Promise<string> {
    const response = await fetch(MANIFEST_PATH, {
        signal: signal ?? null,
        headers: { Accept: "application/json" }
    });
    if (!response.ok) {
        throw new Error(`[transactionBundles] Failed to fetch manifest: ${response.status}`);
    }
    const manifest = (await response.json()) as ManifestJson;
    return manifest.datasetVersion;
}

// ============================================================================
// Bundle Fetching
// ============================================================================

function buildBundleKey(bundleZ: number, bundleX: number, bundleY: number): BundleKey {
    return `z${bundleZ}/${bundleX}/${bundleY}`;
}

function buildBundleUrl(datasetVersion: string, bundleZ: number, bundleX: number, bundleY: number): string {
    return `/data/${datasetVersion}/transactions/bundles/z${bundleZ}/${bundleX}/${bundleY}.json`;
}

/**
 * Fetch a transaction bundle by tile coordinates.
 * Results are cached in memory and concurrent requests are deduped.
 */
export async function fetchTransactionBundle(
    bundleZ: number,
    bundleX: number,
    bundleY: number,
    signal?: AbortSignal
): Promise<BundleData | null> {
    const key = buildBundleKey(bundleZ, bundleX, bundleY);

    // Check memory cache
    const cached = bundleCache.get(key);
    if (cached) {
        return cached;
    }

    // Deduplicate concurrent requests
    const pending = pendingBundleFetches.get(key);
    if (pending) {
        return pending;
    }

    const fetchPromise = (async (): Promise<BundleData | null> => {
        try {
            const version = await resolveDatasetVersion(signal);
            const url = buildBundleUrl(version, bundleZ, bundleX, bundleY);

            debugLogEntityFetch(url, { domain: "transactionBundles" });

            const response = await fetch(url, {
                signal: signal ?? null,
                headers: { Accept: "application/json" }
            });

            if (!response.ok) {
                if (response.status === 404) {
                    return null;
                }
                console.warn(`[transactionBundles] HTTP ${response.status} for ${url}`);
                return null;
            }

            const data = (await response.json()) as BundleData;
            bundleCache.set(key, data);
            return data;
        } catch (error) {
            if (error instanceof Error && error.name === "AbortError") {
                return null;
            }
            console.error(`[transactionBundles] Failed to fetch bundle ${key}:`, error);
            return null;
        } finally {
            pendingBundleFetches.delete(key);
        }
    })();

    pendingBundleFetches.set(key, fetchPromise);
    return fetchPromise;
}

/**
 * Get transaction history for a specific address from its tile bundle.
 */
export async function getTransactionHistory(
    ref: { id: string; bundleZ: number; bundleX: number; bundleY: number },
    signal?: AbortSignal
): Promise<TransactionAddressData | null> {
    const bundle = await fetchTransactionBundle(ref.bundleZ, ref.bundleX, ref.bundleY, signal);
    if (!bundle) {
        return null;
    }
    return bundle[ref.id] ?? null;
}

/**
 * Build the GeoJSON source URL for the transaction addresses layer.
 */
export async function getTransactionAddressesGeoJsonUrl(signal?: AbortSignal): Promise<string> {
    const version = await resolveDatasetVersion(signal);
    return `/data/${version}/transactions/addresses.geojson`;
}

/**
 * Reset caches (for testing).
 */
export function resetTransactionBundlesCache(): void {
    datasetVersionCache = null;
    datasetVersionPromise = null;
    bundleCache.clear();
    pendingBundleFetches.clear();
}
