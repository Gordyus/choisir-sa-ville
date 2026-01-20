import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import path from "node:path";
import test, { after, before } from "node:test";
import dotenv from "dotenv";
import type { Db } from "@csv/db";
import { createDb } from "@csv/db";
import { sql } from "kysely";
import { parse } from "csv-parse";
import { detectDelimiter, openCsvStream } from "./csv-utils.js";
import {
  buildOfflineCoordinateIndex,
  buildPostalCoordinateIndex,
  lookupOfflineCoordinates,
  lookupPostalCoordinates
} from "./geo-derivation.js";
import { normalizeParentInseeCode } from "./mappers.js";
import { normalizeInseeCode, normalizeRecord, pickValue } from "./normalize.js";

// Run: pnpm -C packages/importer test:postimport

type CommuneRow = {
  inseeCode: string;
  name: string;
  lat: number | null;
  lon: number | null;
  geoSource: string | null;
  geoPrecision: string | null;
};

const MAX_CHILD_DISTANCE_KM = 50;
const MAX_CENTROID_DISTANCE_KM = 5;
const KNOWN_HOLES = ["12218", "48166", "49126", "55138", "76095", "76601", "85165", "85212"];
const INHERIT_PARENT_CODES = ["76601", "85165", "85212"];
const EXPECTED_INHERIT_PARENTS: Record<string, string> = {
  "76601": "76012",
  "85165": "85003",
  "85212": "85003"
};
const PARENTS = [
  { code: "75056", label: "Paris", min: 75101, max: 75120 },
  { code: "69123", label: "Lyon", min: 69381, max: 69389 },
  { code: "13055", label: "Marseille", min: 13201, max: 13216 }
];
const CHILD_TYPES = new Set(["ARM", "COMD", "COMA"]);
const PARENT_COLUMN_CANDIDATES = [
  "parentCommuneCode",
  "parent_code_insee",
  "parentCodeInsee",
  "motherCodeInsee",
  "mother_code_insee",
  "arrondissement_of"
];
const COMMUNE_TYPE_CANDIDATES = [
  "type",
  "typecom",
  "commune_kind",
  "communeKind",
  "communeType",
  "kind"
];

type RelationInfo = {
  table: "infra_zone" | "commune";
  parentColumn: string;
  childCodeColumn: string;
  childTypeColumn?: string;
  communeTypeColumn?: string;
};

type RelationChildRow = {
  childCode: string;
  parentCode: string | null;
  childType: string | null;
};

let db: Db;
let communes: CommuneRow[] = [];
let communeByCode = new Map<string, CommuneRow>();
let childCodes = new Set<string>();
let childCoords = new Map<string, { lat: number; lon: number }>();
let relationInfo: RelationInfo;
let relationChildren: RelationChildRow[] = [];
let childrenByParent = new Map<string, RelationChildRow[]>();
let childrenByCode = new Map<string, RelationChildRow[]>();
let communeTypeByCode = new Map<string, string | null>();
let parentCodeByChild = new Map<string, string>();
let postalIndex: Awaited<ReturnType<typeof buildPostalCoordinateIndex>>;
let offlineIndex: Awaited<ReturnType<typeof buildOfflineCoordinateIndex>> | null = null;

function formatCommune(row: CommuneRow): string {
  return `${row.inseeCode} ${row.name} lat=${row.lat} lon=${row.lon} source=${row.geoSource ?? "null"} precision=${row.geoPrecision ?? "null"}`;
}

function buildRange(min: number, max: number): string[] {
  const values: string[] = [];
  for (let code = min; code <= max; code += 1) {
    values.push(String(code).padStart(5, "0"));
  }
  return values;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const r = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return r * c;
}

async function assertFileExists(filePath: string, label: string): Promise<void> {
  try {
    await access(filePath);
  } catch {
    throw new Error(`Missing ${label} at ${filePath}. Run the INSEE import first.`);
  }
}

