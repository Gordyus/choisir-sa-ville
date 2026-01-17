import { parse } from "csv-parse";
import type { Db, Database } from "@csv/db";
import type { Insertable } from "kysely";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import { Readable } from "node:stream";
import unzipper from "unzipper";

type CommunePostalCodeInsert = Insertable<Database["commune_postal_code"]>;

export type PostalImportOptions = {
  sourcePath: string;
  delimiter?: string;
  dryRun: boolean;
  limit?: number;
  logEvery?: number;
};

type PostalImportStats = {
  rowsRead: number;
  validPairs: number;
  uniquePairs: number;
  attemptedInserts: number;
  insertedPairs?: number;
  duplicatesRemoved: number;
  skipped: Record<string, number>;
};

const COMMUNE_KEYS = [
  "code_commune_insee",
  "inseeCode",
  "code_insee",
  "codeinsee",
  "com",
  "code_commune"
].map((key) => key.toLowerCase());

const POSTAL_KEYS = [
  "code_postal",
  "postalCode",
  "postal_code",
  "codepostal",
  "cp"
].map((key) => key.toLowerCase());

const DEFAULT_LOG_EVERY = 50000;

function isPrematureCloseError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  return code === "ERR_STREAM_PREMATURE_CLOSE";
}

function normalizeRecord(record: Record<string, string>): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    normalized[key.trim().toLowerCase()] = typeof value === "string" ? value.trim() : value;
  }
  return normalized;
}

function resolveColumn(record: Record<string, string>, keys: string[]): string | null {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      return key;
    }
  }
  return null;
}

function normalizeCommuneCode(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const padded = trimmed.padStart(5, "0");
  if (!/^\d{5}$/.test(padded)) return null;
  return padded;
}

function normalizePostalCode(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const padded = trimmed.padStart(5, "0");
  if (!/^\d{5}$/.test(padded)) return null;
  return padded;
}

