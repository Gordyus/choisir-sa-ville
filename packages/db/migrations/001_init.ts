import type { Insertable, Kysely } from "kysely";
import type { Database } from "../src/types.js";

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("city")
    .addColumn("inseeCode", "varchar(5)", (c) => c.notNull().primaryKey())
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("population", "integer")
    .execute();

  await db.schema.createIndex("city_name_idx").on("city").column("name").execute();

  // Minimal seed (dev convenience)
  const seed: Insertable<Database["city"]>[] = [
    { inseeCode: "75056", name: "Paris", population: 2165423 },
    { inseeCode: "69123", name: "Lyon", population: 522250 },
    { inseeCode: "13055", name: "Marseille", population: 873076 }
  ] as unknown as Insertable<Database["city"]>[];

  await db
    .insertInto("city")
    .values(seed)
    .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("city").execute();
}
