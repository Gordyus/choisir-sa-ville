import { readFile } from "node:fs/promises";
import path from "node:path";

import { asyncBufferFromFile, parquetMetadataAsync, parquetReadObjects, parquetSchema } from "hyparquet";
import { compressors } from "hyparquet-compressors";

import { INSECURITY_CATEGORIES, POPULATION_CATEGORIES, getPopulationCategory, type PopulationCategory } from "@choisir-sa-ville/shared/config/insecurity-metrics";

import { SOURCE_URLS } from "../../../constants.js";
import { writeJsonAtomic } from "../../../shared/fileSystem.js";
import type { ExportCommune, ExportContext, SourceMeta } from "../../../shared/types.js";

const OUTPUT_COLUMNS = [
    "insee",
    "population",
    "populationCategory",
    "violencesPersonnesPer100k",
    "securiteBiensPer100k",
    "tranquillitePer100k",
    "indexGlobalNational",
    "indexGlobalCategory",
    "levelNational",
    "levelCategory",
    "rankInCategory",
    "dataCompleteness"
] as const;

type MetricGroup = "violencesPersonnes" | "securiteBiens" | "tranquillite";

type MappingFileV1 = {
    version: 1;
    categoryKeyColumn: string | null;
    columns?: { insee?: string | null; year?: string | null; facts?: string | null };
    groups: Record<MetricGroup, string[]>;
};

type ExportMetricsInsecurityParams = {
    context: ExportContext;
    communes: ExportCommune[];
    ssmsiSource: SourceMeta;
};

type GroupAccumulator = {
    sumFacts: number;
    rows: number;
};

type CommuneYearAcc = {
    violencesPersonnes: GroupAccumulator;
    securiteBiens: GroupAccumulator;
    tranquillite: GroupAccumulator;
};

type UnmappedCounter = Map<string, number>;

