import { normalizeQuery } from "@csv/core";
import type { GeocodeCandidate, GeocodeResponse } from "@csv/core";
import type { Db } from "@csv/db";
import { sql } from "kysely";

type AreaSuggestInput = {
  query: string;
  limit?: number;
};

export type AreaSuggestService = {
  suggest: (input: AreaSuggestInput) => Promise<GeocodeResponse>;
};

export type RankedCandidate = {
  key: string;
  candidate: GeocodeCandidate;
  rank: number;
  population?: number | null;
};

const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 20;
const MAX_FETCH = 80;

export function createAreaSuggestService(db: Db): AreaSuggestService {
  return {
    suggest: (input) => suggestAreas(db, input)
  };
}

async function suggestAreas(db: Db, input: AreaSuggestInput): Promise<GeocodeResponse> {
  const normalized = normalizeQuery(input.query);
  if (!normalized) return { candidates: [] };
  const slugQuery = normalizeSlugQuery(normalized);
  if (!slugQuery) return { candidates: [] };

  const limit = Math.min(Math.max(input.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const like = `%${normalized}%`;
  const slugLike = `%${slugQuery}%`;
  const prefix = `${normalized}%`;
  const fetchLimit = Math.min(Math.max(limit * 4, 12), MAX_FETCH);
  const queryLower = normalized.toLowerCase();
  const isNumeric = /^\d/.test(queryLower);

  const [communes, departments, regions, postalMatches] = await Promise.all([
    db
      .selectFrom("commune")
      .select([
        "inseeCode",
        "name",
        "lat",
        "lon",
        "slug",
        "population",
        "departmentCode",
        "regionCode"
      ])
      .where((eb) =>
        eb.or([
          eb("commune.name", "ilike", like),
          eb("commune.slug", "ilike", slugLike),
          eb("commune.inseeCode", "like", prefix),
          sql`${normalizeForSql("commune.name")} like ${slugLike}`
        ])
      )
      .where("commune.lat", "is not", null)
      .where("commune.lon", "is not", null)
      .limit(fetchLimit)
      .execute(),
    db
      .selectFrom("department")
      .select(["code", "name", "regionCode"])
      .where((eb) =>
        eb.or([
          eb("department.name", "ilike", like),
          eb("department.code", "like", prefix),
          sql`${normalizeForSql("department.name")} like ${slugLike}`
        ])
      )
      .limit(fetchLimit)
      .execute(),
    db
      .selectFrom("region")
      .select(["code", "name"])
      .where((eb) =>
        eb.or([
          eb("region.name", "ilike", like),
          eb("region.code", "like", prefix),
          sql`${normalizeForSql("region.name")} like ${slugLike}`
        ])
      )
      .limit(fetchLimit)
      .execute(),
    isNumeric
      ? db
          .selectFrom("commune_postal_code")
          .innerJoin(
            "commune",
            "commune.inseeCode",
            "commune_postal_code.communeCode"
          )
          .select([
            "commune_postal_code.postalCode as postalCode",
            "commune.inseeCode as inseeCode",
            "commune.name as name",
            "commune.lat as lat",
            "commune.lon as lon",
            "commune.population as population",
            "commune.departmentCode as departmentCode",
            "commune.regionCode as regionCode"
          ])
          .where("commune_postal_code.postalCode", "like", prefix)
          .where("commune.lat", "is not", null)
          .where("commune.lon", "is not", null)
          .limit(fetchLimit)
          .execute()
      : Promise.resolve([])
  ]);

  const communePostalCodes = await loadCommunePostalCodes(
    db,
    communes.map((commune) => commune.inseeCode)
  );
  const departmentCenters = await loadDepartmentCenters(
    db,
    departments.map((dept) => dept.code)
  );
  const regionCenters = await loadRegionCenters(
    db,
    regions.map((region) => region.code)
  );

  const ranked = new Map<string, RankedCandidate>();
  const preferPostal = isNumeric;

  for (const commune of communes) {
    if (!isFiniteCoordinate(commune.lat) || !isFiniteCoordinate(commune.lon)) continue;
    const postalCode = communePostalCodes.get(commune.inseeCode);
    const label = postalCode
      ? `${commune.name} (${postalCode})`
      : `${commune.name} (${commune.inseeCode})`;
    const rank = computeCandidateRank(queryLower, slugQuery, {
      values: [commune.name, commune.slug ?? "", commune.inseeCode, postalCode ?? ""],
      slugValues: [commune.slug ?? "", normalizeSlugQuery(commune.name)]
    });
    addCandidate(ranked, {
      key: `commune:${commune.inseeCode}`,
      candidate: {
        label,
        lat: commune.lat,
        lng: commune.lon,
        source: "commune",
        code: commune.inseeCode,
        postalCode,
        deptCode: commune.departmentCode ?? undefined,
        regionCode: commune.regionCode ?? undefined
      },
      rank,
      population: commune.population
    });
  }

  for (const match of postalMatches) {
    if (!isFiniteCoordinate(match.lat) || !isFiniteCoordinate(match.lon)) continue;
    const label = `${match.postalCode} - ${match.name}`;
    const rank = computeCandidateRank(queryLower, slugQuery, {
      values: [match.postalCode, match.name, match.inseeCode],
      slugValues: [normalizeSlugQuery(match.name)]
    });
    addCandidate(
      ranked,
      {
        key: `commune:${match.inseeCode}`,
        candidate: {
          label,
          lat: match.lat,
          lng: match.lon,
          source: "postalCode",
          code: match.inseeCode,
          postalCode: match.postalCode,
          deptCode: match.departmentCode ?? undefined,
          regionCode: match.regionCode ?? undefined
        },
        rank,
        population: match.population
      },
      { preferPostal }
    );
  }

  for (const department of departments) {
    const center = departmentCenters.get(department.code);
    if (!center) continue;
    const label = `${department.name} (Department ${department.code})`;
    const rank = computeCandidateRank(queryLower, slugQuery, {
      values: [department.name, department.code],
      slugValues: [normalizeSlugQuery(department.name)]
    });
    addCandidate(ranked, {
      key: `department:${department.code}`,
      candidate: {
        label,
        lat: center.lat,
        lng: center.lon,
        source: "department",
        code: department.code,
        deptCode: department.code,
        regionCode: department.regionCode ?? undefined
      },
      rank
    });
  }

  for (const region of regions) {
    const center = regionCenters.get(region.code);
    if (!center) continue;
    const label = `${region.name} (Region ${region.code})`;
    const rank = computeCandidateRank(queryLower, slugQuery, {
      values: [region.name, region.code],
      slugValues: [normalizeSlugQuery(region.name)]
    });
    addCandidate(ranked, {
      key: `region:${region.code}`,
      candidate: {
        label,
        lat: center.lat,
        lng: center.lon,
        source: "region",
        code: region.code,
        regionCode: region.code
      },
      rank
    });
  }

  const candidates = sortRankedCandidates([...ranked.values()]).slice(0, limit);
  return { candidates };
}

async function loadCommunePostalCodes(
  db: Db,
  codes: string[]
): Promise<Map<string, string>> {
  if (codes.length === 0) return new Map();
  const rows = await db
    .selectFrom("commune_postal_code")
    .select([
      "commune_postal_code.communeCode as communeCode",
      sql<string>`min("postalCode")`.as("postalCode")
    ])
    .where("commune_postal_code.communeCode", "in", codes)
    .groupBy("commune_postal_code.communeCode")
    .execute();

  return new Map(
    rows
      .filter((row) => row.communeCode && row.postalCode)
      .map((row) => [row.communeCode as string, row.postalCode as string])
  );
}

async function loadDepartmentCenters(
  db: Db,
  codes: string[]
): Promise<Map<string, { lat: number; lon: number }>> {
  if (codes.length === 0) return new Map();
  const rows = await db
    .selectFrom("commune")
    .select([
      "commune.departmentCode as code",
      sql<number>`avg(commune.lat)`.as("lat"),
      sql<number>`avg(commune.lon)`.as("lon")
    ])
    .where("commune.departmentCode", "in", codes)
    .where("commune.lat", "is not", null)
    .where("commune.lon", "is not", null)
    .groupBy("commune.departmentCode")
    .execute();

  return new Map(
    rows
      .filter((row) => row.code && isFiniteCoordinate(row.lat) && isFiniteCoordinate(row.lon))
      .map((row) => [row.code as string, { lat: row.lat, lon: row.lon }])
  );
}

async function loadRegionCenters(
  db: Db,
  codes: string[]
): Promise<Map<string, { lat: number; lon: number }>> {
  if (codes.length === 0) return new Map();
  const rows = await db
    .selectFrom("commune")
    .select([
      "commune.regionCode as code",
      sql<number>`avg(commune.lat)`.as("lat"),
      sql<number>`avg(commune.lon)`.as("lon")
    ])
    .where("commune.regionCode", "in", codes)
    .where("commune.lat", "is not", null)
    .where("commune.lon", "is not", null)
    .groupBy("commune.regionCode")
    .execute();

  return new Map(
    rows
      .filter((row) => row.code && isFiniteCoordinate(row.lat) && isFiniteCoordinate(row.lon))
      .map((row) => [row.code as string, { lat: row.lat, lon: row.lon }])
  );
}

type AddCandidateOptions = {
  preferPostal?: boolean;
};

function addCandidate(
  ranked: Map<string, RankedCandidate>,
  next: RankedCandidate,
  options: AddCandidateOptions = {}
): void {
  const existing = ranked.get(next.key);
  if (!existing) {
    ranked.set(next.key, next);
    return;
  }
  if (next.rank < existing.rank) {
    ranked.set(next.key, next);
    return;
  }
  if (next.rank === existing.rank) {
    const nextPop = next.population ?? -1;
    const existingPop = existing.population ?? -1;
    if (nextPop > existingPop) {
      ranked.set(next.key, next);
      return;
    }
    if (
      options.preferPostal &&
      next.candidate.source === "postalCode" &&
      existing.candidate.source !== "postalCode"
    ) {
      ranked.set(next.key, next);
    }
  }
}

export function computeMatchRank(query: string, value: string): number {
  const target = value.trim().toLowerCase();
  if (!target) return 3;
  if (target === query) return 0;
  if (target.startsWith(query)) return 1;
  if (target.includes(query)) return 2;
  return 3;
}

export function bestMatchRank(query: string, values: string[]): number {
  if (!query) return 3;
  let best = 3;
  for (const value of values) {
    if (!value) continue;
    const rank = computeMatchRank(query, value);
    if (rank < best) best = rank;
    if (best === 0) return best;
  }
  return best;
}

export function computeCandidateRank(
  queryLower: string,
  slugQuery: string,
  input: { values: string[]; slugValues: string[] }
): number {
  const rank = bestMatchRank(queryLower, input.values);
  const slugRank = slugQuery ? bestMatchRank(slugQuery, input.slugValues) : 3;
  return Math.min(rank, slugRank);
}

export function sortRankedCandidates(candidates: RankedCandidate[]): GeocodeCandidate[] {
  return candidates
    .filter((entry) => isFiniteCoordinate(entry.candidate.lat) && isFiniteCoordinate(entry.candidate.lng))
    .sort((left, right) => {
      if (left.rank !== right.rank) return left.rank - right.rank;
      const leftPop = left.population ?? -1;
      const rightPop = right.population ?? -1;
      if (leftPop !== rightPop) return rightPop - leftPop;
      return left.candidate.label.localeCompare(right.candidate.label, "fr", {
        sensitivity: "base"
      });
    })
    .map((entry) => entry.candidate);
}

function isFiniteCoordinate(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function normalizeSlugQuery(value: string): string {
  const stripped = stripDiacritics(value);
  return stripped
    .trim()
    .toLowerCase()
    .replace(/[\s\-_'"’]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeForSql(column: string) {
  return sql`regexp_replace(translate(lower(${sql.ref(column)}), ${SQL_ACCENTS}, ${SQL_PLAIN}), '[\\s\\-_''’]+', '-', 'g')`;
}

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const SQL_ACCENTS =
  "àáâäãåçèéêëìíîïñòóôöõùúûüýÿÀÁÂÄÃÅÇÈÉÊËÌÍÎÏÑÒÓÔÖÕÙÚÛÜÝŸ";
const SQL_PLAIN = "aaaaaaceeeeiiiinooooouuuuyyAAAAAACEEEEIIIINOOOOOUUUUYY";
