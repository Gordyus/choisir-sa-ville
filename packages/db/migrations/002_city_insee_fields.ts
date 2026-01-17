import type { Kysely } from "kysely";
import { sql } from "kysely";
import type { Database } from "../src/types.js";

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("city")
    .addColumn("postalCode", "text")
    .addColumn("departmentCode", "varchar(3)")
    .addColumn("regionCode", "varchar(3)")
    .addColumn("lat", "double precision")
    .addColumn("lon", "double precision")
    .addColumn("updatedAt", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn("createdAt", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("city")
    .dropColumn("createdAt")
    .dropColumn("updatedAt")
    .dropColumn("lon")
    .dropColumn("lat")
    .dropColumn("regionCode")
    .dropColumn("departmentCode")
    .dropColumn("postalCode")
    .execute();
}