export async function exportMetricsInsecurity({
    context,
    communes,
    ssmsiSource
}: ExportMetricsInsecurityParams): Promise<string[]> {
    const generatedAtUtc = new Date().toISOString();
    const mapping = await loadMapping();

    const targetDir = path.join(context.datasetDir, "communes", "metrics", "insecurity");

    const file = await asyncBufferFromFile(ssmsiSource.filePath);

    const metadata = await parquetMetadataAsync(file);
    const schema = parquetSchema(metadata);
    const columnNames = schema.children.map((e) => e.element.name);

    const inseeColumn = resolveColumn(columnNames, mapping.columns?.insee, [
        "insee",
        "codgeo",
        "code_commune",
        "com",
        "codeinsee"
    ]);
    const yearColumn = resolveColumn(columnNames, mapping.columns?.year, ["annee", "year", "millesime"]);
    const factsColumn = resolveColumn(columnNames, mapping.columns?.facts, [
        "faits",
        "nbfaits",
        "count",
        "nombre",
        "valeur",
        "nombre_faits",
        "nb_faits"
    ]);
    const populationColumn = resolveColumn(columnNames, null, [
        "insee_pop",
        "population",
        "pop",
        "pmun",
        "ptot"
    ]);

    const categoryColumn = resolveColumn(columnNames, mapping.categoryKeyColumn, [
        "categorie",
        "category",
        "infraction",
        "code_infraction",
        "libelle",
        "qualification",
        "nature",
        "classe"
    ]);

    const files: string[] = [];

    const groupByCategory = buildGroupLookup(mapping.groups);
    if (groupByCategory.size === 0) {
        const metaPath = path.join(targetDir, "meta.json");
        await writeJsonAtomic(metaPath, buildMeta({
            generatedAtUtc,
            yearsAvailable: [],
            mappingFile: "ssmsiToGroups.v1.json",
            unmapped: { rows: 0, top: [] },
            ssmsi: {
                url: ssmsiSource.url,
                resourceId: "98fd2271-4d76-4015-a80c-bcec329f6ad0"
            },
            population: {
                source: "SSMSI Parquet (insee_pop column)",
                fallbackStrategy: "none",
                columnInferred: null,
                missingPopulation: []
            },
            categoryCounts: { small: 0, medium: 0, large: 0 },
            warnings: [
                "SSMSI mapping is empty. Run inspectSsmsi.ts and populate mapping/ssmsiToGroups.v1.json (groups + categoryKeyColumn)."
            ],
            inferred: { inseeColumn, yearColumn, factsColumn, categoryColumn, populationColumn }
        }));
        files.push("communes/metrics/insecurity/meta.json");
        console.warn("[metrics:insecurity] Skipped export (empty mapping)");
        return files;
    }

    if (!inseeColumn || !yearColumn || !factsColumn || !categoryColumn) {
        const metaPath = path.join(targetDir, "meta.json");
        await writeJsonAtomic(metaPath, buildMeta({
            generatedAtUtc,
            yearsAvailable: [],
            mappingFile: "ssmsiToGroups.v1.json",
            unmapped: { rows: 0, top: [] },
            ssmsi: {
                url: ssmsiSource.url,
                resourceId: "98fd2271-4d76-4015-a80c-bcec329f6ad0"
            },
            population: {
                source: "SSMSI Parquet (insee_pop column)",
                fallbackStrategy: "none",
                columnInferred: null,
                missingPopulation: []
            },
            categoryCounts: { small: 0, medium: 0, large: 0 },
            warnings: [
                "SSMSI parquet columns could not be inferred. Run inspectSsmsi.ts and fill mapping/ssmsiToGroups.v1.json."
            ],
            inferred: { inseeColumn, yearColumn, factsColumn, categoryColumn, populationColumn }
        }));
        files.push("communes/metrics/insecurity/meta.json");

        console.warn("[metrics:insecurity] Skipped export (missing required parquet columns)", {
            inseeColumn,
            yearColumn,
            factsColumn,
            categoryColumn
        });

        return files;
    }

    const unmapped: UnmappedCounter = new Map();

    const byYear = new Map<number, Map<string, CommuneYearAcc>>();
    const populationByInsee = new Map<string, number>();

    const totalRows = Number(metadata.num_rows);
    const chunkSize = 100_000;
    for (let rowStart = 0; rowStart < totalRows; rowStart += chunkSize) {
        const rowEnd = Math.min(totalRows, rowStart + chunkSize);
        const columnsToRead = [inseeColumn, yearColumn, factsColumn, categoryColumn];
        if (populationColumn) {
            columnsToRead.push(populationColumn);
        }
        const rows = await parquetReadObjects({
            file,
            columns: columnsToRead,
            rowStart,
            rowEnd,
            compressors
        });

        for (const row of rows) {
            const insee = normalizeInsee(row[inseeColumn]);
            if (!insee) continue;

            // Extract population if available (we take the first non-null value seen)
            if (populationColumn && !populationByInsee.has(insee)) {
                const pop = normalizeNonNegativeNumber(row[populationColumn]);
                if (pop !== null && pop > 0) {
                    populationByInsee.set(insee, pop);
                }
            }

            const year = normalizeYear(row[yearColumn]);
            if (!year) continue;

            const facts = normalizeNonNegativeNumber(row[factsColumn]);
            if (facts === null) continue;

            const categoryKeyRaw = row[categoryColumn];
            const categoryKey = categoryKeyRaw === null || typeof categoryKeyRaw === "undefined" ? "" : String(categoryKeyRaw).trim();
            if (!categoryKey) {
                continue;
            }

            const group = groupByCategory.get(categoryKey) ?? null;
            if (!group) {
                unmapped.set(categoryKey, (unmapped.get(categoryKey) ?? 0) + 1);
                continue;
            }

            const yearMap = getOrCreate(byYear, year, () => new Map());
            const acc = getOrCreate(yearMap, insee, () => createAcc());

            const bucket = acc[group];
            bucket.sumFacts += facts;
            bucket.rows += 1;
        }
    }

    const yearsAvailable = Array.from(byYear.keys()).sort((a, b) => a - b);

    // Track communes with facts but missing population
    const communesWithMissingPopulation = new Set<string>();

    // Write per-year files
    for (const year of yearsAvailable) {
        const accByInsee = byYear.get(year) ?? new Map();

        const rows = communes
            .slice()
            .sort((a, b) => a.insee.localeCompare(b.insee))
            .map((commune) => {
                const population = populationByInsee.get(commune.insee) ?? null;
                const acc = accByInsee.get(commune.insee) ?? null;

                // Track communes with facts but missing population
                if (acc && (acc.violencesPersonnes.rows > 0 || acc.securiteBiens.rows > 0 || acc.tranquillite.rows > 0)) {
                    if (!population) {
                        communesWithMissingPopulation.add(commune.insee);
                    }
                }

                const violencesPer1k = computeRatePer1000(acc?.violencesPersonnes ?? null, population);
                const biensPer1k = computeRatePer1000(acc?.securiteBiens ?? null, population);
                const tranquillitePer1k = computeRatePer1000(acc?.tranquillite ?? null, population);

                // Classify population category
                const populationCategory = getPopulationCategory(population);

                // Convert rates from /1000 to /100k (×100)
                const violencesPersonnesPer100k = violencesPer1k !== null ? violencesPer1k * 100 : null;
                const securiteBiensPer100k = biensPer1k !== null ? biensPer1k * 100 : null;
                const tranquillitePer100k = tranquillitePer1k !== null ? tranquillitePer1k * 100 : null;

                return {
                    insee: commune.insee,
                    population,
                    populationCategory,
                    violencesPersonnesPer100k,
                    securiteBiensPer100k,
                    tranquillitePer100k,
                    scoreRaw: computeRawScore({
                        violencesPersonnesPer1000: violencesPer1k,
                        securiteBiensPer1000: biensPer1k,
                        tranquillitePer1000: tranquillitePer1k
                    })
                };
            });

        const scoreValues = rows
            .map((r) => r.scoreRaw)
            .filter((v): v is number => typeof v === "number" && Number.isFinite(v));

        const indexByScoreNational = buildPercentileIndex(scoreValues);

        // Group by population category
        const categorizedCommunes = {
            small: rows.filter(c => c.populationCategory === "small"),
            medium: rows.filter(c => c.populationCategory === "medium"),
            large: rows.filter(c => c.populationCategory === "large")
        };

        // Calculate percentile + rank for each category
        const categoryIndices = new Map<string, { indexByScore: Map<number, number>; sortedByScore: typeof rows }>();

        for (const [category, communesInCategory] of Object.entries(categorizedCommunes)) {
            const scoreValuesCategory = communesInCategory
                .map(c => c.scoreRaw)
                .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
            
            const indexByScoreCategory = buildPercentileIndex(scoreValuesCategory);
            
            // Sort by score descending for rank calculation
            const sortedByScore = [...communesInCategory]
                .filter(c => c.scoreRaw !== null)
                .sort((a, b) => (b.scoreRaw ?? 0) - (a.scoreRaw ?? 0));
            
            categoryIndices.set(category, { indexByScore: indexByScoreCategory, sortedByScore });
        }

        const tabularRows = rows.map((r) => {
            const indexGlobalNational = r.scoreRaw === null ? null : indexByScoreNational.get(r.scoreRaw) ?? null;
            const levelNational = mapIndexToLevel(indexGlobalNational);
            
            // Calculate category-specific indices
            const category = r.populationCategory ?? "small"; // Fallback for null
            const categoryData = categoryIndices.get(category);
            const indexGlobalCategory = r.scoreRaw === null || !categoryData 
                ? null 
                : categoryData.indexByScore.get(r.scoreRaw) ?? null;
            const levelCategory = mapIndexToLevel(indexGlobalCategory);
            
            // Calculate rank in category
            let rankInCategory: string | null = null;
            if (categoryData && r.scoreRaw !== null) {
                const rank = categoryData.sortedByScore.findIndex(c => c.insee === r.insee) + 1;
                const totalInCategory = categorizedCommunes[category as keyof typeof categorizedCommunes]?.length ?? 0;
                rankInCategory = rank > 0 ? `${rank}/${totalInCategory}` : null;
            }
            
            // Calculate data completeness (0-1 range)
            const presentCount = [
                r.violencesPersonnesPer100k !== null,
                r.securiteBiensPer100k !== null,
                r.tranquillitePer100k !== null
            ].filter(Boolean).length;
            const dataCompleteness = presentCount / 3;
            
            return [
                r.insee,
                r.population,
                r.populationCategory,
                r.violencesPersonnesPer100k,
                r.securiteBiensPer100k,
                r.tranquillitePer100k,
                indexGlobalNational,
                indexGlobalCategory,
                levelNational,
                levelCategory,
                rankInCategory,
                dataCompleteness
            ] as const;
        });

        const outPath = path.join(targetDir, `${year}.json`);
        await writeJsonAtomic(outPath, {
            year,
            unit: "faits pour 100 000 habitants",
            source: "Ministère de l’Intérieur – SSMSI (base communale de la délinquance enregistrée)",
            generatedAtUtc,
            columns: OUTPUT_COLUMNS,
            rows: tabularRows
        });

        files.push(`communes/metrics/insecurity/${year}.json`);
    }

    // Calculate population category counts for meta.json
    const categoryCounts = {
        small: communes.filter(c => getPopulationCategory(populationByInsee.get(c.insee) ?? null) === "small").length,
        medium: communes.filter(c => getPopulationCategory(populationByInsee.get(c.insee) ?? null) === "medium").length,
        large: communes.filter(c => getPopulationCategory(populationByInsee.get(c.insee) ?? null) === "large").length
    };

    const metaPath = path.join(targetDir, "meta.json");
    await writeJsonAtomic(metaPath, buildMeta({
        generatedAtUtc,
        yearsAvailable,
        mappingFile: "ssmsiToGroups.v1.json",
        unmapped: summarizeUnmapped(unmapped),
        ssmsi: {
            url: ssmsiSource.url,
            resourceId: "98fd2271-4d76-4015-a80c-bcec329f6ad0"
        },
        population: {
            source: "SSMSI Parquet (insee_pop column)",
            fallbackStrategy: "none",
            columnInferred: populationColumn,
            missingPopulation: Array.from(communesWithMissingPopulation).sort()
        },
        categoryCounts,
        warnings: [],
        inferred: { inseeColumn, yearColumn, factsColumn, categoryColumn, populationColumn }
    }));

    files.push("communes/metrics/insecurity/meta.json");

    console.info(`[metrics:insecurity] Exported insecurity metrics for ${yearsAvailable.length} years`);
    return files;
}

