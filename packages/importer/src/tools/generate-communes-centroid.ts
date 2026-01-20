import { promises as fs } from "node:fs";
import path from "node:path";
import { parse } from "csv-parse";
import { detectDelimiter, openCsvStream } from "../insee/csv-utils.js";
import {
  normalizeInseeCode,
  normalizeRecord,
  parseNumber,
  pickValue
} from "../insee/normalize.js";

const INPUT_PATH = path.resolve(process.cwd(), "data/sources/admin-express-communes.csv");
const OUTPUT_PATH = path.resolve(process.cwd(), "data/coords/communes-centroid.csv");
const SOURCE_LABEL = "admin_express";

const CODE_KEYS = [
  "code_insee",
  "insee_code",
  "code_commune_insee",
  "code_commune",
  "commune_code",
  "com",
  "codgeo"
];
const DEPARTMENT_KEYS = ["code_departement", "code_dept", "dep", "departement"];
const LAT_KEYS = ["lat", "latitude", "latitude_deg", "centroid_lat", "y"];
const LON_KEYS = ["lon", "longitude", "longitude_deg", "centroid_lon", "x"];

async function assertInputExists(filePath: string): Promise<void> {
  try {
    await fs.access(filePath);
  } catch {
    throw new Error(`Missing offline source file at ${filePath}`);
  }
}

async function main(): Promise<void> {
  await assertInputExists(INPUT_PATH);
  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });

  const delimiter = await detectDelimiter(INPUT_PATH);
  const { stream } = await openCsvStream(INPUT_PATH);
  const parser = parse({
    columns: true,
    delimiter,
    bom: true,
    trim: true,
    relax_column_count: true,
    skip_empty_lines: true
  });
  stream.pipe(parser);

  const seen = new Set<string>();
  const duplicates = new Set<string>();
  const filledFromDuplicate = new Set<string>();
  const missingCoords: string[] = [];
  const invalidCoords: string[] = [];
  const missingDepartment: string[] = [];
  const globalFallback: string[] = [];
  const rows = new Map<
    string,
    { code: string; lat: number | null; lon: number | null; department: string | null }
  >();
  const departmentSums = new Map<string, { sumLat: number; sumLon: number; count: number }>();

  for await (const record of parser) {
    const normalized = normalizeRecord(record as Record<string, string>);
    const code = normalizeInseeCode(pickValue(normalized, CODE_KEYS));
    if (!code) continue;

    const lat = parseNumber(pickValue(normalized, LAT_KEYS));
    const lon = parseNumber(pickValue(normalized, LON_KEYS));
    const department = pickValue(normalized, DEPARTMENT_KEYS) ?? null;

    const existing = rows.get(code);
    if (existing) {
      duplicates.add(code);
      if (existing.lat === null || existing.lon === null) {
        if (lat !== null && lon !== null) {
          existing.lat = lat;
          existing.lon = lon;
          filledFromDuplicate.add(code);
        }
      }
      if (!existing.department && department) {
        existing.department = department;
      }
      continue;
    }

    rows.set(code, { code, lat, lon, department });
    seen.add(code);

    if (lat !== null && lon !== null) {
      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lon) ||
        lat < -90 ||
        lat > 90 ||
        lon < -180 ||
        lon > 180
      ) {
        invalidCoords.push(code);
      }
    }
  }

  let globalSumLat = 0;
  let globalSumLon = 0;
  let globalCount = 0;
  for (const row of rows.values()) {
    if (row.lat === null || row.lon === null) continue;
    if (!row.department) continue;
    const stat = departmentSums.get(row.department) ?? { sumLat: 0, sumLon: 0, count: 0 };
    stat.sumLat += row.lat;
    stat.sumLon += row.lon;
    stat.count += 1;
    departmentSums.set(row.department, stat);

    globalSumLat += row.lat;
    globalSumLon += row.lon;
    globalCount += 1;
  }

  const globalCentroid =
    globalCount > 0 ? { lat: globalSumLat / globalCount, lon: globalSumLon / globalCount } : null;

  for (const row of rows.values()) {
    if (row.lat !== null && row.lon !== null) continue;
    if (!row.department) {
      if (globalCentroid) {
        row.lat = globalCentroid.lat;
        row.lon = globalCentroid.lon;
        globalFallback.push(row.code);
        continue;
      }
      missingDepartment.push(row.code);
      continue;
    }
    const dept = departmentSums.get(row.department);
    if (!dept || dept.count === 0) {
      if (globalCentroid) {
        row.lat = globalCentroid.lat;
        row.lon = globalCentroid.lon;
        globalFallback.push(row.code);
        continue;
      }
      missingDepartment.push(row.code);
      continue;
    }
    row.lat = dept.sumLat / dept.count;
    row.lon = dept.sumLon / dept.count;
    missingCoords.push(row.code);
  }

  for (const row of rows.values()) {
    if (row.lat === null || row.lon === null) continue;
    if (!Number.isFinite(row.lat) || !Number.isFinite(row.lon) || row.lat < -90 || row.lat > 90 || row.lon < -180 || row.lon > 180) {
      invalidCoords.push(row.code);
    }
  }

  if (invalidCoords.length > 0 || missingDepartment.length > 0) {
    const parts: string[] = [];
    if (invalidCoords.length > 0) {
      parts.push(`invalid coords for ${invalidCoords.length} code(s): ${invalidCoords.slice(0, 50).join(", ")}`);
    }
    if (missingDepartment.length > 0) {
      parts.push(
        `unable to derive coords for ${missingDepartment.length} code(s) (missing department or centroid): ${missingDepartment
          .slice(0, 50)
          .join(", ")}`
      );
    }
    throw new Error(`Offline source validation failed: ${parts.join(" | ")}`);
  }

  const lines = ["code_insee,lat,lon,source"];
  const sortedRows = Array.from(rows.values()).sort((a, b) => a.code.localeCompare(b.code));
  for (const row of sortedRows) {
    if (row.lat === null || row.lon === null) continue;
    lines.push(
      `${row.code},${row.lat.toString()},${row.lon.toString()},${SOURCE_LABEL}`
    );
  }

  await fs.writeFile(OUTPUT_PATH, `${lines.join("\n")}\n`, "ascii");

  if (duplicates.size > 0) {
    console.warn(
      `Warning: ${duplicates.size} duplicate code(s) ignored (kept first). Examples: ${Array.from(
        duplicates
      )
        .slice(0, 10)
        .join(", ")}`
    );
  }
  if (filledFromDuplicate.size > 0) {
    console.warn(
      `Warning: filled ${filledFromDuplicate.size} code(s) from duplicate rows. Examples: ${Array.from(
        filledFromDuplicate
      )
        .slice(0, 10)
        .join(", ")}`
    );
  }
  if (missingCoords.length > 0) {
    console.warn(
      `Warning: derived ${missingCoords.length} code(s) from department centroids. Examples: ${missingCoords
        .slice(0, 10)
        .join(", ")}`
    );
  }
  if (globalFallback.length > 0) {
    console.warn(
      `Warning: derived ${globalFallback.length} code(s) from global centroid. Examples: ${globalFallback
        .slice(0, 10)
        .join(", ")}`
    );
  }

  console.log(`Wrote ${OUTPUT_PATH} with ${sortedRows.length} rows.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