async function detectRelationInfo(dbConn: Db): Promise<RelationInfo> {
  const result = await sql<{ table_name: string; column_name: string }>`
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('infra_zone', 'commune')
  `.execute(dbConn);

  const columnsByTable = new Map<string, Set<string>>();
  for (const row of result.rows) {
    const set = columnsByTable.get(row.table_name) ?? new Set<string>();
    set.add(row.column_name);
    columnsByTable.set(row.table_name, set);
  }

  const infraColumns = columnsByTable.get("infra_zone") ?? new Set<string>();
  const communeColumns = columnsByTable.get("commune") ?? new Set<string>();
  const communeTypeColumn = COMMUNE_TYPE_CANDIDATES.find((name) =>
    communeColumns.has(name)
  );

  const infraParent = PARENT_COLUMN_CANDIDATES.find((name) => infraColumns.has(name));
  if (infraParent && infraColumns.has("code")) {
    const childTypeColumn = infraColumns.has("type") ? "type" : undefined;
    return {
      table: "infra_zone",
      parentColumn: infraParent,
      childCodeColumn: "code",
      childTypeColumn,
      communeTypeColumn
    };
  }

  const communeParent = PARENT_COLUMN_CANDIDATES.find((name) => communeColumns.has(name));
  if (communeParent && communeColumns.has("inseeCode")) {
    const childTypeColumn = COMMUNE_TYPE_CANDIDATES.find((name) =>
      communeColumns.has(name)
    );
    return {
      table: "commune",
      parentColumn: communeParent,
      childCodeColumn: "inseeCode",
      childTypeColumn,
      communeTypeColumn
    };
  }

  throw new Error(
    "No explicit parent relation found in DB. Add a parent_code_insee/mother_code_insee field or infra_zone parent relation."
  );
}

async function fetchRelationChildren(
  dbConn: Db,
  info: RelationInfo
): Promise<RelationChildRow[]> {
  const tableName = info.table;
  const childColumn = info.childCodeColumn;
  const parentColumn = info.parentColumn;
  const typeColumn = info.childTypeColumn;

  const result = await sql<RelationChildRow>`
    select
      ${sql.raw(`"${childColumn}"`)} as "childCode",
      ${sql.raw(`"${parentColumn}"`)} as "parentCode",
      ${typeColumn ? sql.raw(`"${typeColumn}"`) : sql`null`} as "childType"
    from ${sql.raw(`"${tableName}"`)}
  `.execute(dbConn);

  return result.rows;
}

function isChildRow(row: RelationChildRow, info: RelationInfo): boolean {
  if (info.table === "infra_zone") return true;
  if (row.parentCode) return true;
  if (info.childTypeColumn && row.childType) {
    return CHILD_TYPES.has(row.childType);
  }
  return false;
}

function buildChildrenMaps(rows: RelationChildRow[]): void {
  childrenByParent = new Map();
  childrenByCode = new Map();

  for (const row of rows) {
    if (row.parentCode) {
      const list = childrenByParent.get(row.parentCode) ?? [];
      list.push(row);
      childrenByParent.set(row.parentCode, list);
    }
    const byCode = childrenByCode.get(row.childCode) ?? [];
    byCode.push(row);
    childrenByCode.set(row.childCode, byCode);
  }
}

function getChildrenForParent(parentCode: string, typeFilter?: string): RelationChildRow[] {
  const children = childrenByParent.get(parentCode) ?? [];
  if (!typeFilter) return children;
  return children.filter((row) => row.childType === typeFilter);
}

function buildChildCoordsMap(
  codes: Set<string>,
  index: Awaited<ReturnType<typeof buildOfflineCoordinateIndex>> | null
): Map<string, { lat: number; lon: number }> {
  const map = new Map<string, { lat: number; lon: number }>();
  if (!index) return map;
  for (const code of codes) {
    const lookup = lookupOfflineCoordinates(code, index);
    if (lookup.coords) {
      map.set(code, { lat: lookup.coords.lat, lon: lookup.coords.lon });
    }
  }
  return map;
}

