import { readFile } from "node:fs/promises";
import path from "node:path";

import { asyncBufferFromFile, parquetMetadataAsync, parquetReadObjects, parquetSchema } from "hyparquet";
import { compressors } from "hyparquet-compressors";

import { SOURCE_URLS } from "../../../constants.js";
import { writeJsonAtomic } from "../../../shared/fileSystem.js";
import { INSECURITY_CATEGORIES, INSECURITY_EPSILON } from "../../../shared/insecurityMetrics.js";
import type { ExportCommune, ExportContext, SourceMeta } from "../../../shared/types.js";

const DEFAULT_EPSILON = INSECURITY_EPSILON;

const EPSILON = (() => {
    const envValue = process.env.CSVV_INSECURITY_INDEXGLOBAL_EPSILON;
    if (envValue !== undefined) {
        const parsed = Number.parseFloat(envValue);
        if (!Number.isFinite(parsed) || parsed < 0) {
            console.warn(`[metrics:insecurity] Invalid CSVV_INSECURITY_INDEXGLOBAL_EPSILON="${envValue}". Using default ${DEFAULT_EPSILON}.`);
            return DEFAULT_EPSILON;
        }
        return parsed;
    }
    return DEFAULT_EPSILON;
})();

const OUTPUT_COLUMNS = [
    "insee",
    "population",
    "violencesPersonnesPer1000",
    "securiteBiensPer1000",
    "tranquillitePer1000",
    "indexGlobal",
    "level"
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
            warnings: [
                "SSMSI mapping is empty. Run inspectSsmsi.ts and populate mapping/ssmsiToGroups.v1.json (groups + categoryKeyColumn)."
            ],
            inferred: { inseeColumn, yearColumn, factsColumn, categoryColumn, populationColumn },
            thresholdsByYear: new Map()
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
            warnings: [
                "SSMSI parquet columns could not be inferred. Run inspectSsmsi.ts and fill mapping/ssmsiToGroups.v1.json."
            ],
            inferred: { inseeColumn, yearColumn, factsColumn, categoryColumn, populationColumn },
            thresholdsByYear: new Map()
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

    // Calculate quartile thresholds per year
    const thresholdsByYear = new Map<number, { q1: number; q2: number; q3: number }>();

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

                const violences = computeRatePer1000(acc?.violencesPersonnes ?? null, population);
                const biens = computeRatePer1000(acc?.securiteBiens ?? null, population);
                const tranquillite = computeRatePer1000(acc?.tranquillite ?? null, population);

                return {
                    insee: commune.insee,
                    population,
                    violencesPersonnesPer1000: violences,
                    securiteBiensPer1000: biens,
                    tranquillitePer1000: tranquillite,
                    scoreRaw: computeRawScore({
                        violencesPersonnesPer1000: violences,
                        securiteBiensPer1000: biens,
                        tranquillitePer1000: tranquillite
                    })
                };
            });

        const scoreValues = rows
            .map((r) => r.scoreRaw)
            .filter((v): v is number => typeof v === "number" && Number.isFinite(v));

        const indexByScore = buildPercentileIndex(scoreValues, EPSILON);

        // Calculate quartiles on scoreRaw > 0
        const thresholds = calculateQuartiles(rows.map((r) => r.scoreRaw));
        thresholdsByYear.set(year, thresholds);

        const tabularRows = rows.map((r) => {
            const indexGlobal = r.scoreRaw === null ? null : indexByScore.get(r.scoreRaw) ?? null;
            const level = mapScoreToLevel(r.scoreRaw, thresholds);
            return [
                r.insee,
                r.population,
                r.violencesPersonnesPer1000,
                r.securiteBiensPer1000,
                r.tranquillitePer1000,
                indexGlobal,
                level
            ] as const;
        });

        const outPath = path.join(targetDir, `${year}.json`);
        await writeJsonAtomic(outPath, {
            year,
            unit: "faits pour 1000 habitants",
            source: "Ministère de l’Intérieur – SSMSI (base communale de la délinquance enregistrée)",
            generatedAtUtc,
            columns: OUTPUT_COLUMNS,
            rows: tabularRows
        });

        files.push(`communes/metrics/insecurity/${year}.json`);
    }

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
        warnings: [],
        inferred: { inseeColumn, yearColumn, factsColumn, categoryColumn, populationColumn },
        thresholdsByYear
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
    const parts: Array<{ value: number; weight: number }> = [];

    // Use centralized weights from config
    const [violencesWeight, biensWeight, tranquilliteWeight] = INSECURITY_CATEGORIES.map(c => c.weight);

    if (values.violencesPersonnesPer1000 !== null) parts.push({ value: values.violencesPersonnesPer1000, weight: violencesWeight });
    if (values.securiteBiensPer1000 !== null) parts.push({ value: values.securiteBiensPer1000, weight: biensWeight });
    if (values.tranquillitePer1000 !== null) parts.push({ value: values.tranquillitePer1000, weight: tranquilliteWeight });

    if (!parts.length) {
        return null;
    }

    const sumWeights = parts.reduce((acc, p) => acc + p.weight, 0);
    if (sumWeights <= 0) {
        return null;
    }

    let score = 0;
    for (const p of parts) {
        score += (p.weight / sumWeights) * p.value;
    }

    return score;
}

/**
 * Build percentile index with epsilon filtering.
 * 
 * Scores ≤ epsilon are assigned indexGlobal=0.
 * Scores > epsilon are ranked among themselves and rescaled to [1..100] using percentile rank.
 * 
 * @param scores - Array of valid scores
 * @param epsilon - Threshold below which scores are assigned index 0 (default: 0)
 * @returns Map from score to indexGlobal
 */
