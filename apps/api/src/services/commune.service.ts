import type { Db } from "@csv/db";

export type CityListItem = {
  inseeCode: string;
  name: string;
  population: number | null;
  departmentCode: string | null;
  regionCode: string | null;
  lat: number | null;
  lon: number | null;
};

export type CityDetails = CityListItem;

export async function listCities(
  db: Db,
  query: { q: string; limit: number; offset: number }
): Promise<CityListItem[]> {
  return db
    .selectFrom("commune")
    .select([
      "inseeCode",
      "name",
      "population",
      "departmentCode",
      "regionCode",
      "lat",
      "lon"
    ])
    .where("name", "ilike", `%${query.q}%`)
    .orderBy("population", "desc")
    .orderBy("name", "asc")
    .limit(query.limit)
    .offset(query.offset)
    .execute();
}

export async function getCityByInseeCode(
  db: Db,
  inseeCode: string
): Promise<CityDetails | null> {
  const row = await db
    .selectFrom("commune")
    .select([
      "inseeCode",
      "name",
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
