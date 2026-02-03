-- Squashed schema migration (replaces historical TS migrations).

-- Core tables
CREATE TABLE "region" (
  "code" varchar(3) PRIMARY KEY,
  "name" text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "department" (
  "code" varchar(3) PRIMARY KEY,
  "name" text NOT NULL,
  "regionCode" varchar(3) REFERENCES "region"("code"),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "department_region_code_idx" ON "department" ("regionCode");

CREATE TABLE "commune" (
  "inseeCode" varchar(5) PRIMARY KEY,
  "name" text NOT NULL,
  "population" integer,
  "departmentCode" varchar(3) REFERENCES "department"("code"),
  "regionCode" varchar(3) REFERENCES "region"("code"),
  "lat" double precision,
  "lon" double precision,
  "slug" text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "commune_name_idx" ON "commune" ("name");
CREATE INDEX "commune_department_code_idx" ON "commune" ("departmentCode");
CREATE INDEX "commune_region_code_idx" ON "commune" ("regionCode");
CREATE UNIQUE INDEX "commune_slug_idx" ON "commune" ("slug");

CREATE TABLE "infra_zone" (
  "id" text PRIMARY KEY,
  "type" text NOT NULL,
  "code" varchar(5) NOT NULL,
  "parentCommuneCode" varchar(5) NOT NULL REFERENCES "commune"("inseeCode") ON DELETE CASCADE,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "infra_zone_type_check" CHECK ("type" IN ('ARM','COMD','COMA'))
);

CREATE INDEX "infra_zone_parent_idx" ON "infra_zone" ("parentCommuneCode");
CREATE UNIQUE INDEX "infra_zone_type_code_idx" ON "infra_zone" ("type", "code");
CREATE UNIQUE INDEX "infra_zone_slug_idx" ON "infra_zone" ("slug");

CREATE TABLE "commune_postal_code" (
  "communeCode" varchar(5) NOT NULL REFERENCES "commune"("inseeCode") ON DELETE CASCADE,
  "postalCode" varchar(10) NOT NULL,
  CONSTRAINT "commune_postal_code_pk" PRIMARY KEY ("communeCode", "postalCode")
);

CREATE INDEX "commune_postal_code_postal_idx" ON "commune_postal_code" ("postalCode");

CREATE TABLE "cache_store" (
  "key" text PRIMARY KEY,
  "value" jsonb NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "cache_store_expires_idx" ON "cache_store" ("expiresAt");

-- Compatibility view (legacy API naming)
DROP VIEW IF EXISTS "city";
CREATE VIEW "city" AS SELECT * FROM "commune";

-- Minimal seed (dev convenience; preserves historical behavior)
INSERT INTO "commune" ("inseeCode", "name", "population", "slug")
VALUES
  ('75056', 'Paris', 2165423, 'paris-75056'),
  ('69123', 'Lyon', 522250, 'lyon-69123'),
  ('13055', 'Marseille', 873076, 'marseille-13055')
ON CONFLICT ("inseeCode") DO NOTHING;
