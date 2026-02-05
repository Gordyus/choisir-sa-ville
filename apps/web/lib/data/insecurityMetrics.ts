/**
 * Insecurity Metrics Data Loader
 *
 * Loads SSMSI insecurity metrics from static JSON files.
 * Provides lookup by INSEE code and year.
 *
 * Data structure:
 * - /data/{version}/communes/metrics/insecurity/meta.json
 * - /data/{version}/communes/metrics/insecurity/{year}.json
 */

"use client";

import { useEffect, useState } from "react";

// ============================================================================
// Types
// ============================================================================

export interface InsecurityMetricsMeta {
    source: string;
    license: string;
    geoLevel: string;
    unit: string;
    yearsAvailable: number[];
    generatedAtUtc: string;
    methodology: string;
}

export interface InsecurityMetricsRow {
    insee: string;
    population: number | null;
    violencesPersonnesPer1000: number | null;
    securiteBiensPer1000: number | null;
    tranquillitePer1000: number | null;
    indexGlobal: number | null;
}

interface RawInsecurityData {
    year: number;
    unit: string;
    columns: string[];
    rows: Array<Array<string | number | null>>;
}

export type InsecurityLevel = "faible" | "modere" | "eleve" | "tres-eleve";

export interface InsecurityMetricsResult {
    indexGlobal: number | null;
    level: InsecurityLevel | null;
    violencesPersonnesPer1000: number | null;
    securiteBiensPer1000: number | null;
    tranquillitePer1000: number | null;
    year: number;
}

// ============================================================================
// Level Thresholds (baked at build time per spec)
// ============================================================================

/**
 * Compute insecurity level from indexGlobal (0-100 percentile rank).
 *
 * | Level       | Range    |
 * |-------------|----------|
 * | Faible      | 0–24     |
 * | Modéré      | 25–49    |
 * | Élevé       | 50–74    |
 * | Très élevé  | 75–100   |
 */
export function computeInsecurityLevel(indexGlobal: number | null): InsecurityLevel | null {
    if (indexGlobal === null || !Number.isFinite(indexGlobal)) {
        return null;
    }

    if (indexGlobal < 25) return "faible";
    if (indexGlobal < 50) return "modere";
    if (indexGlobal < 75) return "eleve";
    return "tres-eleve";
}

/**
 * Get display label for insecurity level.
 */
export function getInsecurityLevelLabel(level: InsecurityLevel | null): string {
    if (!level) return "";

    const labels: Record<InsecurityLevel, string> = {
        faible: "Faible",
        modere: "Modéré",
        eleve: "Élevé",
        "tres-eleve": "Très élevé"
    };

    return labels[level];
}

// ============================================================================
// Constants
// ============================================================================

const MANIFEST_PATH = "/data/current/manifest.json";
const INSECURITY_BASE_PATH = "communes/metrics/insecurity";

// ============================================================================
// Caches
// ============================================================================

let datasetVersionCache: string | null = null;
let metaCache: InsecurityMetricsMeta | null = null;
let metaPromise: Promise<InsecurityMetricsMeta> | null = null;

// Cache by year: Map<year, Map<insee, row>>
const yearDataCache = new Map<number, Map<string, InsecurityMetricsRow>>();
const yearDataPromises = new Map<number, Promise<Map<string, InsecurityMetricsRow>>>();

// ============================================================================
// Internal Helpers
// ============================================================================

async function getDatasetVersion(signal?: AbortSignal): Promise<string> {
    if (datasetVersionCache) {
        return datasetVersionCache;
    }

    const res = await fetch(MANIFEST_PATH, signal ? { signal } : {});
    if (!res.ok) {
        throw new Error(`Failed to fetch manifest: ${res.status}`);
    }

    const manifest = (await res.json()) as { datasetVersion: string };
    datasetVersionCache = manifest.datasetVersion;
    return datasetVersionCache;
}

function buildDataPath(version: string, relativePath: string): string {
    return `/data/${version}/${relativePath}`;
}

// ============================================================================
// Meta Loader
// ============================================================================

/**
 * Load insecurity metrics metadata.
 */
export async function loadInsecurityMeta(signal?: AbortSignal): Promise<InsecurityMetricsMeta> {
    if (metaCache) {
        return metaCache;
    }

    if (!metaPromise) {
        metaPromise = (async () => {
            const version = await getDatasetVersion(signal);
            const path = buildDataPath(version, `${INSECURITY_BASE_PATH}/meta.json`);
            const res = await fetch(path, signal ? { signal } : {});

            if (!res.ok) {
                throw new Error(`Failed to fetch insecurity meta: ${res.status}`);
            }

            const data = (await res.json()) as InsecurityMetricsMeta;
            metaCache = data;
            return data;
        })();

        metaPromise.catch(() => {
            metaPromise = null;
        });
    }

    return metaPromise;
}

// ============================================================================
// Year Data Loader
// ============================================================================

/**
 * Load insecurity data for a specific year.
 */