function computeCentroid(coords: Array<{ lat: number; lon: number }>): { lat: number; lon: number } | null {
  if (coords.length === 0) return null;
  let sumLat = 0;
  let sumLon = 0;
  for (const entry of coords) {
    sumLat += entry.lat;
    sumLon += entry.lon;
  }
  return { lat: sumLat / coords.length, lon: sumLon / coords.length };
}

test("U1: normalizeParentInseeCode pads parent codes", () => {
  assert.equal(normalizeParentInseeCode("7612", "76"), "76012");
  assert.equal(normalizeParentInseeCode("8503", "85"), "85003");
  assert.equal(normalizeParentInseeCode("97502", "97"), "97502");
  assert.equal(normalizeParentInseeCode("7612", "76D"), "76012");
  assert.equal(normalizeParentInseeCode("8503", "85D"), "85003");
});

function assertChildrenMapping(
  parentCode: string,
  label: string,
  expectedChildren: string[],
  typeFilter?: string
): string[] {
  const errors: string[] = [];
  const expectedSet = new Set(expectedChildren);
  const children = getChildrenForParent(parentCode, typeFilter);
  const foundCodes = children.map((row) => row.childCode);

  const counts = new Map<string, number>();
  for (const code of foundCodes) {
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }

  const duplicates = Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([code, count]) => `${code} x${count}`);

  if (duplicates.length > 0) {
    errors.push(`${label} has duplicate children: ${duplicates.join(", ")}`);
  }

  const missing: string[] = [];
  for (const code of expectedChildren) {
    const rows = childrenByCode.get(code) ?? [];
    if (rows.length === 0) {
      missing.push(code);
      continue;
    }
    const matched = rows.some((row) => row.parentCode === parentCode);
    if (!matched) {
      const parents = rows.map((row) => row.parentCode ?? "null").join(", ");
      errors.push(`${label} child ${code} linked to parent(s): ${parents}`);
    }
  }

  if (missing.length > 0) {
    errors.push(`${label} missing children: ${missing.join(", ")}`);
  }

  const extras = foundCodes.filter((code) => !expectedSet.has(code));
  if (extras.length > 0) {
    errors.push(`${label} unexpected children: ${extras.slice(0, 50).join(", ")}`);
  }

  const uniqueFound = new Set(foundCodes).size;
  if (uniqueFound !== expectedChildren.length) {
    errors.push(
      `${label} child count mismatch: expected ${expectedChildren.length}, found ${uniqueFound}`
    );
  }

  return errors;
}

function isFallbackSource(source: string | null): boolean {
  if (!source) return false;
  return (
    source === "postal_csv" ||
    source === "communes_centroid" ||
    source === "communes-centroid" ||
    source === "admin_express" ||
    source === "admin-express" ||
    source.startsWith("postal_csv") ||
    source.startsWith("communes_centroid") ||
    source.startsWith("communes-centroid") ||
    source.startsWith("admin_express") ||
    source.startsWith("admin-express")
  );
}

async function fetchCommuneTypes(
  dbConn: Db,
  typeColumn: string,
  codes: string[]
): Promise<Map<string, string | null>> {
  if (codes.length === 0) return new Map();
  const result = await sql<{ inseeCode: string; typeValue: string | null }>`
    select "inseeCode" as "inseeCode", ${sql.raw(`"${typeColumn}"`)} as "typeValue"
    from "commune"
    where "inseeCode" in (${sql.join(codes)})
  `.execute(dbConn);

  return new Map(result.rows.map((row) => [row.inseeCode, row.typeValue]));
}

