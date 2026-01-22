import type { Db } from "@csv/db";
import { sql } from "kysely";
import type {
  CommuneInsert,
  DepartmentInsert,
  InfraZoneInsert,
  RegionInsert
} from "./types.js";

export async function flushRegionBatch(
  db: Db | null,
  batch: Map<string, RegionInsert>,
  dryRun: boolean
): Promise<number> {
  if (batch.size === 0) return 0;

  const values = Array.from(batch.values());
  batch.clear();

  if (dryRun) return values.length;
  if (!db) throw new Error("Database connection is not initialized.");

  await db
    .insertInto("region")
    .values(values)
    .onConflict((oc) =>
      oc.column("code").doUpdateSet((eb) => ({
        name: eb.ref("excluded.name"),
        updatedAt: sql`now()`
      }))
    )
    .execute();

  return values.length;
}

export async function flushDepartmentBatch(
  db: Db | null,
  batch: Map<string, DepartmentInsert>,
  dryRun: boolean
): Promise<number> {
  if (batch.size === 0) return 0;

  const values = Array.from(batch.values());
  batch.clear();

  if (dryRun) return values.length;
  if (!db) throw new Error("Database connection is not initialized.");

  await db
    .insertInto("department")
    .values(values)
    .onConflict((oc) =>
      oc.column("code").doUpdateSet((eb) => ({
        name: eb.ref("excluded.name"),
        regionCode: eb.ref("excluded.regionCode"),
        updatedAt: sql`now()`
      }))
    )
    .execute();

  return values.length;
}

export async function flushCommuneBatch(
  db: Db | null,
  batch: Map<string, CommuneInsert>,
  dryRun: boolean
): Promise<number> {
  if (batch.size === 0) return 0;

  const values = Array.from(batch.values());
  batch.clear();

  if (dryRun) return values.length;
  if (!db) throw new Error("Database connection is not initialized.");

  await db
    .insertInto("commune")
    .values(values)
    .onConflict((oc) =>
      oc.column("inseeCode").doUpdateSet((eb) => ({
        name: eb.ref("excluded.name"),
        slug: eb.ref("excluded.slug"),
        population: eb.ref("excluded.population"),
        departmentCode: eb.ref("excluded.departmentCode"),
        regionCode: eb.ref("excluded.regionCode"),
        lat: eb.ref("excluded.lat"),
        lon: eb.ref("excluded.lon"),
        geoSource: eb.ref("excluded.geoSource"),
        geoPrecision: eb.ref("excluded.geoPrecision"),
        updatedAt: sql`now()`
      }))
    )
    .execute();

  return values.length;
}

export async function flushInfraBatch(
  db: Db | null,
  batch: Map<string, InfraZoneInsert>,
  dryRun: boolean
): Promise<number> {
  if (batch.size === 0) return 0;

  const values = Array.from(batch.values());
  batch.clear();

  if (dryRun) return values.length;
  if (!db) throw new Error("Database connection is not initialized.");

  await db
    .insertInto("infra_zone")
    .values(values)
    .onConflict((oc) =>
      oc.columns(["type", "code"]).doUpdateSet((eb) => ({
        parentCommuneCode: eb.ref("excluded.parentCommuneCode"),
        name: eb.ref("excluded.name"),
        slug: eb.ref("excluded.slug"),
        updatedAt: sql`now()`
      }))
    )
    .execute();

  return values.length;
}

export async function flushCommunePopulationReferenceBatch(
  db: Db | null,
  batch: Map<string, number>,
  dryRun: boolean
): Promise<number> {
  if (batch.size === 0) return 0;

  const entries = Array.from(batch.entries());
  batch.clear();

  if (dryRun) return entries.length;
  if (!db) throw new Error("Database connection is not initialized.");

  // Perform a single UPDATE using FROM (VALUES ...) for efficient batch updates
  const valuesFragment = sql.join(
    entries.map(([code, pop]) => sql`(${code}, ${pop})`),
    sql`, `
  );

  await sql`UPDATE commune AS c
            SET "population" = v."population"::int,
                "updatedAt" = now()
            FROM (VALUES ${valuesFragment}) AS v("inseeCode", "population")
            WHERE c."inseeCode" = v."inseeCode"`.execute(db);

  return entries.length;
}