function createAcc(): CommuneYearAcc {
    return {
        violencesPersonnes: { sumFacts: 0, rows: 0 },
        securiteBiens: { sumFacts: 0, rows: 0 },
        tranquillite: { sumFacts: 0, rows: 0 }
    };
}

function computeRatePer1000(acc: GroupAccumulator | null, population: number | null): number | null {
    if (!acc || acc.rows === 0) {
        return null;
    }
    if (!population || !Number.isFinite(population) || population <= 0) {
        return null;
    }
    const rate = (acc.sumFacts / population) * 1000;
    return round1(rate);
}

function round1(value: number): number {
    return Math.round(value * 10) / 10;
}

function computeRawScore(values: {
    violencesPersonnesPer1000: number | null;
    securiteBiensPer1000: number | null;
    tranquillitePer1000: number | null;
}): number | null {
    const v = values.violencesPersonnesPer1000 ?? 0;
    const b = values.securiteBiensPer1000 ?? 0;
    const t = values.tranquillitePer1000 ?? 0;

    // If all values are null, return null (no data at all)
    if (values.violencesPersonnesPer1000 === null &&
        values.securiteBiensPer1000 === null &&
        values.tranquillitePer1000 === null) {
        return null;
    }

    // Weighted sum with original weights (NO renormalization)
    // Missing values treated as 0 - preserves weight hierarchy
    const score = 
        INSECURITY_CATEGORIES[0]!.weight * v +
        INSECURITY_CATEGORIES[1]!.weight * b +
        INSECURITY_CATEGORIES[2]!.weight * t;

    return score;
}

