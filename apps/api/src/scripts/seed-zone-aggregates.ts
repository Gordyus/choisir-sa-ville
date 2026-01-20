import dotenv from "dotenv";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { createDb, upsertGeoAggregateValuesBatch, upsertZoneGeoWeightsBatch } from "@csv/db";
import { hashAggregateParams } from "@csv/core";

dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const fixturesDir = path.resolve(process.cwd(), "../../packages/db/fixtures");

const geoValuesFile = path.join(fixturesDir, "rent_geo_values.json");
const zoneGeoMapFile = path.join(fixturesDir, "zone_geo_map.json");

const db = createDb(url);

const geoValues = await loadJsonFile<Array<{
  aggregateId: string;
  periodYear: number;
  geoLevel: string;
  geoCode: string;
  params: Record<string, unknown>;
  payload: unknown;
}>>(geoValuesFile);

const zoneGeoWeights = await loadJsonFile<Array<{
  zoneId: string;
  geoLevel: string;
  geoCode: string;
  weight: number;
}>>(zoneGeoMapFile);

const geoRecords = [] as Array<{
  aggregateId: string;
  periodYear: number;
  geoLevel: string;
  geoCode: string;
  paramsHash: string;
  payloadJson: unknown;
}>;

for (const row of geoValues) {
  const paramsHash = await hashAggregateParams(row.params ?? {});
  geoRecords.push({
    aggregateId: row.aggregateId,
    periodYear: row.periodYear,
    geoLevel: row.geoLevel,
    geoCode: row.geoCode,
    paramsHash,
    payloadJson: row.payload
  });
}

await upsertGeoAggregateValuesBatch(db, geoRecords);
await upsertZoneGeoWeightsBatch(db, zoneGeoWeights);

await db.destroy();
console.log("Zone aggregate fixtures loaded.");

async function loadJsonFile<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw) as T;
}
