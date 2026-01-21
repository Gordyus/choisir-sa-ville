import type { Db } from "../db.js";

export type ZoneAggregateRecord = {
  zoneId: string;
  aggregateId: string;
  periodYear: number;
  paramsHash: string;
  coverage: number;
  source: string;
  sourceVersion: string;
  computedAt: Date;
  payloadJson: unknown;
};

export type GeoAggregateValueRecord = {
  aggregateId: string;
  periodYear: number;
  geoLevel: string;
  geoCode: string;
  paramsHash: string;
  paramsFamilyHash: string;
  source: string | null;
  sourceVersion: string | null;
  payloadJson: unknown;
};

export type ZoneGeoWeightRecord = {
  zoneId: string;
  geoLevel: string;
  geoCode: string;
  weight: number;
};

export async function getZoneAggregate(
  db: Db,
  input: {
    zoneId: string;
    aggregateId: string;
    periodYear: number;
    paramsHash: string;
  }
): Promise<ZoneAggregateRecord | null> {
  const row = await db
    .selectFrom("zone_aggregates")
    .selectAll()
    .where("zoneId", "=", input.zoneId)
    .where("aggregateId", "=", input.aggregateId)
    .where("periodYear", "=", input.periodYear)
    .where("paramsHash", "=", input.paramsHash)
    .executeTakeFirst();

  return row ?? null;
}

export async function upsertZoneAggregate(
  db: Db,
  record: ZoneAggregateRecord
): Promise<void> {
  await db
    .insertInto("zone_aggregates")
    .values(record)
    .onConflict((oc) =>
      oc
        .columns(["zoneId", "aggregateId", "periodYear", "paramsHash"])
        .doUpdateSet({
          coverage: record.coverage,
          source: record.source,
          sourceVersion: record.sourceVersion,
          computedAt: record.computedAt,
          payloadJson: record.payloadJson
        })
    )
    .execute();
}

export async function getGeoAggregateValues(
  db: Db,
  input: {
    aggregateId: string;
    periodYear: number;
    geoLevel: string;
    geoCodes: string[];
    paramsHash: string;
  }
): Promise<GeoAggregateValueRecord[]> {
  if (input.geoCodes.length === 0) return [];

  return db
    .selectFrom("geo_aggregate_values")
    .selectAll()
    .where("aggregateId", "=", input.aggregateId)
    .where("periodYear", "=", input.periodYear)
    .where("geoLevel", "=", input.geoLevel)
    .where("paramsHash", "=", input.paramsHash)
    .where("geoCode", "in", input.geoCodes)
    .execute();
}

export async function getLatestGeoAggregatePeriodYear(
  db: Db,
  input: { aggregateId: string; paramsFamilyHash: string }
): Promise<number | null> {
  const row = await db
    .selectFrom("geo_aggregate_values")
    .select((eb) => eb.fn.max("periodYear").as("periodYear"))
    .where("aggregateId", "=", input.aggregateId)
    .where("paramsFamilyHash", "=", input.paramsFamilyHash)
    .executeTakeFirst();

  return row?.periodYear ?? null;
}

export async function upsertGeoAggregateValuesBatch(
  db: Db,
  records: GeoAggregateValueRecord[]
): Promise<void> {
  if (records.length === 0) return;

  await db
    .insertInto("geo_aggregate_values")
    .values(records)
    .onConflict((oc) =>
      oc
        .columns(["aggregateId", "periodYear", "geoLevel", "geoCode", "paramsHash"])
        .doUpdateSet({
          source: (eb) => eb.ref("excluded.source"),
          sourceVersion: (eb) => eb.ref("excluded.sourceVersion"),
          payloadJson: (eb) => eb.ref("excluded.payloadJson"),
          paramsFamilyHash: (eb) => eb.ref("excluded.paramsFamilyHash")
        })
    )
    .execute();
}

export async function getZoneGeoWeights(
  db: Db,
  input: { zoneId: string; geoLevel?: string }
): Promise<ZoneGeoWeightRecord[]> {
  let query = db.selectFrom("zone_geo_map").selectAll().where("zoneId", "=", input.zoneId);

  if (input.geoLevel) {
    query = query.where("geoLevel", "=", input.geoLevel);
  }

  return query.execute();
}

export async function upsertZoneGeoWeightsBatch(
  db: Db,
  records: ZoneGeoWeightRecord[]
): Promise<void> {
  if (records.length === 0) return;

  await db
    .insertInto("zone_geo_map")
    .values(records)
    .onConflict((oc) =>
      oc
        .columns(["zoneId", "geoLevel", "geoCode"])
        .doUpdateSet({
          weight: (eb) => eb.ref("excluded.weight")
        })
    )
    .execute();
}