/**
 * Build percentile index for all scores.
 * 
 * Maps each unique score to its percentile rank, rescaled to [0..100].
 * 
 * @param scores - Array of valid scores
 * @returns Map from score to indexGlobal
 */
function buildPercentileIndex(scores: number[]): Map<number, number> {
    const result = new Map<number, number>();
    if (!scores.length) {
        return result;
    }

    // Sort unique scores
    const sorted = Array.from(new Set(scores)).sort((a, b) => a - b);
    const n = sorted.length;

    // Use min-rank percentile for ties.
    // This ensures ties get the same percentile rank (lowest rank in the tie).
    const ranges = new Map<number, { start: number; end: number }>();
    for (let i = 0; i < sorted.length; i++) {
        const value = sorted[i]!;
        const existing = ranges.get(value);
        if (!existing) {
            ranges.set(value, { start: i, end: i });
        } else {
            existing.end = i;
        }
    }

    // Rescale to [0..100]
    for (const [value, range] of ranges) {
        const minRank = range.start;
        const percentile = n === 1 ? 0 : minRank / (n - 1);
        const indexGlobal = Math.round(100 * percentile);
        result.set(value, indexGlobal);
    }

    return result;
}

function summarizeUnmapped(unmapped: UnmappedCounter): { rows: number; top: Array<{ key: string; rows: number }> } {
    const entries = Array.from(unmapped.entries()).sort((a, b) => b[1] - a[1]);
    const rows = entries.reduce((sum, [, count]) => sum + count, 0);
    const top = entries.slice(0, 25).map(([key, count]) => ({ key, rows: count }));
    return { rows, top };
}