export async function loadInsecurityYear(
    year: number,
    signal?: AbortSignal
): Promise<Map<string, InsecurityMetricsRow>> {
    const cached = yearDataCache.get(year);
    if (cached) {
        return cached;
    }

    let promise = yearDataPromises.get(year);
    if (!promise) {
        promise = (async () => {
            const version = await getDatasetVersion(signal);
            const path = buildDataPath(version, `${INSECURITY_BASE_PATH}/${year}.json`);
            const res = await fetch(path, signal ? { signal } : {});

            if (!res.ok) {
                throw new Error(`Failed to fetch insecurity data for ${year}: ${res.status}`);
            }

            const raw = (await res.json()) as RawInsecurityData;
            const map = parseInsecurityData(raw);
            yearDataCache.set(year, map);
            return map;
        })();

        yearDataPromises.set(year, promise);

        promise.catch(() => {
            yearDataPromises.delete(year);
        });
    }

    return promise;
}

function parseInsecurityData(raw: RawInsecurityData): Map<string, InsecurityMetricsRow> {
    const map = new Map<string, InsecurityMetricsRow>();

    // Build column index map
    const colIndex: Record<string, number> = {};
    for (let i = 0; i < raw.columns.length; i++) {
        const col = raw.columns[i];
        if (col !== undefined) {
            colIndex[col] = i;
        }
    }

    // Expected columns
    const inseeIdx = colIndex["insee"];
    const populationIdx = colIndex["population"];
    const violencesIdx = colIndex["violencesPersonnesPer1000"];
    const securiteIdx = colIndex["securiteBiensPer1000"];
    const tranquilliteIdx = colIndex["tranquillitePer1000"];
    const indexGlobalIdx = colIndex["indexGlobal"];

    if (inseeIdx === undefined) {
        console.warn("[insecurityMetrics] Missing 'insee' column");
        return map;
    }

    for (const row of raw.rows) {
        const insee = row[inseeIdx] as string;
        if (!insee) continue;

        map.set(insee, {
            insee,
            population: populationIdx !== undefined ? (row[populationIdx] as number | null) : null,
            violencesPersonnesPer1000:
                violencesIdx !== undefined ? (row[violencesIdx] as number | null) : null,
            securiteBiensPer1000: securiteIdx !== undefined ? (row[securiteIdx] as number | null) : null,
            tranquillitePer1000:
                tranquilliteIdx !== undefined ? (row[tranquilliteIdx] as number | null) : null,
            indexGlobal: indexGlobalIdx !== undefined ? (row[indexGlobalIdx] as number | null) : null
        });
    }

    return map;
}

// ============================================================================
// Lookup Functions
// ============================================================================

/**
 * Get insecurity metrics for a commune by INSEE code.
 *
 * @param inseeCode - Commune INSEE code (5 chars)
 * @param year - Optional year (defaults to latest available)
 * @param signal - Optional abort signal
 */
export async function getInsecurityMetrics(
    inseeCode: string,
    year?: number,
    signal?: AbortSignal
): Promise<InsecurityMetricsResult | null> {
    const meta = await loadInsecurityMeta(signal);

    // Use specified year or latest available
    const targetYear = year ?? Math.max(...meta.yearsAvailable);

    if (!meta.yearsAvailable.includes(targetYear)) {
        return null;
    }

    const yearData = await loadInsecurityYear(targetYear, signal);
    const row = yearData.get(inseeCode);

    if (!row) {
        return null;
    }

    return {
        indexGlobal: row.indexGlobal,
        level: computeInsecurityLevel(row.indexGlobal),
        violencesPersonnesPer1000: row.violencesPersonnesPer1000,
        securiteBiensPer1000: row.securiteBiensPer1000,
        tranquillitePer1000: row.tranquillitePer1000,
        year: targetYear
    };
}

/**
 * Get latest available year for insecurity metrics.
 */
export async function getLatestInsecurityYear(signal?: AbortSignal): Promise<number> {
    const meta = await loadInsecurityMeta(signal);
    return Math.max(...meta.yearsAvailable);
}

// ============================================================================
// React Hook
// ============================================================================

export interface UseInsecurityMetricsResult {
    data: InsecurityMetricsResult | null;
    loading: boolean;
    error: Error | null;
}

/**
 * React hook to fetch insecurity metrics for a commune.
 *
 * For infraZones, pass the parent commune's INSEE code.
 *
 * @param inseeCode - Commune INSEE code (or null to skip)
 * @param year - Optional specific year (defaults to latest)
 */
export function useInsecurityMetrics(
    inseeCode: string | null,
    year?: number
): UseInsecurityMetricsResult {
    const [data, setData] = useState<InsecurityMetricsResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!inseeCode) {
            setData(null);
            setLoading(false);
            setError(null);
            return;
        }

        const controller = new AbortController();
        setLoading(true);
        setError(null);

        getInsecurityMetrics(inseeCode, year, controller.signal)
            .then((result) => {
                if (!controller.signal.aborted) {
                    setData(result);
                    setLoading(false);
                }
            })
            .catch((err: unknown) => {
                if (!controller.signal.aborted) {
                    // Don't report abort errors
                    if (err instanceof DOMException && err.name === "AbortError") {
                        return;
                    }
                    setError(err instanceof Error ? err : new Error(String(err)));
                    setLoading(false);
                }
            });

        return () => {
            controller.abort();
        };
    }, [inseeCode, year]);

    return { data, loading, error };
}
