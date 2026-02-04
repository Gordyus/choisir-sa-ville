import path from "node:path";

import { asyncBufferFromFile, parquetMetadataAsync, parquetReadObjects, parquetSchema } from "hyparquet";
import { compressors } from "hyparquet-compressors";

import { SOURCE_URLS } from "../../../constants.js";
import { downloadFile } from "../../../shared/downloadFile.js";

const CACHE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

const INSEE_COLUMN_CANDIDATES = [
    "insee",
    "codgeo",
    "code_commune",
    "codeCommune",
    "com",
    "commune",
    "codeinsee",
    "insee_com"
];

const YEAR_COLUMN_CANDIDATES = ["annee", "year", "millesime", "periode", "periodYear"];

const FACTS_COLUMN_CANDIDATES = [
    "faits",
    "nbfaits",
    "nombre",
    "count",
    "valeur",
    "nb",
    "nombre_faits",
    "nb_faits"
];

const CATEGORY_COLUMN_HINTS = [
    "infraction",
    "categorie",
    "cat",
    "nomen",
    "qualification",
    "nature",
    "classe",
    "libelle",
    "label",
    "code"
];

async function main(): Promise<void> {
    const url = SOURCE_URLS.ssmsi;
    console.info(`[ssmsi:inspect] Downloading parquet (TTL ${CACHE_TTL_MS}ms) from ${url}`);

    const source = await downloadFile(url, { cacheTtlMs: CACHE_TTL_MS });
    console.info(
        `[ssmsi:inspect] Source: ${path.basename(source.filePath)} (fromCache=${source.fromCache}) sha256=${source.checksumSha256.slice(0, 12)}...`
    );

    const file = await asyncBufferFromFile(source.filePath);
    const metadata = await parquetMetadataAsync(file);
    const schema = parquetSchema(metadata);
    const columnNames = schema.children.map((e) => e.element.name);

    console.info(`[ssmsi:inspect] Rows: ${Number(metadata.num_rows)}`);
    console.info(`[ssmsi:inspect] Columns (${columnNames.length}):`);
    for (const col of columnNames) {
        console.info(`- ${col}`);
    }

    const inferredInsee = findColumn(columnNames, INSEE_COLUMN_CANDIDATES);
    const inferredYear = findColumn(columnNames, YEAR_COLUMN_CANDIDATES);
    const inferredFacts = findColumn(columnNames, FACTS_COLUMN_CANDIDATES);
    const categoryCandidates = columnNames
        .filter((c) => CATEGORY_COLUMN_HINTS.some((hint) => normalizeKey(c).includes(hint)))
        .slice(0, 30);

    console.info("[ssmsi:inspect] Inferred columns", {
        insee: inferredInsee,
        year: inferredYear,
        facts: inferredFacts,
        categoryCandidates
    });

    if (categoryCandidates.length) {
        const sampleColumns = [
            inferredInsee,
            inferredYear,
            inferredFacts,
            ...categoryCandidates.slice(0, 3)
        ].filter(Boolean) as string[];

        const rows = await parquetReadObjects({
            file,
            columns: sampleColumns,
            rowStart: 0,
            rowEnd: 2000,
            compressors
        });

        console.info(`[ssmsi:inspect] Sample rows: ${rows.length}`);
        console.info(rows.slice(0, 10));

        for (const col of categoryCandidates.slice(0, 3)) {
            const distinct = new Map<string, number>();
            for (const row of rows) {
                const value = row[col];
                const key = value === null || typeof value === "undefined" ? "<null>" : String(value);
                distinct.set(key, (distinct.get(key) ?? 0) + 1);
            }
            const top = Array.from(distinct.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 25)
                .map(([key, count]) => ({ key, count }));

            console.info(`[ssmsi:inspect] Distinct values for ${col} (top 25 from sample):`);
            console.info(top);
        }
    } else {
        console.info("[ssmsi:inspect] No category-like columns detected via heuristics.");
    }
}

main().catch((error) => {
    console.error("[ssmsi:inspect] Failed", error);
    process.exitCode = 1;
});

function findColumn(columnNames: string[], candidates: string[]): string | null {
    const normalizedToOriginal = new Map(columnNames.map((name) => [normalizeKey(name), name] as const));
    for (const candidate of candidates) {
        const found = normalizedToOriginal.get(normalizeKey(candidate));
        if (found) {
            return found;
        }
    }
    return null;
}

function normalizeKey(value: string): string {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
}
