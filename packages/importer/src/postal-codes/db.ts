import type { Db, Database } from "@choisir-sa-ville/db";
import { sql, type OnConflictBuilder, type ExpressionBuilder, type Insertable } from "kysely";

type CommunePostalCodeInsert = Insertable<Database["commune_postal_code"]>;

export async function loadCommuneState(db: Db): Promise<{
  communeCodes: Set<string>;
  missingCoordinateCodes: Set<string>;
}> {
  const rows = await db.selectFrom("commune").select(["inseeCode", "lat", "lon"]).execute();
  const communeCodes = new Set<string>();
  const missingCoordinateCodes = new Set<string>();
  for (const row of rows) {
    communeCodes.add(row.inseeCode);
    if (row.lat === null || row.lon === null) {
      missingCoordinateCodes.add(row.inseeCode);
    }
  }
  return { communeCodes, missingCoordinateCodes };
}

export async function flushPostalBatch(
  db: Db | null,
  batch: Map<string, CommunePostalCodeInsert>,
  dryRun: boolean
): Promise<{ attempted: number; inserted?: number }> {
  if (batch.size === 0) return { attempted: 0 };

  const values = Array.from(batch.values());
  batch.clear();

  if (dryRun) return { attempted: values.length };
  if (!db) throw new Error("Database connection is not initialized.");

  const result = await db
    .insertInto("commune_postal_code")
    .values(values)
    .onConflict((oc: OnConflictBuilder<any, any>) => oc.columns(["communeCode", "postalCode"]).doNothing())
    .execute();

  let inserted: number | undefined;
  for (const item of result as Array<{ numInsertedOrUpdatedRows?: bigint }>) {
    if (item?.numInsertedOrUpdatedRows !== undefined) {
      const value = Number(item.numInsertedOrUpdatedRows);
      if (!Number.isNaN(value)) {
        inserted = (inserted ?? 0) + value;
      }
    }
  }

  return { attempted: values.length, inserted: inserted ?? 0 };
}

type CoordinateAggregate = {
  sumLat: number;
  sumLon: number;
  count: number;
};

export async function updateCommuneCoordinates(
  db: Db | null,
  coordinates: Map<string, CoordinateAggregate>,
  dryRun: boolean
): Promise<number> {
  if (coordinates.size === 0) return 0;
  if (dryRun || !db) return coordinates.size;

  let updated = 0;
  for (const [communeCode, aggregate] of coordinates) {
    if (aggregate.count === 0) continue;
    const lat = aggregate.sumLat / aggregate.count;
    const lon = aggregate.sumLon / aggregate.count;
    const result = await db
      .updateTable("commune")
      .set({
        lat: sql`COALESCE("commune"."lat", ${lat})`,
        lon: sql`COALESCE("commune"."lon", ${lon})`,
        updatedAt: sql`now()`
      })
      .where("inseeCode", "=", communeCode)
      .where((eb: ExpressionBuilder<any, any>) => eb.or([eb("lat", "is", null), eb("lon", "is", null)]))
      .executeTakeFirst();

    const count = result?.numUpdatedRows ? Number(result.numUpdatedRows) : 0;
    if (!Number.isNaN(count)) {
      updated += count;
    }
  }

  return updated;
}

export type { CommunePostalCodeInsert, CoordinateAggregate };
