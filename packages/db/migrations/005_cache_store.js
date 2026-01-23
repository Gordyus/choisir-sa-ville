import { sql } from "kysely";
export async function up(db) {
    await db.schema
        .createTable("cache_store")
        .addColumn("key", "text", (c) => c.notNull().primaryKey())
        .addColumn("value", "jsonb", (c) => c.notNull())
        .addColumn("expiresAt", "timestamptz", (c) => c.notNull())
        .addColumn("createdAt", "timestamptz", (c) => c.notNull().defaultTo(sql `now()`))
        .addColumn("updatedAt", "timestamptz", (c) => c.notNull().defaultTo(sql `now()`))
        .execute();
    await db.schema
        .createIndex("cache_store_expires_idx")
        .on("cache_store")
        .column("expiresAt")
        .execute();
}
export async function down(db) {
    await db.schema.dropIndex("cache_store_expires_idx").execute();
    await db.schema.dropTable("cache_store").execute();
}
