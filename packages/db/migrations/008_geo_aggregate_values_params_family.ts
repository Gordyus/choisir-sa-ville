import type { Kysely } from "kysely";
import type { Database } from "../src/types.js";

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("geo_aggregate_values")
    .addColumn("paramsFamilyHash", "text", (c) => c.notNull().defaultTo(""))
    .execute();

  await db.schema
    .createIndex("geo_aggregate_values_latest_idx")
    .on("geo_aggregate_values")
    .columns(["aggregateId", "paramsFamilyHash", "periodYear"])
    .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropIndex("geo_aggregate_values_latest_idx").execute();
  await db.schema.alterTable("geo_aggregate_values").dropColumn("paramsFamilyHash").execute();
}
