import type { Db } from "@csv/db";

export type CityListItem = {
  inseeCode: string;
  name: string;
  population: number | null;
};

export type CityDetails = CityListItem & {
  departmentCode: string | null;
  regionCode: string | null;
  lat: number | null;
  lon: number | null;
};

export async function listCities(
  db: Db,
  query: { q: string; limit: number; offset: number }
): Promise<CityListItem[]> {
  return db
    .selectFrom("commune")
    .select(["inseeCode", "name", "population"])
    .where("name", "ilike", `%${query.q}%`)
    .orderBy("population", "desc")
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
