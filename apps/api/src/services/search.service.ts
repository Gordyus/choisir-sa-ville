import type { ZoneResultRow } from "@csv/core";
import { SearchRequestSchema } from "@csv/core";
import type { Db, Database } from "@csv/db";
import { sql, type SelectQueryBuilder } from "kysely";
import type { z } from "zod";

type SearchRequest = z.infer<typeof SearchRequestSchema>;

export type SearchResult = {
  items: ZoneResultRow[];
  total: number;
};

export type SearchService = {
  searchZones: (input: SearchRequest) => Promise<SearchResult>;
};

export function createSearchService(db: Db): SearchService {
  return {
    searchZones: (input) => searchZones(db, input)
  };
}

async function searchZones(db: Db, input: SearchRequest): Promise<SearchResult> {
  const selection = applySearchFilters(
    db
      .selectFrom("commune")
      .select([
        "inseeCode",
        "name",
        "population",
        "departmentCode",
        "regionCode",
        "lat",
        "lon"
      ]),
    input
  );

  const sorted = applySearchSort(selection, input);
  const rows = await sorted.limit(input.limit).offset(input.offset).execute();

  const countRow = await applySearchFilters(
    db.selectFrom("commune").select(sql<number>`count(*)`.as("count")),
    input
  ).executeTakeFirst();

  const total = Number(countRow?.count ?? 0);

  const items: ZoneResultRow[] = rows
    .filter((row) => row.lat !== null && row.lon !== null)
    .map((row) => ({
      zoneId: row.inseeCode,
      zoneName: row.name,
      type: "city",
      centroid: {
        lat: row.lat as number,
        lng: row.lon as number
      },
      attributes: {
        population: row.population,
        departmentCode: row.departmentCode,
        regionCode: row.regionCode
      },
      travel: null
    }));

  return {
    items,
    total: Number.isNaN(total) ? 0 : total
  };
}

type CommuneQuery<T> = SelectQueryBuilder<Database, "commune", T>;

function applySearchFilters<T>(query: CommuneQuery<T>, input: SearchRequest): CommuneQuery<T> {
  let qb = query.where("lat", "is not", null).where("lon", "is not", null);

  const bbox = input.area.bbox;
  if (bbox) {
    qb = qb
      .where("lat", ">=", bbox.minLat)
      .where("lat", "<=", bbox.maxLat)
      .where("lon", ">=", bbox.minLon)
      .where("lon", "<=", bbox.maxLon);
  }

  const filters = input.filters ?? {};
  const q = typeof filters.q === "string" ? filters.q.trim() : "";
  if (q.length > 0) {
    qb = qb.where((eb) =>
      eb.or([
        eb("commune.name", "ilike", `%${q}%`),
        eb.exists(
          eb
            .selectFrom("commune_postal_code")
            .select(sql`1`.as("one"))
            .where("commune_postal_code.postalCode", "ilike", `%${q}%`)
            .where(sql<boolean>`commune_postal_code.communeCode = commune.inseeCode`)
        )
      ])
    );
  }

  const departmentCode =
    typeof filters.departmentCode === "string" ? filters.departmentCode.trim() : "";
  if (departmentCode.length > 0) {
    qb = qb.where("departmentCode", "=", departmentCode);
  }

  const regionCode =
    typeof filters.regionCode === "string" ? filters.regionCode.trim() : "";
  if (regionCode.length > 0) {
    qb = qb.where("regionCode", "=", regionCode);
  }

  return qb;
}

function applySearchSort<T>(query: CommuneQuery<T>, input: SearchRequest): CommuneQuery<T> {
  const sort = input.sort;
  const direction = sort?.direction ?? "asc";

  if (sort?.key === "population") {
    return query
      .orderBy(sql`commune.population IS NULL`, "asc")
      .orderBy("commune.population", direction)
      .orderBy("commune.name", "asc");
  }

  if (sort?.key === "name") {
    return query.orderBy("commune.name", direction);
  }

  return query
    .orderBy(sql`commune.population IS NULL`, "asc")
    .orderBy("commune.population", "desc")
    .orderBy("commune.name", "asc");
}