async function loadParentCodesForCommuneCodes(
  sourcePath: string,
  codes: Set<string>
): Promise<Map<string, string>> {
  if (codes.size === 0) return new Map();
  await assertFileExists(sourcePath, "INSEE cached file");
  const delimiter = await detectDelimiter(sourcePath);
  const { stream } = await openCsvStream(sourcePath);
  const parser = parse({
    columns: true,
    delimiter,
    bom: true,
    trim: true,
    relax_column_count: true,
    skip_empty_lines: true
  });
  stream.pipe(parser);

  const found = new Map<string, string>();
  for await (const record of parser) {
    const normalized = normalizeRecord(record as Record<string, string>);
    const code = normalizeInseeCode(
      pickValue(normalized, ["com", "insee_code", "code_insee", "codgeo"])
    );
    if (!code || !codes.has(code)) continue;

    const departmentCode =
      pickValue(normalized, ["dep", "departement", "department_code"]) ?? null;
    let parentRaw = pickValue(normalized, [
      "comparent",
      "parent",
      "parent_commune",
      "code_commune_parent",
      "code_insee_rattachement",
      "parent_code_insee"
    ]);
    if (!parentRaw) {
      const entries = Object.entries(normalized);
      for (let i = entries.length - 1; i >= 0; i -= 1) {
        const value = entries[i]?.[1];
        if (!value) continue;
        const candidate = value.trim();
        if (!/^\d{4,5}$/.test(candidate)) continue;
        if (candidate === code) continue;
        parentRaw = candidate;
        break;
      }
    }
    const parentCode = normalizeParentInseeCode(parentRaw, departmentCode);
    if (parentCode) {
      found.set(code, parentCode);
    }
  }

  return found;
}

before(async () => {
  dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error("DATABASE_URL is required for post-import checks.");
  }

  const cacheDir = path.resolve(process.cwd(), ".cache");
  const postalPath = path.join(cacheDir, "20230823-communes-departement-region.csv");
  const inseePath = path.join(cacheDir, "v_commune_2025.csv");
  const offlinePath = path.resolve(process.cwd(), "data/coords/communes-centroid.csv");

  await assertFileExists(postalPath, "postal CSV cache");
  await assertFileExists(inseePath, "INSEE cached file");

  const postalDelimiter = await detectDelimiter(postalPath);
  postalIndex = await buildPostalCoordinateIndex(postalPath, postalDelimiter);

  try {
    await assertFileExists(offlinePath, "offline centroid file");
    const offlineDelimiter = await detectDelimiter(offlinePath);
    offlineIndex = await buildOfflineCoordinateIndex(offlinePath, offlineDelimiter);
  } catch {
    offlineIndex = null;
    console.warn("offline centroid file missing; offline checks will be skipped.");
  }

  db = createDb(dbUrl);
  communes = await db
    .selectFrom("commune")
    .select(["inseeCode", "name", "lat", "lon", "geoSource", "geoPrecision"])
    .execute();
  communeByCode = new Map(communes.map((row) => [row.inseeCode, row]));

  relationInfo = await detectRelationInfo(db);
  relationChildren = await fetchRelationChildren(db, relationInfo);
  buildChildrenMaps(relationChildren);
  if (relationInfo.communeTypeColumn) {
    const parentCodes = Array.from(
      new Set(
        relationChildren
          .map((row) => row.parentCode)
          .filter((code): code is string => Boolean(code))
      )
    );
    communeTypeByCode = await fetchCommuneTypes(
      db,
      relationInfo.communeTypeColumn,
      parentCodes
    );
  }

  parentCodeByChild = await loadParentCodesForCommuneCodes(
    inseePath,
    new Set(INHERIT_PARENT_CODES)
  );

  const derivedParents = communes
    .filter((row) => row.geoSource === "derived_children")
    .map((row) => row.inseeCode);
  if (derivedParents.length > 0) {
    for (const parentCode of derivedParents) {
      if (PARENTS.some((parent) => parent.code === parentCode)) {
        const expected = PARENTS.find((parent) => parent.code === parentCode);
        if (expected) {
          buildRange(expected.min, expected.max).forEach((code) => childCodes.add(code));
        }
      } else {
        getChildrenForParent(parentCode).forEach((child) => childCodes.add(child.childCode));
      }
    }
    childCoords = buildChildCoordsMap(childCodes, offlineIndex);
  }
});

