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

/**
 * Departments to import.
 * If empty, importer fetches all available departments for each year from geo-dvf.
 */
export const DVF_DEPARTMENTS: readonly string[] = ["34", "59", "75", "76"];

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
export async function buildDvfSourceEntries(options?: {
    departments?: readonly string[];
    firstYear?: number;
    lastYear?: number;
}): Promise<DvfSourceEntry[]> {
    const configuredDepartments = normalizeDepartmentCodes(options?.departments ?? DVF_DEPARTMENTS);
    const currentYear = new Date().getFullYear();
    const firstYear = options?.firstYear ?? DVF_FIRST_YEAR;
    // geo-dvf data for the current year is typically not yet published
    const lastYear = options?.lastYear ?? currentYear - 1;

    const sources: DvfSourceEntry[] = [];
    const allDepartmentsByYear = new Map<number, string[]>();

    for (let year = firstYear; year <= lastYear; year++) {
        const departments = configuredDepartments.length > 0
            ? configuredDepartments
            : await getAllAvailableDepartmentsForYear(year, allDepartmentsByYear);

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

function normalizeDepartmentCodes(departments: readonly string[]): string[] {
    const normalized = departments
        .map((dept) => dept.trim())
        .filter((dept) => dept.length > 0);
    return Array.from(new Set(normalized)).sort((a, b) => a.localeCompare(b));
}

async function getAllAvailableDepartmentsForYear(
    year: number,
    cache: Map<number, string[]>
): Promise<string[]> {
    const cached = cache.get(year);
    if (cached) return cached;

    const url = `${GEO_DVF_BASE_URL}/${year}/departements/`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`[dvf] Failed to list available departments for ${year}: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const pattern = /href="([0-9A-Za-z]{2,3})\.csv\.gz"/g;
    const departments = new Set<string>();

    for (const match of html.matchAll(pattern)) {
        const dept = match[1];
        if (dept) departments.add(dept);
    }

    const allDepartments = Array.from(departments).sort((a, b) => a.localeCompare(b));
    if (allDepartments.length === 0) {
        throw new Error(`[dvf] No department files found for ${year} at ${url}`);
    }

    cache.set(year, allDepartments);
    return allDepartments;
}
