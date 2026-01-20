import { parse } from "csv-parse";
import { openCsvStream } from "./csv-utils.js";
import {
  isInfraZoneType,
  normalizeCode,
  normalizeInseeCode,
  normalizeRecord,
  parseNumber,
  pickValue
} from "./normalize.js";
import type { InfraZoneType } from "./types.js";

export type ChildCoordinate = {
  parentCode: string;
  code: string;
  type: InfraZoneType;
  lat: number;
  lon: number;
};

export type ChildCoordinateIndex = Map<string, ChildCoordinate[]>;

export type PostalLookupStrategy = "insee" | "postal_name" | "none";

export type PostalCoordinateIndex = {
  strategy: PostalLookupStrategy;
  coordsByInsee: Map<string, { lat: number; lon: number }>;
  presentCodes: Set<string>;
  coordsByName: Map<string, { lat: number; lon: number }>;
  nameStatus: Map<string, { status: "unique_with_coords" | "unique_without_coords" | "ambiguous" }>;
};

export type PostalLookupResult = {
  coords: { lat: number; lon: number } | null;
  reason: string;
};

export type OfflineCoordinateIndex = {
  coords: Map<string, { lat: number; lon: number; source: string }>;
  presentCodes: Set<string>;
};

export type OfflineLookupResult = {
  coords: { lat: number; lon: number; source: string } | null;
  reason: string;
};

export type DeriveCommuneResult =
  | { type: "derived"; lat: number; lon: number; geoSource: string; geoPrecision: string }
  | { type: "missing_children"; reason: string };

const LAT_KEYS = ["lat", "latitude", "latitude_deg"];
const LON_KEYS = ["lon", "longitude", "longitude_deg"];
const POSTAL_CODE_KEYS = [
  "code_commune_insee",
  "code_commune",
  "commune_code",
  "insee_code",
  "code_insee",
  "com",
  "codgeo"
];
const POSTAL_POSTAL_KEYS = ["code_postal", "postal_code", "postcode", "cp"];
const POSTAL_NAME_KEYS = [
  "nom_commune",
  "nom_commune_postal",
  "nom_commune_complet",
  "libelle_acheminement",
  "libelle",
  "nom",
  "name"
];
const OFFLINE_CODE_KEYS = [
  "code_insee",
  "insee_code",
  "code_commune_insee",
  "code_commune",
  "commune_code",
  "com",
  "codgeo"
];