function splitPostalValues(value: string): string[] {
  if (/[;,/|]/.test(value)) {
    return value
      .split(/[;,/|]/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  return [value.trim()];
}

async function openCsvStream(filePath: string): Promise<{
  stream: Readable;
  entryName?: string;
}> {
  if (filePath.toLowerCase().endsWith(".zip")) {
    const directory = await unzipper.Open.file(filePath);
    const entry = directory.files.find(
      (file) => file.type === "File" && file.path.toLowerCase().endsWith(".csv")
    );
    if (!entry) {
      throw new Error("No CSV file found in zip archive");
    }
    return { stream: entry.stream() as Readable, entryName: entry.path };
  }
  return { stream: fs.createReadStream(filePath) };
}

async function detectDelimiter(filePath: string): Promise<string> {
  if (!filePath.toLowerCase().endsWith(".zip")) {
    const handle = await fsPromises.open(filePath, "r");
    const buffer = Buffer.alloc(4096);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    await handle.close();

    const sample = buffer.toString("utf8", 0, bytesRead);
    const firstLine = sample.split(/\r?\n/)[0] ?? "";
    const semicolons = (firstLine.match(/;/g) ?? []).length;
    const commas = (firstLine.match(/,/g) ?? []).length;

    return semicolons >= commas ? ";" : ",";
  }

  const { stream } = await openCsvStream(filePath);
  let buffer = "";
  for await (const chunk of stream) {
    buffer += chunk.toString("utf8");
    const newlineIndex = buffer.indexOf("\n");
    if (newlineIndex !== -1) {
      stream.destroy();
      break;
    }
    if (buffer.length > 4096) {
      stream.destroy();
      break;
    }
  }
  const firstLine = buffer.split(/\r?\n/)[0] ?? "";
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  return semicolons >= commas ? ";" : ",";
}

async function loadCommuneCodes(db: Db): Promise<Set<string>> {
  const rows = await db.selectFrom("commune").select("inseeCode").execute();
  return new Set(rows.map((row) => row.inseeCode));
}

async function flushPostalBatch(
  db: Db | null,
  batch: Map<string, CommunePostalCodeInsert>,
  dryRun: boolean
): Promise<{ attempted: number; inserted?: number }> {
  if (batch.size === 0) return { attempted: 0 };

  const values = Array.from(batch.values());
  batch.clear();

  if (dryRun) return { attempted: values.length };
  if (!db) throw new Error("Database connection is not initialized.");

  const result = await db
    .insertInto("commune_postal_code")
    .values(values)
    .onConflict((oc) => oc.columns(["communeCode", "postalCode"]).doNothing())
    .execute();

  let inserted: number | undefined;
  for (const item of result as Array<{ numInsertedOrUpdatedRows?: bigint }>) {
    if (item?.numInsertedOrUpdatedRows !== undefined) {
      const value = Number(item.numInsertedOrUpdatedRows);
      if (!Number.isNaN(value)) {
        inserted = (inserted ?? 0) + value;
      }
    }
  }

  return { attempted: values.length, inserted };
}

function summarizeSkips(skipped: Record<string, number>): string {
  const entries = Object.entries(skipped).sort((a, b) => b[1] - a[1]);
  return entries
    .slice(0, 5)
    .map(([reason, count]) => `${reason}=${count}`)
    .join(", ");
}

export async function importPostalCodes(
  db: Db | null,
  options: PostalImportOptions
): Promise<PostalImportStats> {
  const delimiter = options.delimiter ?? (await detectDelimiter(options.sourcePath));
  const { stream, entryName } = await openCsvStream(options.sourcePath);
  if (entryName) {
    console.log(`Using CSV entry: ${entryName}`);
  }

  const parser = parse({
    columns: true,
    delimiter,
    bom: true,
    trim: true,
    relax_column_count: true,
    skip_empty_lines: true
  });

  stream.pipe(parser);

  const communeCodes = db ? await loadCommuneCodes(db) : null;
  const batch = new Map<string, CommunePostalCodeInsert>();
  const skipped: Record<string, number> = {
    missing_commune: 0,
    invalid_commune: 0,
    unknown_commune: 0,
    missing_postal: 0,
    invalid_postal: 0
  };

  const stats: PostalImportStats = {
    rowsRead: 0,
    validPairs: 0,
    uniquePairs: 0,
    attemptedInserts: 0,
    duplicatesRemoved: 0,
    skipped
  };

  const logEvery = options.logEvery ?? DEFAULT_LOG_EVERY;
  let communeKey: string | null = null;
  let postalKey: string | null = null;
  let loggedColumns = false;
  const samples: Array<{ communeCode: string; postalCode: string }> = [];

  let aborted = false;

  try {
    for await (const record of parser) {
      stats.rowsRead += 1;
      const normalized = normalizeRecord(record as Record<string, string>);

      if (!communeKey) {
        communeKey = resolveColumn(normalized, COMMUNE_KEYS);
      }
      if (!postalKey) {
        postalKey = resolveColumn(normalized, POSTAL_KEYS);
      }
      if (!loggedColumns && communeKey && postalKey) {
        console.log(`Postal columns: commune=${communeKey}, postal=${postalKey}`);
        loggedColumns = true;
      }

      const rawCommune = communeKey ? normalized[communeKey] : undefined;
      if (!rawCommune) {
        skipped.missing_commune += 1;
        continue;
      }

      const communeCode = normalizeCommuneCode(rawCommune);
      if (!communeCode) {
        skipped.invalid_commune += 1;
        continue;
      }

      if (communeCodes && !communeCodes.has(communeCode)) {
        skipped.unknown_commune += 1;
        continue;
      }

      const rawPostal = postalKey ? normalized[postalKey] : undefined;
      if (!rawPostal) {
        skipped.missing_postal += 1;
        continue;
      }

      const postalValues = splitPostalValues(rawPostal);
      let hasValidPostal = false;

      for (const postalValue of postalValues) {
        const postalCode = normalizePostalCode(postalValue);
        if (!postalCode) {
          skipped.invalid_postal += 1;
          continue;
        }

        hasValidPostal = true;
        stats.validPairs += 1;
        const key = `${communeCode}:${postalCode}`;
        if (batch.has(key)) {
          stats.duplicatesRemoved += 1;
        } else {
          batch.set(key, { communeCode, postalCode });
        }
        if (samples.length < 5) {
          samples.push({ communeCode, postalCode });
        }

        if (options.limit && stats.validPairs >= options.limit) {
          aborted = true;
          break;
        }
      }

      if (aborted) {
        stream.unpipe(parser);
        stream.destroy();
        parser.end();
        break;
      }

      if (!hasValidPostal) {
        continue;
      }

      if (batch.size >= 500) {
        const { attempted, inserted } = await flushPostalBatch(db, batch, options.dryRun);
        stats.uniquePairs += attempted;
        stats.attemptedInserts += attempted;
        if (inserted !== undefined) {
          stats.insertedPairs = (stats.insertedPairs ?? 0) + inserted;
        }
      }

      if (stats.rowsRead % logEvery === 0) {
        console.log(
          `Postal pass: ${stats.rowsRead} rows (valid ${stats.validPairs}, unique ${stats.uniquePairs}, skipped ${Object.values(skipped).reduce((a, b) => a + b, 0)}, batchDup ${stats.duplicatesRemoved})`
        );
      }
    }
  } catch (error) {
    if (!aborted || !isPrematureCloseError(error)) {
      throw error;
    }
  }

  if (!loggedColumns) {
    console.log(
      `Postal columns: commune=${communeKey ?? "unknown"}, postal=${postalKey ?? "unknown"}`
    );
  }

  const { attempted, inserted } = await flushPostalBatch(db, batch, options.dryRun);
  stats.uniquePairs += attempted;
  stats.attemptedInserts += attempted;
  if (inserted !== undefined) {
    stats.insertedPairs = (stats.insertedPairs ?? 0) + inserted;
  }

  const skippedTotal = Object.values(skipped).reduce((a, b) => a + b, 0);
  console.log(
    `Postal pass done. Rows: ${stats.rowsRead}. Valid pairs: ${stats.validPairs}. Unique pairs: ${stats.uniquePairs}. Attempted inserts: ${stats.attemptedInserts}. Skipped: ${skippedTotal}. Batch duplicates: ${stats.duplicatesRemoved}.`
  );
  console.log(`Postal skip reasons (top 5): ${summarizeSkips(skipped)}`);
  if (samples.length > 0) {
    console.log(
      `Postal samples (normalized): ${samples
        .map((sample) => `${sample.communeCode}:${sample.postalCode}`)
        .join(", ")}`
    );
  } else {
    console.log("Postal samples (normalized): none");
  }
  if (stats.insertedPairs !== undefined) {
    console.log(`Postal inserted pairs: ${stats.insertedPairs}`);
  } else {
    console.log("Postal inserted pairs: unknown (driver did not return counts)");
  }

  return stats;
}
