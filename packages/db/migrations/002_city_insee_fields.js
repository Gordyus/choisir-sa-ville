import { sql } from "kysely";
export async function up(db) {
    await db.schema
        .alterTable("city")
        .addColumn("postalCode", "text")
        .addColumn("departmentCode", "varchar(3)")
        .addColumn("regionCode", "varchar(3)")
        .addColumn("lat", "double precision")
        .addColumn("lon", "double precision")
        .addColumn("updatedAt", "timestamptz", (c) => c.notNull().defaultTo(sql `now()`))
        .addColumn("createdAt", "timestamptz", (c) => c.notNull().defaultTo(sql `now()`))
        .execute();
}
export async function down(db) {
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
