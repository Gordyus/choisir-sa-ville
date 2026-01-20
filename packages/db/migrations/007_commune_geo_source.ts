import type { Kysely } from "kysely";
import type { Database } from "../src/types.js";

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("commune")
    .addColumn("geoSource", "text")
    .addColumn("geoPrecision", "text")
    .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("commune")
    .dropColumn("geoPrecision")
    .dropColumn("geoSource")
    .execute();
}
