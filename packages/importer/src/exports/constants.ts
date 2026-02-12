export const SOURCE_URLS = {
    communes: "https://www.insee.fr/fr/statistiques/fichier/8377162/v_commune_2025.csv",
    regions: "https://www.insee.fr/fr/statistiques/fichier/8377162/v_region_2025.csv",
    departments: "https://www.insee.fr/fr/statistiques/fichier/8377162/v_departement_2025.csv",
    postal: "https://static.data.gouv.fr/resources/communes-de-france-base-des-codes-postaux/20241113-073516/20230823-communes-departement-region.csv",
    populationRef: "https://www.insee.fr/fr/statistiques/fichier/8680726/ensemble.zip",
    ssmsi: "https://www.data.gouv.fr/api/1/datasets/r/98fd2271-4d76-4015-a80c-bcec329f6ad0"
} as const;

export type SourceKey = keyof typeof SOURCE_URLS;

// ============================================================================
// DVF Annual Sources (2014-2024+)
// ============================================================================

/**
 * DVF Annual Data Sources (2014-2024+)
 *
 * Official DVF datasets published annually by DGFIP on data.gouv.fr.
 * Each file contains real estate transactions for one calendar year.
 *
 * Coverage: 10+ years of historical data
 * Format: CSV gzipped (~100-150 MB per year)
 * Update frequency: New year available Q1 following (e.g., 2025 available Q1 2026)
 *
 * Dataset: https://www.data.gouv.fr/fr/datasets/demandes-de-valeurs-foncieres/
 * Dataset ID: 5c4ae55a634f4117716d5656
 *
 * ---
 *
 * How to find resource IDs:
 * 1. Visit https://www.data.gouv.fr/fr/datasets/demandes-de-valeurs-foncieres/
 * 2. Look for resources titled "Demandes de valeurs foncières géolocalisées - YYYY"
 * 3. Right-click "Télécharger" and copy link, or use browser DevTools to inspect network request
 * 4. Extract resource ID from URL pattern: /datasets/r/{RESOURCE_ID}/download
 *
 * OR use API:
 * ```bash
 * curl "https://www.data.gouv.fr/api/1/datasets/5c4ae55a634f4117716d5656/" \
 *   | jq '.resources[] | select(.title | contains("géolocalisées")) | {year: .title, id: .id}'
 * ```
 */

export type DvfAnnualSource = {
    readonly year: number;
    readonly url: string;
};

/**
 * DVF annual file URLs (2014-2024)
 *
 * NOTE: These use data.gouv.fr API endpoint /api/1/datasets/r/{ID} which provides:
 * - Stable resource IDs (never change)
 * - Automatic Content-Disposition headers
 * - Reliable caching behavior
 *
 * Cache TTL: 180 days (6 months) — files are immutable once published.
 */
export const DVF_ANNUAL_SOURCES: readonly DvfAnnualSource[] = [
    {
        year: 2014,
        url: "https://www.data.gouv.fr/api/1/datasets/r/0ab442c5-57d1-4139-92ce-9f8e6d0e7297"
    },
    {
        year: 2015,
        url: "https://www.data.gouv.fr/api/1/datasets/r/1be77ca5-dc1b-4e50-af2b-0240147e0346"
    },
    {
        year: 2016,
        url: "https://www.data.gouv.fr/api/1/datasets/r/b4ae4a93-a2a9-4c8a-9c2f-d0bf3e0ac9b3"
    },
    {
        year: 2017,
        url: "https://www.data.gouv.fr/api/1/datasets/r/c6eef529-835b-4e31-a7b8-bd3d2e4b3a9a"
    },
    {
        year: 2018,
        url: "https://www.data.gouv.fr/api/1/datasets/r/3e34b9f7-c6c8-48f1-b82c-e3c6e5e5d9a3"
    },
    {
        year: 2019,
        url: "https://www.data.gouv.fr/api/1/datasets/r/817204ac-2202-408c-abd9-2f0b8f0c5d6d"
    },
    {
        year: 2020,
        url: "https://www.data.gouv.fr/api/1/datasets/r/90a98de0-f562-4328-aa16-fe0dd1dca60f"
    },
    {
        year: 2021,
        url: "https://www.data.gouv.fr/api/1/datasets/r/3004168d-bec4-44d9-a781-ef16f41856a2"
    },
    {
        year: 2022,
        url: "https://www.data.gouv.fr/api/1/datasets/r/7161c9f2-3d91-4caf-afa2-cfe535807f04"
    },
    {
        year: 2023,
        url: "https://www.data.gouv.fr/api/1/datasets/r/f25c6de7-f31c-4136-b821-4e5f9b3c40f2"
    },
    {
        year: 2024,
        url: "https://www.data.gouv.fr/api/1/datasets/r/d7933994-2c66-4131-a4da-cf7cd18040a4"
    },
    {
        year: 2025, // S1 only
        url: "https://www.data.gouv.fr/api/1/datasets/r/4d741143-8331-4b59-95c2-3b24a7bdbe3c"
    }
] as const;

/**
 * Validation: ensure years are sequential and complete
 */
export function validateDvfSources(): { ok: boolean; errors: string[] } {
    const errors: string[] = [];
    const years = DVF_ANNUAL_SOURCES.map((s) => s.year);
    const uniqueYears = new Set(years);

    if (years.length !== uniqueYears.size) {
        errors.push("Duplicate years found in DVF_ANNUAL_SOURCES");
    }

    for (let i = 1; i < years.length; i++) {
        const prevYear = years[i - 1];
        const currYear = years[i];
        if (prevYear === undefined || currYear === undefined) {
            errors.push("Undefined year in sequence");
            continue;
        }
        if (currYear !== prevYear + 1) {
            errors.push(`Non-sequential years: ${prevYear} → ${currYear}`);
        }
    }

    for (const source of DVF_ANNUAL_SOURCES) {
        if (!source.url || source.url.includes("TODO")) {
            errors.push(`Missing or placeholder URL for year ${source.year}`);
        }
    }

    return { ok: errors.length === 0, errors };
}