after(async () => {
  await db?.destroy();
});

test("A1: no commune has NULL coordinates", () => {
  const nullCoords = communes.filter((row) => row.lat === null || row.lon === null);
  assert.equal(
    nullCoords.length,
    0,
    `Found ${nullCoords.length} communes with NULL coords. First 50: ${nullCoords
      .slice(0, 50)
      .map(formatCommune)
      .join(" | ")}`
  );
});

test("A2: coordinates are within valid ranges", () => {
  const outOfRange = communes.filter((row) => {
    if (row.lat === null || row.lon === null) return false;
    return row.lat < -90 || row.lat > 90 || row.lon < -180 || row.lon > 180;
  });

  assert.equal(
    outOfRange.length,
    0,
    `Found ${outOfRange.length} communes with out-of-range coords: ${outOfRange
      .slice(0, 50)
      .map(formatCommune)
      .join(" | ")}`
  );
});

test("A3: coordinates are finite numbers", () => {
  const nonFinite = communes.filter((row) => {
    if (row.lat === null || row.lon === null) return false;
    return !Number.isFinite(row.lat) || !Number.isFinite(row.lon);
  });

  assert.equal(
    nonFinite.length,
    0,
    `Found ${nonFinite.length} communes with non-finite coords: ${nonFinite
      .slice(0, 50)
      .map(formatCommune)
      .join(" | ")}`
  );
});

test("R1: parent-child relation is consistent", () => {
  const errors: string[] = [];
  const childCandidates = relationChildren.filter((row) => isChildRow(row, relationInfo));

  if (childCandidates.length === 0) {
    errors.push("No child rows found for parent relation.");
  }

  const nullParents = childCandidates.filter((row) => !row.parentCode);
  if (nullParents.length > 0) {
    errors.push(
      `Found ${nullParents.length} children with NULL parent: ${nullParents
        .slice(0, 50)
        .map((row) => row.childCode)
        .join(", ")}`
    );
  }

  const missingParents = childCandidates.filter(
    (row) =>
      row.parentCode &&
      row.parentCode !== row.childCode &&
      !communeByCode.has(row.parentCode)
  );
  if (missingParents.length > 0) {
    errors.push(
      `Found ${missingParents.length} children with missing parent in commune table: ${missingParents
        .slice(0, 50)
        .map((row) => `${row.childCode}->${row.parentCode}`)
        .join(", ")}`
    );
  }

  const parentMap = new Map<string, string | null>();
  for (const row of childCandidates) {
    parentMap.set(row.childCode, row.parentCode ?? null);
  }
  const twoCycles: string[] = [];
  for (const row of childCandidates) {
    if (!row.parentCode || row.parentCode === row.childCode) continue;
    const parentParent = parentMap.get(row.parentCode);
    if (parentParent && parentParent === row.childCode) {
      twoCycles.push(`${row.childCode}<->${row.parentCode}`);
    }
  }
  if (twoCycles.length > 0) {
    errors.push(
      `Found ${twoCycles.length} parent-child cycles (length 2): ${twoCycles
        .slice(0, 50)
        .join(", ")}`
    );
  }

  if (relationInfo.communeTypeColumn && communeTypeByCode.size > 0) {
    const badParents = childCandidates.filter((row) => {
      if (!row.parentCode) return false;
      const parentType = communeTypeByCode.get(row.parentCode);
      return parentType ? CHILD_TYPES.has(parentType) : false;
    });
    if (badParents.length > 0) {
      errors.push(
        `Found ${badParents.length} children whose parent is not a mother commune: ${badParents
          .slice(0, 50)
          .map((row) => `${row.childCode}->${row.parentCode}`)
          .join(", ")}`
      );
    }
  }

  assert.equal(errors.length, 0, errors.join(" | "));
});

