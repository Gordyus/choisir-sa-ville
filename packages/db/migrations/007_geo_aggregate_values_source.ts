import type { Kysely } from "kysely";
import type { Database } from "../src/types.js";

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("geo_aggregate_values")
    .addColumn("source", "text")
    .addColumn("sourceVersion", "text")
    .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("geo_aggregate_values")
    .dropColumn("sourceVersion")
    .dropColumn("source")
    .execute();
}
