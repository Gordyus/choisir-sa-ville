import dotenv from "dotenv";
import path from "node:path";
import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import { parse } from "csv-parse";
import { z } from "zod";
import { createDb, upsertGeoAggregateValuesBatch } from "../index.js";
import { hashAggregateParams, hashAggregateParamsFamily } from "@csv/core";
import {
  chooseRentResource,
  discoverLatestRentDataset,
  downloadAndCacheRentResource,
  resolveDatasetQuery
} from "./datagouv-rent-latest.js";

// Usage: pnpm -C packages/db import:rent:latest [--year=2025]

dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required to import rent data.");
}

const args = new Map<string, string>();
for (const raw of process.argv.slice(2)) {
  if (raw.startsWith("--")) {
    const [key, value] = raw.replace(/^--/, "").split("=");
    args.set(key, value ?? "true");
  }
}

const forcedYear = args.has("year") ? Number(args.get("year")) : undefined;
if (forcedYear !== undefined && !Number.isFinite(forcedYear)) {
  throw new Error(`Invalid --year value: ${args.get("year")}`);
}

const ATTRIBUTION =
  "« Estimations ANIL, à partir des données du Groupe SeLoger et de leboncoin ».";

const AGGREGATE_ID = "rent.v1";
const GEO_LEVEL = "commune";
const BATCH_SIZE = 1000;

const RowSchema = z.object({
  geoCode: z.string().length(5),
  rentMedianPerM2: z.number().finite().positive(),
  rentP25PerM2: z.number().finite().positive().optional().nullable(),
  rentP75PerM2: z.number().finite().positive().optional().nullable(),
  rentMinPerM2: z.number().finite().positive().optional().nullable(),
  rentMaxPerM2: z.number().finite().positive().optional().nullable(),
  rentPredLowerPerM2: z.number().finite().positive().optional().nullable(),
  rentPredUpperPerM2: z.number().finite().positive().optional().nullable()
});

type ParsedRow = z.infer<typeof RowSchema>;

const MetaSchema = z.object({
  nbobs_com: z.number().int().min(0).optional().nullable(),
  nbobs_mail: z.number().int().min(0).optional().nullable(),
  r2_adj: z.number().min(0).max(1).optional().nullable(),
  typPred: z.string().optional().nullable()
});

type MetaRow = z.infer<typeof MetaSchema>;

const COLUMN_CANDIDATES: Record<string, string[]> = {
  geoCode: [
    "geocode",
    "codeinsee",
    "insee",
    "inseecode",
    "codgeo",
    "codecommune",
    "codecommuneinsee",
    "code_commune_insee",
    "inseec",
    "insee_c",
    "inseecom"
  ],
  rentMedianPerM2: [
    "rentmedianperm2",
    "rentmedianm2",
    "rentmedian",
    "loyermedianm2",
    "loyermedian",
    "median",
    "mediane",
    "loypredm2",
    "loyer_median_m2",
    "loyermedian"
  ],
  rentP25PerM2: ["rentp25perm2", "rentp25", "p25", "loyerp25", "loyer_p25_m2", "p25_m2"],
  rentP75PerM2: ["rentp75perm2", "rentp75", "p75", "loyerp75", "loyer_p75_m2", "p75_m2"],
  rentMinPerM2: ["rentminperm2", "rentmin", "min", "loyermin"],
  rentMaxPerM2: ["rentmaxperm2", "rentmax", "max", "loyermax"],
  rentPredLowerPerM2: [
    "rentpredlowerperm2",
    "lwripm2",
    "lwr_ipm2",
    "loweripm2",
    "lower_ip_m2"
  ],
  rentPredUpperPerM2: [
    "rentpredupperm2",
    "upripm2",
    "upr_ipm2",
    "upperipm2",
    "upper_ip_m2"
  ],
  nbobs_com: ["nbobscom", "nbobs_com"],
  nbobs_mail: ["nbobsmail", "nbobs_mail"],
  r2_adj: ["r2adj", "r2_adj"],
  typPred: ["typpred"]
};