test("R2: Paris/Lyon/Marseille parent-child mappings are correct", () => {
  const errors: string[] = [];
  const typeFilter = relationInfo.childTypeColumn ? "ARM" : undefined;

  for (const parent of PARENTS) {
    const parentRow = communeByCode.get(parent.code);
    if (!parentRow) {
      errors.push(`${parent.label} ${parent.code} missing from commune table.`);
      continue;
    }

    const expectedChildren = buildRange(parent.min, parent.max);
    errors.push(
      ...assertChildrenMapping(parent.code, `${parent.label} ${parent.code}`, expectedChildren, typeFilter)
    );
  }

  assert.equal(errors.length, 0, errors.join(" | "));
});

test("B: Paris/Lyon/Marseille have valid coords and derived children when needed", () => {
  const errors: string[] = [];

  for (const parent of PARENTS) {
    const row = communeByCode.get(parent.code);
    if (!row) {
      errors.push(`${parent.label} ${parent.code} missing from commune table.`);
      continue;
    }

    if (row.lat === null || row.lon === null) {
      errors.push(`${parent.label} ${parent.code} has NULL coords (${formatCommune(row)}).`);
      continue;
    }

    const source = row.geoSource ?? "null";
    if (source !== "insee" && source !== "derived_children") {
      errors.push(
        `${parent.label} ${parent.code} has invalid geo_source=${source} (expected insee or derived_children).`
      );
    }

    if (source === "derived_children") {
      const expectedCodes = buildRange(parent.min, parent.max);
      const typeFilter = relationInfo.childTypeColumn ? "ARM" : undefined;
      const children = getChildrenForParent(parent.code, typeFilter);
      const childSet = new Set(children.map((child) => child.childCode));
      const missingChildren = expectedCodes.filter((code) => !childSet.has(code));
      if (missingChildren.length > 0) {
        errors.push(
          `${parent.label} ${parent.code} missing arrondissement rows: ${missingChildren.join(
            ", "
          )}`
        );
      }

      if (offlineIndex) {
        const missingCoords = expectedCodes.filter((code) => !childCoords.has(code));
        if (missingCoords.length > 0) {
          errors.push(
            `${parent.label} ${parent.code} missing arrondissement coords in communes-centroid.csv: ${missingCoords.join(
              ", "
            )}`
          );
        }
      }
    }
  }

  assert.equal(errors.length, 0, errors.join(" | "));
});

test("C: known historical gaps exist and have valid coords", () => {
  const errors: string[] = [];

  for (const code of KNOWN_HOLES) {
    const row = communeByCode.get(code);
    if (!row) {
      errors.push(`Commune ${code} missing from DB.`);
      continue;
    }

    if (row.lat === null || row.lon === null) {
      errors.push(
        `Commune ${code} has NULL coords (${formatCommune(row)}).`
      );
    }
  }

  assert.equal(errors.length, 0, errors.join(" | "));
});

test("E: inherit_parent uses parent coords for attached communes", () => {
  const errors: string[] = [];

  for (const childCode of INHERIT_PARENT_CODES) {
    const child = communeByCode.get(childCode);
    if (!child) {
      errors.push(`Commune ${childCode} missing from DB.`);
      continue;
    }

    if (child.lat === null || child.lon === null) {
      errors.push(`Commune ${childCode} has NULL coords (${formatCommune(child)}).`);
      continue;
    }

    if (child.geoSource !== "inherit_parent") {
      errors.push(
        `Commune ${childCode} geo_source=${child.geoSource ?? "null"} (expected inherit_parent).`
      );
    }
    if (child.geoPrecision !== "fallback") {
      errors.push(
        `Commune ${childCode} geo_precision=${child.geoPrecision ?? "null"} (expected fallback).`
      );
    }

    const parentCode = parentCodeByChild.get(childCode);
    if (!parentCode) {
      errors.push(`Commune ${childCode} missing parent_code_insee in INSEE CSV.`);
      continue;
    }
    const expectedParent = EXPECTED_INHERIT_PARENTS[childCode];
    if (expectedParent && parentCode !== expectedParent) {
      errors.push(
        `Commune ${childCode} parent_code_insee=${parentCode} (expected ${expectedParent}).`
      );
    }

    const parent = communeByCode.get(parentCode);
    if (!parent) {
      errors.push(`Commune ${childCode} parent ${parentCode} missing from DB.`);
      continue;
    }

    if (parent.lat === null || parent.lon === null) {
      errors.push(
        `Commune ${childCode} parent ${parentCode} missing coords (${formatCommune(parent)}).`
      );
      continue;
    }

    if (child.lat !== parent.lat || child.lon !== parent.lon) {
      errors.push(
        `Commune ${childCode} coords do not match parent ${parentCode}. child=${child.lat},${child.lon} parent=${parent.lat},${parent.lon}`
      );
    }
  }

  assert.equal(errors.length, 0, errors.join(" | "));
});

