import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("region")
    .addColumn("code", "varchar(3)", (c) => c.notNull().primaryKey())
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("createdAt", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn("updatedAt", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createTable("department")
    .addColumn("code", "varchar(3)", (c) => c.notNull().primaryKey())
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("regionCode", "varchar(3)")
    .addColumn("createdAt", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn("updatedAt", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createTable("commune_postal_code")
    .addColumn("communeCode", "varchar(5)", (c) =>
      c.notNull().references("commune.inseeCode").onDelete("cascade")
    )
    .addColumn("postalCode", "varchar(10)", (c) => c.notNull())
    .addPrimaryKeyConstraint("commune_postal_code_pk", ["communeCode", "postalCode"])
    .execute();

  await db.schema
    .createIndex("commune_postal_code_postal_idx")
    .on("commune_postal_code")
    .column("postalCode")
    .execute();

  await db.schema.alterTable("commune").addColumn("slug", "text").execute();
  await db.schema.alterTable("infra_zone").addColumn("slug", "text").execute();

  await sql`
    UPDATE commune
    SET slug = (
      CASE
        WHEN trim(both '-' from regexp_replace(regexp_replace("name", '[^a-zA-Z0-9]+', '-', 'g'), '-+', '-', 'g')) = '' THEN "inseeCode"
        ELSE lower(trim(both '-' from regexp_replace(regexp_replace("name", '[^a-zA-Z0-9]+', '-', 'g'), '-+', '-', 'g'))) || '-' || "inseeCode"
      END
    )
  `.execute(db);

  await sql`
    UPDATE infra_zone
    SET slug = (
      CASE
        WHEN trim(both '-' from regexp_replace(regexp_replace("name", '[^a-zA-Z0-9]+', '-', 'g'), '-+', '-', 'g')) = '' THEN "code"
        ELSE lower(trim(both '-' from regexp_replace(regexp_replace("name", '[^a-zA-Z0-9]+', '-', 'g'), '-+', '-', 'g'))) || '-' || lower("type") || '-' || "code"
      END
    )
  `.execute(db);

  await sql`ALTER TABLE commune ALTER COLUMN slug SET NOT NULL`.execute(db);
  await sql`ALTER TABLE infra_zone ALTER COLUMN slug SET NOT NULL`.execute(db);

  await db.schema.createIndex("commune_slug_idx").on("commune").column("slug").unique().execute();
  await db.schema
    .createIndex("infra_zone_slug_idx")
    .on("infra_zone")
    .column("slug")
    .unique()
    .execute();

  await sql`DROP VIEW IF EXISTS city`.execute(db);
  await sql`CREATE VIEW city AS SELECT * FROM commune`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP VIEW IF EXISTS city`.execute(db);

  await db.schema.dropTable("commune_postal_code").execute();
  await db.schema.dropTable("department").execute();
  await db.schema.dropTable("region").execute();

  await db.schema.dropIndex("infra_zone_slug_idx").execute();
  await db.schema.dropIndex("commune_slug_idx").execute();

  await db.schema.alterTable("infra_zone").dropColumn("slug").execute();
  await db.schema.alterTable("commune").dropColumn("slug").execute();

  await sql`CREATE VIEW city AS SELECT * FROM commune`.execute(db);
}