function buildMeta(params: {
    generatedAtUtc: string;
    yearsAvailable: number[];
    mappingFile: string;
    unmapped: { rows: number; top: Array<{ key: string; rows: number }> };
    ssmsi: { url: string; resourceId: string };
    population: { source: string; fallbackStrategy: string; columnInferred: string | null; missingPopulation: string[] };
    categoryCounts: { small: number; medium: number; large: number };
    warnings: string[];
    inferred: Record<string, string | null>;
}): Record<string, unknown> {

    return {
        source: "Bases statistiques communales de la délinquance enregistrée - SSMSI",
        license: "Licence Ouverte / Etalab",
        geoLevel: "commune",
        fallbackChain: [],
        unit: "faits pour 100 000 habitants",
        yearsAvailable: params.yearsAvailable,
        generatedAtUtc: params.generatedAtUtc,
        methodology:
            "Agrégation communale par catégorie, normalisée par population SSMSI (insee_pop, par année). Classification par taille de population avec double perspective (nationale et catégorie).",
        inputs: {
            ssmsiParquetUrl: params.ssmsi.url,
            ssmsiResourceId: params.ssmsi.resourceId,
            population: {
                source: params.population.source,
                fallbackStrategy: params.population.fallbackStrategy,
                columnInferred: params.population.columnInferred,
                note: "Population extraite du Parquet SSMSI (insee_pop). Pas de fallback externe."
            }
        },
        mapping: {
            mappingFile: params.mappingFile,
            unmapped: params.unmapped
        },
        inferredColumns: params.inferred,
        warnings: {
            general: params.warnings,
            missingPopulation: params.population.missingPopulation
        },
        populationCategories: {
            small: {
                min: POPULATION_CATEGORIES.small.min,
                max: POPULATION_CATEGORIES.small.max,
                label: POPULATION_CATEGORIES.small.label,
                count: params.categoryCounts.small
            },
            medium: {
                min: POPULATION_CATEGORIES.medium.min,
                max: POPULATION_CATEGORIES.medium.max,
                label: POPULATION_CATEGORIES.medium.label,
                count: params.categoryCounts.medium
            },
            large: {
                min: POPULATION_CATEGORIES.large.min,
                max: POPULATION_CATEGORIES.large.max === Infinity ? null : POPULATION_CATEGORIES.large.max,
                label: POPULATION_CATEGORIES.large.label,
                count: params.categoryCounts.large
            }
        },
        indexGlobal: {
            method: "percentile_rank on all scoreRaw values, rescaled to [0..100]",
            perspectives: {
                national: "Percentile across all 34,875+ communes",
                category: "Percentile within population category (small/medium/large)"
            }
        },
        levels: {
            labels: ["Très faible", "Faible", "Modéré", "Élevé", "Plus élevé"],
            method: "Percentile-based classification: level = floor(indexGlobal / 25)"
        }
    };
}

async function loadMapping(): Promise<MappingFileV1> {
    const mappingPath = new URL("./mapping/ssmsiToGroups.v1.json", import.meta.url);
    const raw = await readFile(mappingPath, "utf8");
    const parsed = JSON.parse(raw) as MappingFileV1;

    if (parsed.version !== 1 || !parsed.groups) {
        throw new Error("Invalid ssmsiToGroups mapping file");
    }

    return parsed;
}

function buildGroupLookup(groups: Record<MetricGroup, string[]>): Map<string, MetricGroup> {
    const lookup = new Map<string, MetricGroup>();
    for (const groupKey of Object.keys(groups) as MetricGroup[]) {
        for (const category of groups[groupKey] ?? []) {
            if (typeof category !== "string") continue;
            const key = category.trim();
            if (!key) continue;
            lookup.set(key, groupKey);
        }
    }
    return lookup;
}