function normalizeNameKey(value: string): string {
  const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return normalized.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function detectPostalStrategy(headers: string[]): PostalLookupStrategy {
  const headerSet = new Set(headers);
  const hasInsee = POSTAL_CODE_KEYS.some((key) => headerSet.has(key));
  const hasPostal = POSTAL_POSTAL_KEYS.some((key) => headerSet.has(key));
  const hasName = POSTAL_NAME_KEYS.some((key) => headerSet.has(key));
  if (hasInsee) return "insee";
  if (hasPostal && hasName) return "postal_name";
  return "none";
}

function describePostalStrategy(strategy: PostalLookupStrategy): string {
  if (strategy === "insee") return "INSEE code";
  if (strategy === "postal_name") return "postal code + commune name (unique)";
  return "none";
}

export async function buildChildCoordinateIndex(
  sourcePath: string,
  delimiter: string,
  coordsByCode?: Map<string, { lat: number; lon: number }>
): Promise<ChildCoordinateIndex> {
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

  const index: ChildCoordinateIndex = new Map();

  for await (const record of parser) {
    const normalized = normalizeRecord(record as Record<string, string>);
    const typecom = normalizeCode(pickValue(normalized, ["typecom"]));
    if (!typecom || !isInfraZoneType(typecom)) continue;

    const parentCode = normalizeInseeCode(
      pickValue(normalized, ["comparent", "parent", "parent_commune"])
    );
    const code = normalizeInseeCode(
      pickValue(normalized, ["com", "insee_code", "code_insee", "codgeo"])
    );
    if (!parentCode || !code) continue;

    let lat = parseNumber(pickValue(normalized, LAT_KEYS));
    let lon = parseNumber(pickValue(normalized, LON_KEYS));
    if ((lat === null || lon === null) && coordsByCode) {
      const fallback = coordsByCode.get(code);
      if (fallback) {
        lat = fallback.lat;
        lon = fallback.lon;
      }
    }
    if (lat === null || lon === null) continue;

    const child: ChildCoordinate = {
      parentCode,
      code,
      type: typecom,
      lat,
      lon
    };

    const list = index.get(parentCode) ?? [];
    list.push(child);
    index.set(parentCode, list);
  }

  return index;
}

export async function buildPostalCoordinateIndex(
  sourcePath: string,
  delimiter: string
): Promise<PostalCoordinateIndex> {
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

  const coordsByInsee = new Map<string, { lat: number; lon: number }>();
  const presentCodes = new Set<string>();
  const inseeSums = new Map<string, { sumLat: number; sumLon: number; count: number }>();
  const nameStats = new Map<
    string,
    { postalCodes: Set<string>; sumLat: number; sumLon: number; count: number }
  >();
  let strategy: PostalLookupStrategy = "none";
  let logged = false;

  for await (const record of parser) {
    const normalized = normalizeRecord(record as Record<string, string>);

    if (!logged) {
      const headers = Object.keys(normalized);
      strategy = detectPostalStrategy(headers);
      console.log(`Postal CSV headers: ${headers.join(", ")}`);
      console.log(`Postal CSV lookup: ${describePostalStrategy(strategy)}`);
      logged = true;
    }

    if (strategy === "insee") {
      const code = normalizeInseeCode(pickValue(normalized, POSTAL_CODE_KEYS));
      if (!code) continue;
      presentCodes.add(code);

      const lat = parseNumber(pickValue(normalized, LAT_KEYS));
      const lon = parseNumber(pickValue(normalized, LON_KEYS));
      if (lat === null || lon === null) continue;

      const stat = inseeSums.get(code) ?? { sumLat: 0, sumLon: 0, count: 0 };
      stat.sumLat += lat;
      stat.sumLon += lon;
      stat.count += 1;
      inseeSums.set(code, stat);
      continue;
    }

    if (strategy === "postal_name") {
      const name = pickValue(normalized, POSTAL_NAME_KEYS);
      if (!name) continue;
      const nameKey = normalizeNameKey(name);
      if (!nameKey) continue;

      const postalCode = normalizeCode(pickValue(normalized, POSTAL_POSTAL_KEYS)) ?? "";
      const stat = nameStats.get(nameKey) ?? {
        postalCodes: new Set<string>(),
        sumLat: 0,
        sumLon: 0,
        count: 0
      };
      if (postalCode) {
        stat.postalCodes.add(postalCode);
      }

      const lat = parseNumber(pickValue(normalized, LAT_KEYS));
      const lon = parseNumber(pickValue(normalized, LON_KEYS));
      if (lat !== null && lon !== null) {
        stat.sumLat += lat;
        stat.sumLon += lon;
        stat.count += 1;
      }

      nameStats.set(nameKey, stat);
    }
  }

  const coordsByName = new Map<string, { lat: number; lon: number }>();
  const nameStatus = new Map<
    string,
    { status: "unique_with_coords" | "unique_without_coords" | "ambiguous" }
  >();

  if (strategy === "insee") {
    for (const [code, stat] of inseeSums) {
      coordsByInsee.set(code, {
        lat: stat.sumLat / stat.count,
        lon: stat.sumLon / stat.count
      });
    }
  } else if (strategy === "postal_name") {
    for (const [nameKey, stat] of nameStats) {
      const isUnique = stat.postalCodes.size <= 1;
      if (!isUnique) {
        nameStatus.set(nameKey, { status: "ambiguous" });
        continue;
      }

      if (stat.count === 0) {
        nameStatus.set(nameKey, { status: "unique_without_coords" });
        continue;
      }

      coordsByName.set(nameKey, {
        lat: stat.sumLat / stat.count,
        lon: stat.sumLon / stat.count
      });
      nameStatus.set(nameKey, { status: "unique_with_coords" });
    }
  }

  return {
    strategy,
    coordsByInsee,
    presentCodes,
    coordsByName,
    nameStatus
  };
}

export function lookupPostalCoordinates(
  inseeCode: string,
  communeName: string,
  index: PostalCoordinateIndex
): PostalLookupResult {
  if (index.strategy === "insee") {
    const coords = index.coordsByInsee.get(inseeCode) ?? null;
    if (coords) return { coords, reason: "postal CSV: ok" };
    if (index.presentCodes.has(inseeCode)) {
      return { coords: null, reason: "postal CSV: present but missing coords" };
    }
    return { coords: null, reason: "postal CSV: absent" };
  }

  if (index.strategy === "postal_name") {
    const nameKey = normalizeNameKey(communeName);
    if (!nameKey) return { coords: null, reason: "postal CSV: name missing" };
    const status = index.nameStatus.get(nameKey);
    if (!status) return { coords: null, reason: "postal CSV: absent" };
    if (status.status === "unique_with_coords") {
      const coords = index.coordsByName.get(nameKey) ?? null;
      return coords
        ? { coords, reason: "postal CSV: ok" }
        : { coords: null, reason: "postal CSV: present but missing coords" };
    }
    if (status.status === "unique_without_coords") {
      return { coords: null, reason: "postal CSV: present but missing coords" };
    }
    return { coords: null, reason: "postal CSV: ambiguous name" };
  }

  return { coords: null, reason: "postal CSV: unavailable" };
}

export async function buildOfflineCoordinateIndex(
  sourcePath: string,
  delimiter: string
): Promise<OfflineCoordinateIndex> {
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

  const coords = new Map<string, { lat: number; lon: number; source: string }>();
  const presentCodes = new Set<string>();

  for await (const record of parser) {
    const normalized = normalizeRecord(record as Record<string, string>);
    const code = normalizeInseeCode(pickValue(normalized, OFFLINE_CODE_KEYS));
    if (!code) continue;

    presentCodes.add(code);
    const lat = parseNumber(pickValue(normalized, LAT_KEYS));
    const lon = parseNumber(pickValue(normalized, LON_KEYS));
    if (lat === null || lon === null) continue;

    const source = pickValue(normalized, ["source"]) ?? "offline_centroid";
    coords.set(code, { lat, lon, source });
  }

  return { coords, presentCodes };
}

export function lookupOfflineCoordinates(
  inseeCode: string,
  index: OfflineCoordinateIndex
): OfflineLookupResult {
  const coords = index.coords.get(inseeCode) ?? null;
  if (coords) return { coords, reason: "communes-centroid.csv: ok" };
  if (index.presentCodes.has(inseeCode)) {
    return { coords: null, reason: "communes-centroid.csv: present but missing coords" };
  }
  return { coords: null, reason: "communes-centroid.csv: absent" };
}

export function deriveCommuneLocation(
  communeCode: string,
  index: ChildCoordinateIndex
): DeriveCommuneResult | null {
  const expected = mandatoryChildRanges[communeCode];
  const children = index.get(communeCode);

  if (expected) {
    const expectedCodes = buildRange(expected.min, expected.max);
    const childMap = new Map<string, ChildCoordinate>();
    for (const child of children ?? []) {
      childMap.set(child.code, child);
    }
    const missing = expectedCodes.filter((code) => !childMap.has(code));
    if (missing.length > 0) {
      return {
        type: "missing_children",
        reason: `missing arrondissement coords for parent ${communeCode}: ${missing.join(", ")}`
      };
    }

    let sumLat = 0;
    let sumLon = 0;
    for (const code of expectedCodes) {
      const child = childMap.get(code);
      if (!child) continue;
      sumLat += child.lat;
      sumLon += child.lon;
    }

    return {
      type: "derived",
      lat: sumLat / expectedCodes.length,
      lon: sumLon / expectedCodes.length,
      geoSource: "derived_children",
      geoPrecision: "approx"
    };
  }

  if (!children || children.length === 0) return null;

  let sumLat = 0;
  let sumLon = 0;
  for (const child of children) {
    sumLat += child.lat;
    sumLon += child.lon;
  }

  return {
    type: "derived",
    lat: sumLat / children.length,
    lon: sumLon / children.length,
    geoSource: "derived_children",
    geoPrecision: "approx"
  };
}

function buildRange(min: number, max: number): string[] {
  const values: string[] = [];
  for (let code = min; code <= max; code += 1) {
    values.push(String(code).padStart(5, "0"));
  }
  return values;
}

const mandatoryChildRanges: Record<string, { min: number; max: number }> = {
  "75056": { min: 75101, max: 75120 },
  "69123": { min: 69381, max: 69389 },
  "13055": { min: 13201, max: 13216 }
};
