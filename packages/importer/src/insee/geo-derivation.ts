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

const LAT_KEYS = ["lat", "latitude", "latitude_deg"];
const LON_KEYS = ["lon", "longitude", "longitude_deg"];

export async function buildChildCoordinateIndex(
  sourcePath: string,
  delimiter: string
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

    const lat = parseNumber(pickValue(normalized, LAT_KEYS));
    const lon = parseNumber(pickValue(normalized, LON_KEYS));
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

export function deriveCommuneLocation(
  communeCode: string,
  index: ChildCoordinateIndex
): { lat: number; lon: number; geoSource: string; geoPrecision: string } | null {
  const children = index.get(communeCode);
  if (!children || children.length === 0) return null;

  const filtered = filterMandatoryChildren(communeCode, children);
  if (filtered.length === 0) return null;

  let sumLat = 0;
  let sumLon = 0;
  for (const child of filtered) {
    sumLat += child.lat;
    sumLon += child.lon;
  }

  return {
    lat: sumLat / filtered.length,
    lon: sumLon / filtered.length,
    geoSource: "derived_children",
    geoPrecision: "approx"
  };
}

function filterMandatoryChildren(
  communeCode: string,
  children: ChildCoordinate[]
): ChildCoordinate[] {
  const range = mandatoryRanges[communeCode];
  if (!range) return children;

  return children.filter((child) => {
    const numeric = Number.parseInt(child.code, 10);
    return Number.isFinite(numeric) && numeric >= range.min && numeric <= range.max;
  });
}

const mandatoryRanges: Record<string, { min: number; max: number }> = {
  "75056": { min: 75101, max: 75120 },
  "69123": { min: 69381, max: 69389 },
  "13055": { min: 13201, max: 13216 }
};
