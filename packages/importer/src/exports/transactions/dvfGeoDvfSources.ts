/**
 * DVF data sources from Etalab geo-dvf (files.data.gouv.fr/geo-dvf/).
 *
 * Provides per-department, per-year geocoded CSV files with latitude/longitude.
 * Same schema as the previous monolithic dvf.csv.gz source.
 *
 * Official data availability: rolling 5-year window (currently 2020 → 2025).
 * Updated semiannually (April + October) by Etalab.
 *
 * Incremental behavior: downloadFile caches by URL hash.
 * - Completed years (< current year): 180-day cache TTL (data immutable)
 * - Current year: 7-day cache TTL (data may receive late additions)
 *
 * @see https://www.data.gouv.fr/datasets/demandes-de-valeurs-foncieres-geolocalisees/
 */

const GEO_DVF_BASE_URL = "https://files.data.gouv.fr/geo-dvf/latest/csv";

/** First year available in geo-dvf. */
const DVF_FIRST_YEAR = 2020;

const CACHE_TTL_COMPLETED_MS = 180 * 24 * 60 * 60 * 1000; // 180 days
const CACHE_TTL_CURRENT_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Departments to import. MVP: Hérault only. */
export const DVF_DEPARTMENTS = ["34"] as const;

export type DvfSourceEntry = {
    year: number;
    department: string;
    url: string;
    cacheTtlMs: number;
};

/**
 * Builds the list of DVF source files to download.
 * One entry per (year, department) pair.
 */
export function buildDvfSourceEntries(options?: {
    departments?: readonly string[];
    firstYear?: number;
    lastYear?: number;
}): DvfSourceEntry[] {
    const departments = options?.departments ?? DVF_DEPARTMENTS;
    const currentYear = new Date().getFullYear();
    const firstYear = options?.firstYear ?? DVF_FIRST_YEAR;
    // geo-dvf data for the current year is typically not yet published
    const lastYear = options?.lastYear ?? currentYear - 1;

    const sources: DvfSourceEntry[] = [];

    for (let year = firstYear; year <= lastYear; year++) {
        for (const dept of departments) {
            sources.push({
                year,
                department: dept,
                url: `${GEO_DVF_BASE_URL}/${year}/departements/${dept}.csv.gz`,
                cacheTtlMs: year < currentYear ? CACHE_TTL_COMPLETED_MS : CACHE_TTL_CURRENT_MS
            });
        }
    }

    return sources;
}
