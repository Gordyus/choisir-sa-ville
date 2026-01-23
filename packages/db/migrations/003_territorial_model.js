import { sql } from "kysely";
export async function up(db) {
    await db.schema
        .createTable("commune")
        .addColumn("inseeCode", "varchar(5)", (c) => c.notNull().primaryKey())
        .addColumn("name", "text", (c) => c.notNull())
        .addColumn("population", "integer")
        .addColumn("departmentCode", "varchar(3)")
        .addColumn("regionCode", "varchar(3)")
        .addColumn("lat", "double precision")
        .addColumn("lon", "double precision")
        .addColumn("createdAt", "timestamptz", (c) => c.notNull().defaultTo(sql `now()`))
        .addColumn("updatedAt", "timestamptz", (c) => c.notNull().defaultTo(sql `now()`))
        .execute();
    await db.schema
        .createIndex("commune_name_idx")
        .on("commune")
        .column("name")
        .execute();
    await db.schema
        .createTable("infra_zone")
        .addColumn("id", "text", (c) => c.notNull().primaryKey())
        .addColumn("type", "text", (c) => c.notNull())
        .addColumn("code", "varchar(5)", (c) => c.notNull())
        .addColumn("parentCommuneCode", "varchar(5)", (c) => c.notNull().references("commune.inseeCode").onDelete("cascade"))
        .addColumn("name", "text", (c) => c.notNull())
        .addColumn("createdAt", "timestamptz", (c) => c.notNull().defaultTo(sql `now()`))
        .addColumn("updatedAt", "timestamptz", (c) => c.notNull().defaultTo(sql `now()`))
        .execute();
    await sql `ALTER TABLE infra_zone ADD CONSTRAINT infra_zone_type_check CHECK (type IN ('ARM','COMD','COMA'))`.execute(db);
    await db.schema
        .createIndex("infra_zone_parent_idx")
        .on("infra_zone")
        .column("parentCommuneCode")
        .execute();
    await db.schema
        .createIndex("infra_zone_type_code_idx")
        .on("infra_zone")
        .columns(["type", "code"])
        .unique()
        .execute();
    await sql `
    INSERT INTO commune (
      "inseeCode",
      "name",
      "population",
      "departmentCode",
      "regionCode",
      "lat",
      "lon",
      "createdAt",
      "updatedAt"
    )
    SELECT
      "inseeCode",
      "name",
      "population",
      "departmentCode",
      "regionCode",
      "lat",
      "lon",
      COALESCE("createdAt", now()),
      COALESCE("updatedAt", now())
    FROM city
    ON CONFLICT ("inseeCode") DO UPDATE SET
      "name" = EXCLUDED."name",
      "population" = EXCLUDED."population",
      "departmentCode" = EXCLUDED."departmentCode",
      "regionCode" = EXCLUDED."regionCode",
      "lat" = EXCLUDED."lat",
      "lon" = EXCLUDED."lon",
      "updatedAt" = now()
  `.execute(db);
    await db.schema.dropTable("city").execute();
    await sql `CREATE VIEW city AS SELECT * FROM commune`.execute(db);
}
export async function down(db) {
    await sql `DROP VIEW IF EXISTS city`.execute(db);
    await db.schema
        .createTable("city")
        .addColumn("inseeCode", "varchar(5)", (c) => c.notNull().primaryKey())
        .addColumn("name", "text", (c) => c.notNull())
        .addColumn("postalCode", "text")
        .addColumn("population", "integer")
        .addColumn("departmentCode", "varchar(3)")
        .addColumn("regionCode", "varchar(3)")
        .addColumn("lat", "double precision")
        .addColumn("lon", "double precision")
        .addColumn("updatedAt", "timestamptz", (c) => c.notNull().defaultTo(sql `now()`))
        .addColumn("createdAt", "timestamptz", (c) => c.notNull().defaultTo(sql `now()`))
        .execute();
    await db.schema.createIndex("city_name_idx").on("city").column("name").execute();
    await sql `
    INSERT INTO city (
      "inseeCode",
      "name",
      "population",
      "departmentCode",
      "regionCode",
      "lat",
      "lon",
      "createdAt",
      "updatedAt"
    )
    SELECT
      "inseeCode",
      "name",
      "population",
      "departmentCode",
      "regionCode",
      "lat",
      "lon",
      COALESCE("createdAt", now()),
      COALESCE("updatedAt", now())
    FROM commune
    ON CONFLICT ("inseeCode") DO UPDATE SET
      "name" = EXCLUDED."name",
      "population" = EXCLUDED."population",
      "departmentCode" = EXCLUDED."departmentCode",
      "regionCode" = EXCLUDED."regionCode",
      "lat" = EXCLUDED."lat",
      "lon" = EXCLUDED."lon",
      "updatedAt" = now()
  `.execute(db);
    await db.schema.dropTable("infra_zone").execute();
    await db.schema.dropTable("commune").execute();
}
