-- Best-effort rollback for 001_squashed.sql
DROP VIEW IF EXISTS "city";
DROP TABLE IF EXISTS "cache_store" CASCADE;
DROP TABLE IF EXISTS "commune_postal_code" CASCADE;
DROP TABLE IF EXISTS "infra_zone" CASCADE;
DROP TABLE IF EXISTS "department" CASCADE;
DROP TABLE IF EXISTS "region" CASCADE;
DROP TABLE IF EXISTS "commune" CASCADE;