function resolveColumn(columnNames: string[], forced: string | null | undefined, candidates: string[]): string | null {
    if (forced) {
        const resolved = resolveExactColumn(columnNames, forced);
        return resolved;
    }

    for (const candidate of candidates) {
        const resolved = resolveExactColumn(columnNames, candidate);
        if (resolved) {
            return resolved;
        }
    }

    // Fallback: heuristic by normalized key.
    const normalized = new Map(columnNames.map((name) => [normalizeKey(name), name] as const));
    for (const candidate of candidates) {
        const hit = normalized.get(normalizeKey(candidate));
        if (hit) return hit;
    }

    return null;
}

function resolveExactColumn(columnNames: string[], name: string): string | null {
    const hit = columnNames.find((c) => c === name);
    return hit ?? null;
}

function normalizeKey(value: string): string {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function normalizeInsee(value: unknown): string | null {
    if (typeof value === "string") {
        const trimmed = value.trim().toUpperCase();
        if (!trimmed) return null;
        const cleaned = trimmed.replace(/\s+/g, "");
        if (/^\d+$/.test(cleaned) && cleaned.length < 5) {
            return cleaned.padStart(5, "0");
        }
        // Accept 5-char INSEE including alphanumerics (e.g. 2A/2B for Corsica).
        return cleaned;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
        const asInt = Math.trunc(value);
        const asString = String(asInt);
        if (/^\d+$/.test(asString) && asString.length < 5) {
            return asString.padStart(5, "0");
        }
        return asString;
    }

    return null;
}

function normalizeYear(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) {
        const year = Math.trunc(value);
        return year >= 1900 && year <= 2100 ? year : null;
    }
    if (typeof value === "string") {
        const parsed = Number.parseInt(value.trim(), 10);
        return Number.isFinite(parsed) && parsed >= 1900 && parsed <= 2100 ? parsed : null;
    }
    return null;
}

function normalizeNonNegativeNumber(value: unknown): number | null {
    if (value === null || typeof value === "undefined") {
        return null;
    }

    if (typeof value === "number") {
        if (!Number.isFinite(value)) return null;
        if (value < 0) return null;
        return value;
    }

    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return null;
        const parsed = Number.parseFloat(trimmed.replace(",", "."));
        if (!Number.isFinite(parsed)) return null;
        if (parsed < 0) return null;
        return parsed;
    }

    return null;
}

function getOrCreate<K, V>(map: Map<K, V>, key: K, create: () => V): V {
    const existing = map.get(key);
    if (existing) {
        return existing;
    }
    const next = create();
    map.set(key, next);
    return next;
}

/**
 * Map indexGlobal [0..100] to a level (0–4) based on standard quintiles.
 * Quintiles standards (alignés sur Numbeo Crime Index et méthodologies académiques).
 * Référence: doc/RESEARCH-security-index-methodologies.md
 * 
 * - indexGlobal 0–19   → level = 0 ("Très faible" / Very Low)
 * - indexGlobal 20–39  → level = 1 ("Faible" / Low)
 * - indexGlobal 40–59  → level = 2 ("Modéré" / Moderate)
 * - indexGlobal 60–79  → level = 3 ("Élevé" / High)
 * - indexGlobal 80–100 → level = 4 ("Plus élevé" / Very High)
 * - null or invalid    → level = 0 ("Très faible")
 */
function mapIndexToLevel(indexGlobal: number | null): number {
    if (indexGlobal === null || !Number.isFinite(indexGlobal)) {
        return 0;
    }

    // Quintiles standards (alignés sur Numbeo Crime Index et méthodologies académiques)
    // Référence: doc/RESEARCH-security-index-methodologies.md
    if (indexGlobal < 20) return 0;  // [0-20)   = Très bas (Very Low)
    if (indexGlobal < 40) return 1;  // [20-40)  = Bas (Low)
    if (indexGlobal < 60) return 2;  // [40-60)  = Moyen (Moderate)
    if (indexGlobal < 80) return 3;  // [60-80)  = Haut (High)
    return 4;  // [80-100] = Très haut (Very High)
}
