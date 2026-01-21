import dotenv from "dotenv";
import path from "node:path";
import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import { parse } from "csv-parse";
import { z } from "zod";
import { createDb, upsertGeoAggregateValuesBatch } from "../index.js";
import { hashAggregateParams, hashAggregateParamsFamily } from "@csv/core";

// Usage: pnpm -C packages/db import:rent:2023

dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required to import rent data.");
}

const DATA_FILE = path.resolve(
  process.cwd(),
  "../../data/rent/2023/rent_2023.csv"
);

const SOURCE = "public.rent";
const SOURCE_VERSION = "2023";
const AGGREGATE_ID = "rent.v1";
const PERIOD_YEAR = 2023;
const GEO_LEVEL = "commune";
const PARAMS = { year: 2023, segmentKey: "ALL_ALL" };
const BATCH_SIZE = 1000;

const RowSchema = z.object({
  geoCode: z.string().length(5),
  rentMedianPerM2: z.number().finite().positive(),
  rentP25PerM2: z.number().finite().positive().optional().nullable(),
  rentP75PerM2: z.number().finite().positive().optional().nullable(),
  rentMinPerM2: z.number().finite().positive().optional().nullable(),
  rentMaxPerM2: z.number().finite().positive().optional().nullable()
});

type ParsedRow = z.infer<typeof RowSchema>;

const COLUMN_CANDIDATES: Record<string, string[]> = {
  geoCode: [
    "codeinsee",
    "insee",
    "inseecode",
    "codgeo",
    "codecommune",
    "codecommuneinsee",
    "code_commune_insee"
  ],
  rentMedianPerM2: [
    "rentmedianperm2",
    "rentmedianm2",
    "rentmedian",
    "loyermedianm2",
    "loyermedian",
    "median",
    "mediane"
  ],
  rentP25PerM2: ["rentp25perm2", "rentp25", "p25", "loyerp25"],
  rentP75PerM2: ["rentp75perm2", "rentp75", "p75", "loyerp75"],
  rentMinPerM2: ["rentminperm2", "rentmin", "min", "loyermin"],
  rentMaxPerM2: ["rentmaxperm2", "rentmax", "max", "loyermax"]
};

const paramsHash = await hashAggregateParams(PARAMS);
const paramsFamilyHash = await hashAggregateParamsFamily(PARAMS);

await assertFileExists(DATA_FILE);

const delimiter = await detectDelimiter(DATA_FILE);
const db = createDb(DATABASE_URL);

const stats = {
  processed: 0,
  inserted: 0,
  updated: 0,
  invalid: 0,
  warnings: 0
};
const invalidSamples: string[] = [];

const existingCodes = new Set(
  (
    await db
      .selectFrom("geo_aggregate_values")
      .select("geoCode")
      .where("aggregateId", "=", AGGREGATE_ID)
      .where("periodYear", "=", PERIOD_YEAR)
      .where("geoLevel", "=", GEO_LEVEL)
      .where("paramsHash", "=", paramsHash)
      .execute()
  ).map((row) => row.geoCode)
);

const parser = createReadStream(DATA_FILE).pipe(
  parse({
    columns: true,
    delimiter,
    bom: true,
    trim: true,
    relax_column_count: true,
    skip_empty_lines: true
  })
);

let columnMap: Record<string, string> | null = null;
let batch: Array<{
  aggregateId: string;
  periodYear: number;
  geoLevel: string;
  geoCode: string;
  paramsHash: string;
  paramsFamilyHash: string;
  source: string;
  sourceVersion: string;
  payloadJson: unknown;
}> = [];

for await (const record of parser) {
  stats.processed += 1;
  if (!columnMap) {
    columnMap = resolveColumnMap(Object.keys(record));
    logColumnMap(columnMap);
  }

  const parsed = parseRecord(record as Record<string, string>, columnMap);
  const validated = RowSchema.safeParse(parsed);
  if (!validated.success) {
    stats.invalid += 1;
    if (invalidSamples.length < 20) {
      invalidSamples.push(
        `Row ${stats.processed}: ${validated.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; ")}`
      );
    }
    continue;
  }

  const payload = buildPayload(validated.data);
  if (!isQuartileOrderValid(validated.data)) {
    stats.warnings += 1;
    console.warn(
      `Quartile mismatch for ${validated.data.geoCode}: p25=${validated.data.rentP25PerM2}, median=${validated.data.rentMedianPerM2}, p75=${validated.data.rentP75PerM2}`
    );
  }

  batch.push({
    aggregateId: AGGREGATE_ID,
    periodYear: PERIOD_YEAR,
    geoLevel: GEO_LEVEL,
    geoCode: validated.data.geoCode,
    paramsHash,
    paramsFamilyHash,
    source: SOURCE,
    sourceVersion: SOURCE_VERSION,
    payloadJson: payload
  });
  if (existingCodes.has(validated.data.geoCode)) {
    stats.updated += 1;
  } else {
    stats.inserted += 1;
    existingCodes.add(validated.data.geoCode);
  }

  if (batch.length >= BATCH_SIZE) {
    await upsertGeoAggregateValuesBatch(db, batch);
    batch = [];
  }
}

