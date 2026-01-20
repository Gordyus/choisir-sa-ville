import type { Kysely } from "kysely";
import type { Database } from "../src/types.js";

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("zone_aggregates")
    .addColumn("zoneId", "text", (c) => c.notNull())
    .addColumn("aggregateId", "text", (c) => c.notNull())
    .addColumn("periodYear", "integer", (c) => c.notNull())
    .addColumn("paramsHash", "text", (c) => c.notNull())
    .addColumn("coverage", "double precision", (c) => c.notNull())
    .addColumn("source", "text", (c) => c.notNull())
    .addColumn("sourceVersion", "text", (c) => c.notNull())
    .addColumn("computedAt", "timestamptz", (c) => c.notNull())
    .addColumn("payloadJson", "jsonb", (c) => c.notNull())
    .addPrimaryKeyConstraint("zone_aggregates_pk", [
      "zoneId",
      "aggregateId",
      "periodYear",
      "paramsHash"
    ])
    .execute();

  await db.schema
    .createTable("geo_aggregate_values")
    .addColumn("aggregateId", "text", (c) => c.notNull())
    .addColumn("periodYear", "integer", (c) => c.notNull())
    .addColumn("geoLevel", "text", (c) => c.notNull())
    .addColumn("geoCode", "text", (c) => c.notNull())
    .addColumn("paramsHash", "text", (c) => c.notNull())
    .addColumn("payloadJson", "jsonb", (c) => c.notNull())
    .addPrimaryKeyConstraint("geo_aggregate_values_pk", [
      "aggregateId",
      "periodYear",
      "geoLevel",
      "geoCode",
      "paramsHash"
    ])
    .execute();

  await db.schema
    .createTable("zone_geo_map")
    .addColumn("zoneId", "text", (c) => c.notNull())
    .addColumn("geoLevel", "text", (c) => c.notNull())
    .addColumn("geoCode", "text", (c) => c.notNull())
    .addColumn("weight", "double precision", (c) => c.notNull())
    .addPrimaryKeyConstraint("zone_geo_map_pk", ["zoneId", "geoLevel", "geoCode"])
    .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("zone_geo_map").execute();
  await db.schema.dropTable("geo_aggregate_values").execute();
  await db.schema.dropTable("zone_aggregates").execute();
}
