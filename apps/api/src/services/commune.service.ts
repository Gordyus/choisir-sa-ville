import type { Db } from "@csv/db";
import { sql } from "kysely";

export type CityListItem = {
  inseeCode: string;
  name: string;
  slug: string;
  population: number | null;
  departmentCode: string | null;
  regionCode: string | null;
  lat: number | null;
  lon: number | null;
};

export type CityMarkerItem = {
  inseeCode: string;
  name: string;
  slug: string;
  lat: number;
  lon: number;
  departmentCode: string | null;
  regionCode: string | null;
};

export type CityDetails = CityListItem & {
  departmentName: string | null;
  regionName: string | null;
  postalCodes: string[];
};

export async function listCities(
  db: Db,
  query: { q: string; limit: number; offset: number }
): Promise<CityListItem[]> {
  return db
    .selectFrom("commune")
    .select([
      "inseeCode",
      "name",
      "slug",
      "population",
      "departmentCode",
      "regionCode",
      "lat",
      "lon"
    ])
    .where((eb) =>
      eb.or([
        eb("commune.name", "ilike", `%${query.q}%`),
        eb("commune.slug", "ilike", `%${query.q}%`),
        eb.exists(
          db
            .selectFrom("commune_postal_code")
            .select(sql`1`.as("one"))
            .where("commune_postal_code.postalCode", "ilike", `%${query.q}%`)
            .where(
              sql<boolean>`commune_postal_code.communeCode = commune.inseeCode`
            )
        )
      ])
    )
    .orderBy(sql`commune.population IS NULL`, "asc")
    .orderBy("commune.population", "desc")
    .orderBy("name", "asc")
    .limit(query.limit)
    .offset(query.offset)
    .execute();
}

export async function listCitiesByBBox(
  db: Db,
  query: {
    minLat: number;
    minLon: number;
    maxLat: number;
    maxLon: number;
    limit: number;
    offset: number;
  }
): Promise<CityMarkerItem[]> {
  const rows = await db
    .selectFrom("commune")
    .select([
      "inseeCode",
      "name",
      "slug",
      "lat",
      "lon",
      "departmentCode",
      "regionCode"
    ])
    .where("lat", "is not", null)
    .where("lon", "is not", null)
    .where("lat", ">=", query.minLat)
    .where("lat", "<=", query.maxLat)
    .where("lon", ">=", query.minLon)
    .where("lon", "<=", query.maxLon)
    .orderBy(sql`commune.population IS NULL`, "asc")
    .orderBy("commune.population", "desc")
    .orderBy("name", "asc")
    .limit(query.limit)
    .offset(query.offset)
    .execute();

  return rows
    .filter((row) => row.lat !== null && row.lon !== null)
    .map((row) => ({
      inseeCode: row.inseeCode,
      name: row.name,
      slug: row.slug,
      lat: row.lat as number,
      lon: row.lon as number,
      departmentCode: row.departmentCode,
      regionCode: row.regionCode
    }));
}

export async function getCityByInseeCode(
  db: Db,
  inseeCode: string
): Promise<CityListItem | null> {
  const row = await db
    .selectFrom("commune")
    .select([
      "inseeCode",
      "name",
      "slug",
      "population",
      "departmentCode",
      "regionCode",
      "lat",
      "lon"
    ])
    .where("inseeCode", "=", inseeCode)
    .executeTakeFirst();

  return row ?? null;
}

export async function getCityDetailsById(
  db: Db,
  id: string
): Promise<CityDetails | null> {
  const isCode = /^\d{5}$/.test(id);
  const row = await db
    .selectFrom("commune")
    .leftJoin("department", "department.code", "commune.departmentCode")
    .leftJoin("region", "region.code", "commune.regionCode")
    .select([
      "commune.inseeCode as inseeCode",
      "commune.name as name",
      "commune.slug as slug",
      "commune.population as population",
      "commune.departmentCode as departmentCode",
      "commune.regionCode as regionCode",
      "commune.lat as lat",
      "commune.lon as lon",
      "department.name as departmentName",
      "region.name as regionName"
    ])
    .where(isCode ? "commune.inseeCode" : "commune.slug", "=", id)
    .executeTakeFirst();

  if (!row) return null;

  const postalRows = await db
    .selectFrom("commune_postal_code")
    .select("postalCode")
    .where("communeCode", "=", row.inseeCode)
    .orderBy("postalCode", "asc")
    .execute();

  return {
    ...row,
    postalCodes: postalRows.map((item) => item.postalCode)
  };
}
