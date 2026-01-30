import { parse } from "csv-parse";
import type { Db } from "@choisir-sa-ville/db";
import {
  COMMUNE_KEYS,
  DEFAULT_LOG_EVERY,
  LAT_KEYS,
  LON_KEYS,
  POSTAL_BATCH_SIZE,
  POSTAL_KEYS
} from "./constants.js";
import { detectDelimiter, openCsvStream } from "../shared/csv.js";
import { normalizeRecord, resolveColumn } from "../shared/record.js";
import {
  loadCommuneState,
  flushPostalBatch,
  updateCommuneCoordinates,
  type CoordinateAggregate,
  type CommunePostalCodeInsert
} from "./db.js";
import {
  normalizeCommuneCode,
  normalizePostalCode,
  parseCoordinate,
  splitPostalValues
} from "./normalize.js";
import { summarizeSkips } from "./stats.js";

export type PostalImportOptions = {
  sourcePath: string;
  delimiter?: string;
  dryRun: boolean;
  limit?: number;
  logEvery?: number;
};

export type PostalImportStats = {
  rowsRead: number;
  validPairs: number;
  uniquePairs: number;
  attemptedInserts: number;
  insertedPairs?: number;
  duplicatesRemoved: number;
  skipped: Record<string, number>;
};

function isPrematureCloseError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  return code === "ERR_STREAM_PREMATURE_CLOSE";
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

  const communeState = db ? await loadCommuneState(db) : null;
  const communeCodes = communeState?.communeCodes ?? null;
  const missingCoordinateCodes = communeState?.missingCoordinateCodes ?? null;
  const batch = new Map<string, CommunePostalCodeInsert>();
  const coordinateCandidates = new Map<string, CoordinateAggregate>();
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
  let latKey: string | null = null;
  let lonKey: string | null = null;
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
      if (!latKey) {
        latKey = resolveColumn(normalized, LAT_KEYS);
      }
      if (!lonKey) {
        lonKey = resolveColumn(normalized, LON_KEYS);
      }
      if (!loggedColumns && communeKey && postalKey) {
        console.log(`Postal columns: commune=${communeKey}, postal=${postalKey}`);
        loggedColumns = true;
      }

      const rawCommune = communeKey ? normalized[communeKey] : undefined;
      if (!rawCommune) {
        skipped.missing_commune = (skipped.missing_commune ?? 0) + 1;
        continue;
      }

      const communeCode = normalizeCommuneCode(rawCommune);
      if (!communeCode) {
        skipped.invalid_commune = (skipped.invalid_commune ?? 0) + 1;
        continue;
      }

      if (communeCodes && !communeCodes.has(communeCode)) {
        skipped.unknown_commune = (skipped.unknown_commune ?? 0) + 1;
        continue;
      }

      if (latKey && lonKey) {
        const rawLat = normalized[latKey];
        const rawLon = normalized[lonKey];
        const lat = parseCoordinate(rawLat);
        const lon = parseCoordinate(rawLon);
        if (lat !== null && lon !== null) {
          const canUpdate =
            !missingCoordinateCodes || missingCoordinateCodes.has(communeCode);
          if (canUpdate) {
            const aggregate = coordinateCandidates.get(communeCode) ?? {
              sumLat: 0,
              sumLon: 0,
              count: 0
            };
            aggregate.sumLat += lat;
            aggregate.sumLon += lon;
            aggregate.count += 1;
            coordinateCandidates.set(communeCode, aggregate);
          }
        }
      }

      const rawPostal = postalKey ? normalized[postalKey] : undefined;
      if (!rawPostal) {
        skipped.missing_postal = (skipped.missing_postal ?? 0) + 1;
        continue;
      }

      const postalValues = splitPostalValues(rawPostal);
      let hasValidPostal = false;

      for (const postalValue of postalValues) {
        const postalCode = normalizePostalCode(postalValue);
        if (!postalCode) {
          skipped.invalid_postal = (skipped.invalid_postal ?? 0) + 1;
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

      if (batch.size >= POSTAL_BATCH_SIZE) {
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

  const updatedCommunes = await updateCommuneCoordinates(
    db,
    coordinateCandidates,
    options.dryRun
  );
  if (options.dryRun || !db) {
    console.log(
      `Postal coordinates: would update ${updatedCommunes} commune(s) with lat/lon.`
    );
  } else {
    console.log(`Postal coordinates: updated ${updatedCommunes} commune(s) with lat/lon.`);
  }

  return stats;
}
