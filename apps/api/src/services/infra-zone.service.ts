import type { Db } from "@csv/db";

export type InfraZoneListItem = {
  type: "ARM" | "COMD" | "COMA";
  code: string;
  parentCommuneCode: string;
  name: string;
  slug: string;
};

export type InfraZoneCodeInfo = Pick<
  InfraZoneListItem,
  "type" | "code" | "parentCommuneCode" | "slug"
>;

export async function listInfraZones(
  db: Db,
  params: {
    parentCommuneCode: string;
    type?: "ARM" | "COMD" | "COMA";
    limit: number;
    offset: number;
  }
): Promise<InfraZoneListItem[]> {
  let query = db
    .selectFrom("infra_zone")
    .select(["type", "code", "parentCommuneCode", "name", "slug"])
    .where("parentCommuneCode", "=", params.parentCommuneCode);

  if (params.type) {
    query = query.where("type", "=", params.type);
  }

  return query
    .orderBy("type", "asc")
    .orderBy("code", "asc")
    .orderBy("name", "asc")
    .limit(params.limit)
    .offset(params.offset)
    .execute();
}

export async function findInfraZoneByCode(
  db: Db,
  code: string
): Promise<InfraZoneCodeInfo | null> {
  const row = await db
    .selectFrom("infra_zone")
    .select(["type", "code", "parentCommuneCode", "slug"])
    .where("code", "=", code)
    .executeTakeFirst();

  return row ?? null;
}

export async function findInfraZoneByCodeOrSlug(
  db: Db,
  id: string
): Promise<InfraZoneCodeInfo | null> {
  const row = await db
    .selectFrom("infra_zone")
    .select(["type", "code", "parentCommuneCode", "slug"])
    .where((eb) =>
      eb.or([eb("code", "=", id), eb("slug", "=", id)])
    )
    .executeTakeFirst();

  return row ?? null;
}
