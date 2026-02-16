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

import type { PopulationCategory } from "@choisir-sa-ville/shared/config/insecurity-metrics";

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
    populationCategory: PopulationCategory | null;
    violencesPersonnesPer100k: number | null;
    securiteBiensPer100k: number | null;
    tranquillitePer100k: number | null;
    indexGlobalNational: number | null;
    indexGlobalCategory: number | null;
    levelNational: number;
    levelCategory: number;
    rankInCategory: string | null;
    dataCompleteness: number;
}

interface RawInsecurityData {
    year: number;
    unit: string;
    columns: string[];
    rows: Array<Array<string | number | null>>;
}

export interface InsecurityMetricsResult {
    population: number | null;
    populationCategory: PopulationCategory | null;
    violencesPersonnesPer100k: number | null;
    securiteBiensPer100k: number | null;
    tranquillitePer100k: number | null;
    indexGlobalNational: number | null;
    indexGlobalCategory: number | null;
    levelNational: number;
    levelCategory: number;
    rankInCategory: string | null;
    dataCompleteness: number;
    year: number;
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

    // Expected columns (12 columns after Phase 2)
    const inseeIdx = colIndex["insee"];
    const populationIdx = colIndex["population"];
    const populationCategoryIdx = colIndex["populationCategory"];
    const violencesIdx = colIndex["violencesPersonnesPer100k"];
    const securiteIdx = colIndex["securiteBiensPer100k"];
    const tranquilliteIdx = colIndex["tranquillitePer100k"];
    const indexGlobalNationalIdx = colIndex["indexGlobalNational"];
    const indexGlobalCategoryIdx = colIndex["indexGlobalCategory"];
    const levelNationalIdx = colIndex["levelNational"];
    const levelCategoryIdx = colIndex["levelCategory"];
    const rankInCategoryIdx = colIndex["rankInCategory"];
    const dataCompletenessIdx = colIndex["dataCompleteness"];

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
            populationCategory: populationCategoryIdx !== undefined ? (row[populationCategoryIdx] as PopulationCategory | null) : null,
            violencesPersonnesPer100k: violencesIdx !== undefined ? (row[violencesIdx] as number | null) : null,
            securiteBiensPer100k: securiteIdx !== undefined ? (row[securiteIdx] as number | null) : null,
            tranquillitePer100k: tranquilliteIdx !== undefined ? (row[tranquilliteIdx] as number | null) : null,
            indexGlobalNational: indexGlobalNationalIdx !== undefined ? (row[indexGlobalNationalIdx] as number | null) : null,
            indexGlobalCategory: indexGlobalCategoryIdx !== undefined ? (row[indexGlobalCategoryIdx] as number | null) : null,
            levelNational: levelNationalIdx !== undefined ? (row[levelNationalIdx] as number) : 0,
            levelCategory: levelCategoryIdx !== undefined ? (row[levelCategoryIdx] as number) : 0,
            rankInCategory: rankInCategoryIdx !== undefined ? (row[rankInCategoryIdx] as string | null) : null,
            dataCompleteness: dataCompletenessIdx !== undefined ? (row[dataCompletenessIdx] as number) : 0
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
        population: row.population,
        populationCategory: row.populationCategory,
        violencesPersonnesPer100k: row.violencesPersonnesPer100k,
        securiteBiensPer100k: row.securiteBiensPer100k,
        tranquillitePer100k: row.tranquillitePer100k,
        indexGlobalNational: row.indexGlobalNational,
        indexGlobalCategory: row.indexGlobalCategory,
        levelNational: row.levelNational,
        levelCategory: row.levelCategory,
        rankInCategory: row.rankInCategory,
        dataCompleteness: row.dataCompleteness,
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

import { useMemo } from "react";

import { useAsyncData, type AsyncDataResult } from "./useAsyncData";

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
): AsyncDataResult<InsecurityMetricsResult> {
    const fetcher = useMemo(
        () => inseeCode ? (signal: AbortSignal) => getInsecurityMetrics(inseeCode, year, signal) : null,
        [inseeCode, year]
    );

    return useAsyncData(fetcher);
}