const stats = {
  processed: 0,
  inserted: 0,
  updated: 0,
  invalid: 0,
  warnings: 0,
  metaWarnings: 0
};
const invalidSamples: string[] = [];

const db = createDb(DATABASE_URL);

const dataset = await discoverLatestRentDataset({ year: forcedYear });
if (!dataset.year) {
  throw new Error(`Unable to determine dataset year for ${dataset.title}.`);
}

const resource = chooseRentResource(dataset);
const cached = await downloadAndCacheRentResource(dataset, resource);
const csvPath = cached.extractedCsvPath ?? cached.filePath;

const params = { year: dataset.year, segmentKey: "ALL_ALL" };
const paramsHash = await hashAggregateParams(params);
const paramsFamilyHash = await hashAggregateParamsFamily(params);

const existingCodes = new Set(
  (
    await db
      .selectFrom("geo_aggregate_values")
      .select("geoCode")
      .where("aggregateId", "=", AGGREGATE_ID)
      .where("periodYear", "=", dataset.year)
      .where("geoLevel", "=", GEO_LEVEL)
      .where("paramsHash", "=", paramsHash)
      .execute()
  ).map((row) => row.geoCode)
);

await assertFileExists(csvPath);

const delimiter = await detectDelimiter(csvPath);

const parser = createReadStream(csvPath).pipe(
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

console.log(
  `Rent dataset query="${resolveDatasetQuery()}" selected="${dataset.title}" year=${dataset.year} datasetId=${dataset.datasetId}`
);
console.log(
  `Resource selected: ${resource.resourceId} format=${resource.format} cached=${cached.cached}`
);

for await (const record of parser) {
  stats.processed += 1;
  if (!columnMap) {
    columnMap = resolveColumnMap(Object.keys(record));
    logColumnMap(columnMap);
  }

  const parsed = parseRecord(record as Record<string, string>, columnMap);
  const validated = RowSchema.safeParse(parsed.row);
  if (!validated.success) {
    stats.invalid += 1;
    if (invalidSamples.length < 20) {
      invalidSamples.push(
        formatInvalidSample(stats.processed, validated.error.issues, record as Record<string, string>)
      );
    }
    continue;
  }

  if (parsed.metaWarning) {
    stats.metaWarnings += 1;
  }

  if (!isQuartileOrderValid(validated.data)) {
    stats.warnings += 1;
    console.warn(
      `Quartile mismatch for ${validated.data.geoCode}: p25=${validated.data.rentP25PerM2}, median=${validated.data.rentMedianPerM2}, p75=${validated.data.rentP75PerM2}`
    );
  }

  const payload = buildPayload(validated.data, ATTRIBUTION, parsed.meta);

  batch.push({
    aggregateId: AGGREGATE_ID,
    periodYear: dataset.year,
    geoLevel: GEO_LEVEL,
    geoCode: validated.data.geoCode,
    paramsHash,
    paramsFamilyHash,
    source: "anil.rent.ads",
    sourceVersion: String(dataset.year),
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
  `Rent import complete. processed=${stats.processed} inserted=${stats.inserted} updated=${stats.updated} invalid=${stats.invalid} warnings=${stats.warnings} metaWarnings=${stats.metaWarnings}`
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
      `Missing required columns in ${csvPath}. Expected at least geoCode and rentMedianPerM2. Detected columns: ${headers.join(
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
): { row: ParsedRow; meta: MetaRow | null; metaWarning: boolean } {
  const geoCode = normalizeGeoCode(record[map.geoCode]);
  const row: ParsedRow = {
    geoCode,
    rentMedianPerM2: parseNumber(record[map.rentMedianPerM2]),
    rentP25PerM2: parseNumberOptional(record[map.rentP25PerM2]),
    rentP75PerM2: parseNumberOptional(record[map.rentP75PerM2]),
    rentMinPerM2: parseNumberOptional(record[map.rentMinPerM2]),
    rentMaxPerM2: parseNumberOptional(record[map.rentMaxPerM2]),
    rentPredLowerPerM2: parseNumberOptional(record[map.rentPredLowerPerM2]),
    rentPredUpperPerM2: parseNumberOptional(record[map.rentPredUpperPerM2])
  };

  const { meta, metaWarning } = parseMeta(record, map);
  return { row, meta, metaWarning };
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

function parseStringOptional(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseMeta(
  record: Record<string, string>,
  map: Record<string, string>
): { meta: MetaRow | null; metaWarning: boolean } {
  const candidate: MetaRow = {
    nbobs_com: parseNumberOptional(record[map.nbobs_com]),
    nbobs_mail: parseNumberOptional(record[map.nbobs_mail]),
    r2_adj: parseNumberOptional(record[map.r2_adj]),
    typPred: parseStringOptional(record[map.typPred])
  };

  const hasMetaValue = Object.values(candidate).some(
    (value) => value !== null && value !== undefined
  );
  if (!hasMetaValue) {
    return { meta: null, metaWarning: true };
  }

  const validated = MetaSchema.safeParse(candidate);
  if (!validated.success) {
    return { meta: null, metaWarning: true };
  }

  return { meta: validated.data, metaWarning: false };
}

function buildPayload(
  row: ParsedRow,
  attribution: string,
  meta: MetaRow | null
): {
  rentMedianPerM2: number;
  rentP25PerM2: number | null;
  rentP75PerM2: number | null;
  rentMinPerM2: number | null;
  rentMaxPerM2: number | null;
  rentPredLowerPerM2: number | null;
  rentPredUpperPerM2: number | null;
  _meta?: {
    attribution: string;
    nbobs_com?: number;
    nbobs_mail?: number;
    r2_adj?: number;
    typPred?: string;
  };
} {
  const metaPayload = buildMeta(meta, attribution);
  return {
    rentMedianPerM2: row.rentMedianPerM2,
    rentP25PerM2: row.rentP25PerM2 ?? null,
    rentP75PerM2: row.rentP75PerM2 ?? null,
    rentMinPerM2: row.rentMinPerM2 ?? null,
    rentMaxPerM2: row.rentMaxPerM2 ?? null,
    rentPredLowerPerM2: row.rentPredLowerPerM2 ?? null,
    rentPredUpperPerM2: row.rentPredUpperPerM2 ?? null,
    ...(metaPayload ? { _meta: metaPayload } : {})
  };
}

function buildMeta(
  meta: MetaRow | null,
  attribution: string
): {
  attribution: string;
  nbobs_com?: number;
  nbobs_mail?: number;
  r2_adj?: number;
  typPred?: string;
} | null {
  const metaPayload: {
    attribution: string;
    nbobs_com?: number;
    nbobs_mail?: number;
    r2_adj?: number;
    typPred?: string;
  } = { attribution };

  if (meta && typeof meta.nbobs_com === "number") metaPayload.nbobs_com = meta.nbobs_com;
  if (meta && typeof meta.nbobs_mail === "number") metaPayload.nbobs_mail = meta.nbobs_mail;
  if (meta && typeof meta.r2_adj === "number") metaPayload.r2_adj = meta.r2_adj;
  if (meta?.typPred) metaPayload.typPred = meta.typPred;

  return metaPayload;
}

function isQuartileOrderValid(row: ParsedRow): boolean {
  if (row.rentP25PerM2 === null || row.rentP75PerM2 === null) return true;
  return row.rentP25PerM2 <= row.rentMedianPerM2 && row.rentMedianPerM2 <= row.rentP75PerM2;
}

function formatInvalidSample(
  rowNumber: number,
  issues: Array<{ path: Array<string | number>; message: string }>,
  record: Record<string, string>
): string {
  const issuesSummary = issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
  const raw = safeStringify(record, 800);
  return `Row ${rowNumber}: ${issuesSummary} | raw=${raw}`;
}

function safeStringify(value: unknown, maxLength: number): string {
  try {
    const serialized = JSON.stringify(value);
    if (serialized.length <= maxLength) return serialized;
    return `${serialized.slice(0, maxLength)}…`;
  } catch {
    return "[unserializable]";
  }
}

async function assertFileExists(filePath: string): Promise<void> {
  try {
    await access(filePath);
  } catch {
    throw new Error(`Missing rent CSV at ${filePath}.`);
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