if (batch.length > 0) {
  await upsertGeoAggregateValuesBatch(db, batch);
}

await db.destroy();

console.log(
  `Rent 2023 import complete. processed=${stats.processed} inserted=${stats.inserted} updated=${stats.updated} invalid=${stats.invalid} warnings=${stats.warnings}`
);
if (invalidSamples.length > 0) {
  console.warn(`Invalid samples:\n- ${invalidSamples.join("\n- ")}`);
}

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function resolveColumnMap(headers: string[]): Record<string, string> {
  const normalized = new Map<string, string>();
  for (const header of headers) {
    normalized.set(normalizeHeader(header), header);
  }

  const map: Record<string, string> = {};
  for (const [key, candidates] of Object.entries(COLUMN_CANDIDATES)) {
    const match = candidates.find((candidate) => normalized.has(candidate));
    if (match) {
      map[key] = normalized.get(match) as string;
    }
  }

  if (!map.geoCode || !map.rentMedianPerM2) {
    throw new Error(
      `Missing required columns in ${DATA_FILE}. Expected at least geoCode and rentMedianPerM2. Detected columns: ${headers.join(
        ", "
      )}`
    );
  }

  return map;
}

function logColumnMap(map: Record<string, string>): void {
  console.log(
    `Import columns: geoCode=${map.geoCode}, median=${map.rentMedianPerM2}, p25=${map.rentP25PerM2 ?? "n/a"}, p75=${map.rentP75PerM2 ?? "n/a"}, min=${map.rentMinPerM2 ?? "n/a"}, max=${map.rentMaxPerM2 ?? "n/a"}`
  );
}

function parseRecord(
  record: Record<string, string>,
  map: Record<string, string>
): ParsedRow {
  const geoCode = normalizeGeoCode(record[map.geoCode]);
  return {
    geoCode,
    rentMedianPerM2: parseNumber(record[map.rentMedianPerM2]),
    rentP25PerM2: parseNumberOptional(record[map.rentP25PerM2]),
    rentP75PerM2: parseNumberOptional(record[map.rentP75PerM2]),
    rentMinPerM2: parseNumberOptional(record[map.rentMinPerM2]),
    rentMaxPerM2: parseNumberOptional(record[map.rentMaxPerM2])
  };
}

function normalizeGeoCode(value: string | undefined): string {
  if (!value) return "";
  const trimmed = value.trim().toUpperCase();
  if (/^\d{4}$/.test(trimmed)) {
    return trimmed.padStart(5, "0");
  }
  return trimmed;
}

function parseNumber(value: string | undefined): number {
  const parsed = parseNumberOptional(value);
  return parsed ?? Number.NaN;
}

function parseNumberOptional(value: string | undefined): number | null {
  if (!value) return null;
  const cleaned = value.replace(/\s/g, "").replace(",", ".");
  if (cleaned === "") return null;
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildPayload(
  row: ParsedRow
): {
  rentMedianPerM2: number;
  rentP25PerM2: number | null;
  rentP75PerM2: number | null;
  rentMinPerM2: number | null;
  rentMaxPerM2: number | null;
} {
  return {
    rentMedianPerM2: row.rentMedianPerM2,
    rentP25PerM2: row.rentP25PerM2 ?? null,
    rentP75PerM2: row.rentP75PerM2 ?? null,
    rentMinPerM2: row.rentMinPerM2 ?? null,
    rentMaxPerM2: row.rentMaxPerM2 ?? null
  };
}

function isQuartileOrderValid(row: ParsedRow): boolean {
  if (row.rentP25PerM2 === null || row.rentP75PerM2 === null) return true;
  return row.rentP25PerM2 <= row.rentMedianPerM2 && row.rentMedianPerM2 <= row.rentP75PerM2;
}

async function assertFileExists(filePath: string): Promise<void> {
  try {
    await access(filePath);
  } catch {
    throw new Error(
      `Missing rent dataset at ${filePath}. Add the 2023 rent CSV before running this importer.`
    );
  }
}

async function detectDelimiter(filePath: string): Promise<string> {
  const header = await readFirstLine(filePath);
  const counts = [
    { delimiter: ",", count: (header.match(/,/g) ?? []).length },
    { delimiter: ";", count: (header.match(/;/g) ?? []).length },
    { delimiter: "\t", count: (header.match(/\t/g) ?? []).length }
  ];
  counts.sort((left, right) => right.count - left.count);
  return counts[0]?.delimiter ?? ",";
}

async function readFirstLine(filePath: string): Promise<string> {
  const stream = createReadStream(filePath, { encoding: "utf-8", highWaterMark: 64 * 1024 });
  let buffer = "";
  for await (const chunk of stream) {
    buffer += chunk;
    const index = buffer.indexOf("\n");
    if (index >= 0) {
      stream.close();
      return buffer.slice(0, index).replace(/\r$/, "");
    }
  }
  return buffer.replace(/\r$/, "");
}