test("D1: derived_children parents have at least 2 children and reasonable distances", () => {
  if (!offlineIndex) return;
  const errors: string[] = [];

  const derivedParents = communes.filter(
    (row) =>
      row.geoSource === "derived_children" &&
      PARENTS.some((parent) => parent.code === row.inseeCode)
  );
  for (const parent of derivedParents) {
    if (parent.lat === null || parent.lon === null) {
      errors.push(`Derived parent ${parent.inseeCode} has NULL coords.`);
      continue;
    }

    const special = PARENTS.find((entry) => entry.code === parent.inseeCode);
    const typeFilter = relationInfo.childTypeColumn ? "ARM" : undefined;
    const linkedChildren = special
      ? getChildrenForParent(parent.inseeCode, typeFilter)
      : getChildrenForParent(parent.inseeCode);
    const relatedCodes = Array.from(
      new Set(
        special
          ? buildRange(special.min, special.max)
          : linkedChildren.map((row) => row.childCode)
      )
    );

    if (relatedCodes.length < 2) {
      errors.push(
        `Derived parent ${parent.inseeCode} has only ${relatedCodes.length} related child(ren) via ${relationInfo.table}.${relationInfo.parentColumn}.`
      );
      continue;
    }

    const missingCoords = relatedCodes.filter((code) => !childCoords.has(code));
    if (missingCoords.length > 0) {
      errors.push(
        `Derived parent ${parent.inseeCode} missing child coords: ${missingCoords.join(", ")}.`
      );
      continue;
    }

    const coords = relatedCodes.map((code) => ({
      code,
      coords: childCoords.get(code) as { lat: number; lon: number }
    }));

    const centroid = computeCentroid(coords.map((entry) => entry.coords));
    if (!centroid) {
      errors.push(`Derived parent ${parent.inseeCode} has no child coords for centroid.`);
      continue;
    }

    const centroidDistance = haversineKm(
      parent.lat,
      parent.lon,
      centroid.lat,
      centroid.lon
    );
    if (centroidDistance > MAX_CENTROID_DISTANCE_KM) {
      errors.push(
        `Derived parent ${parent.inseeCode} centroid distance ${centroidDistance.toFixed(
          2
        )}km > ${MAX_CENTROID_DISTANCE_KM}km.`
      );
    }

    for (const child of coords) {
      const distance = haversineKm(parent.lat, parent.lon, child.coords.lat, child.coords.lon);
      if (distance > MAX_CHILD_DISTANCE_KM) {
        errors.push(
          `Derived parent ${parent.inseeCode} child ${child.code} is ${distance.toFixed(
            1
          )}km away (>${MAX_CHILD_DISTANCE_KM}km).`
        );
      }
    }
  }

  assert.equal(errors.length, 0, errors.join(" | "));
});

test("D2: postal/offline sources use fallback precision", () => {
  const offenders = communes.filter(
    (row) => isFallbackSource(row.geoSource) && row.geoPrecision !== "fallback"
  );
  assert.equal(
    offenders.length,
    0,
    `Found ${offenders.length} communes with fallback source but precision != fallback: ${offenders
      .slice(0, 50)
      .map(formatCommune)
      .join(" | ")}`
  );
});