function buildPercentileIndex(scores: number[], epsilon = 0): Map<number, number> {
    const result = new Map<number, number>();
    if (!scores.length) {
        return result;
    }

    // Separate scores into two groups
    const belowOrEqualEpsilon: number[] = [];
    const aboveEpsilon: number[] = [];

    for (const score of scores) {
        if (score <= epsilon) {
            belowOrEqualEpsilon.push(score);
        } else {
            aboveEpsilon.push(score);
        }
    }

    // All scores ≤ epsilon get indexGlobal=0
    for (const score of belowOrEqualEpsilon) {
        if (!result.has(score)) {
            result.set(score, 0);
        }
    }

    // If no scores above epsilon, log warning and return
    if (aboveEpsilon.length === 0) {
        console.warn(`[metrics:insecurity] No scores > ${epsilon} found. All communes will have indexGlobal=0.`);
        return result;
    }

    // Compute percentile rank for scores > epsilon
    const sorted = aboveEpsilon.slice().sort((a, b) => a - b);
    const n = sorted.length;

    // Percent-rank (min-rank) for ties.
    //
    // IMPORTANT: We intentionally do NOT use midrank here.
    // With midrank, if a large number of communes share the minimum score (common with zeros),
    // the minimum percentile is no longer 0, which breaks the expected [0..100] normalization
    // and downstream UX thresholds (quartiles).
    const ranges = new Map<number, { start: number; end: number }>();
    for (let i = 0; i < n; i++) {
        const value = sorted[i]!;
        const existing = ranges.get(value);
        if (!existing) {
            ranges.set(value, { start: i, end: i });
        } else {
            existing.end = i;
        }
    }

    // Rescale to [1..100]
    for (const [value, range] of ranges) {
        const minRank = range.start;
        const percentile = n === 1 ? 1 : minRank / (n - 1);
        const indexGlobal = Math.round(1 + 99 * percentile);
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
    warnings: string[];
    inferred: Record<string, string | null>;
    thresholdsByYear: Map<number, { q1: number; q2: number; q3: number }>;
}): Record<string, unknown> {
    const thresholds: Record<string, { q1: number; q2: number; q3: number; method: string }> = {};
    for (const [year, values] of params.thresholdsByYear) {
        thresholds[String(year)] = {
            q1: values.q1,
            q2: values.q2,
            q3: values.q3,
            method: "quartiles on scoreRaw > 0"
        };
    }

    return {
        source: "Bases statistiques communales de la délinquance enregistrée - SSMSI",
        license: "Licence Ouverte / Etalab",
        geoLevel: "commune",
        fallbackChain: [],
        unit: "faits pour 1000 habitants",
        yearsAvailable: params.yearsAvailable,
        generatedAtUtc: params.generatedAtUtc,
        methodology:
            "Agrégation communale par catégorie, normalisée par population SSMSI (insee_pop, par année).",
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
        thresholds,
        levels: {
            labels: ["Très faible", "Faible", "Modéré", "Élevé", "Plus élevé"],
            method: "Quartile-based classification on non-zero scoreRaw distribution"
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
 * Calculate quartiles (Q1, Q2, Q3) on all scoreRaw values that are > 0.
 * Uses simple linear interpolation.
 * If all scores are 0 or no scores exist, returns { q1: 0, q2: 0, q3: 0 }.
 */
function calculateQuartiles(scores: Array<number | null>): { q1: number; q2: number; q3: number } {
    // Filter to scoreRaw > 0
    const validScores = scores.filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0);

    if (validScores.length === 0) {
        return { q1: 0, q2: 0, q3: 0 };
    }

    // Sort in ascending order
    const sorted = validScores.slice().sort((a, b) => a - b);
    const n = sorted.length;

    const q1 = percentile(sorted, 25);
    const q2 = percentile(sorted, 50);
    const q3 = percentile(sorted, 75);

    return { q1, q2, q3 };
}

/**
 * Calculate the p-th percentile using linear interpolation.
 * @param sortedValues - Array of values sorted in ascending order
 * @param p - Percentile (0-100)
 */
function percentile(sortedValues: number[], p: number): number {
    if (sortedValues.length === 0) return 0;
    if (sortedValues.length === 1) return sortedValues[0]!;

    const n = sortedValues.length;
    const position = (p / 100) * (n - 1);
    const lower = Math.floor(position);
    const upper = Math.ceil(position);

    if (lower === upper) {
        return sortedValues[lower]!;
    }

    const fraction = position - lower;
    const lowerValue = sortedValues[lower]!;
    const upperValue = sortedValues[upper]!;

    return lowerValue + fraction * (upperValue - lowerValue);
}

/**
 * Map scoreRaw to a level (0–4) based on quartile thresholds.
 * - scoreRaw = 0 → level = 0 ("Très faible")
 * - 0 < scoreRaw < Q1 → level = 1 ("Faible")
 * - Q1 ≤ scoreRaw < Q2 → level = 2 ("Modéré")
 * - Q2 ≤ scoreRaw < Q3 → level = 3 ("Élevé")
 * - Q3 ≤ scoreRaw → level = 4 ("Plus élevé")
 */
function mapScoreToLevel(
    scoreRaw: number | null,
    thresholds: { q1: number; q2: number; q3: number }
): number {
    if (scoreRaw === null || !Number.isFinite(scoreRaw)) {
        return 0;
    }

    if (scoreRaw === 0) {
        return 0;
    }

    if (scoreRaw < thresholds.q1) {
        return 1;
    }

    if (scoreRaw < thresholds.q2) {
        return 2;
    }

    if (scoreRaw < thresholds.q3) {
        return 3;
    }

    return 4;
}
