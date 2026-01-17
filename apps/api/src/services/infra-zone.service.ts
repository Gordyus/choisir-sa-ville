import type { Db } from "@csv/db";

export type InfraZoneListItem = {
  type: "ARM" | "COMD" | "COMA";
  code: string;
  parentCommuneCode: string;
  name: string;
};

export type InfraZoneCodeInfo = Pick<
  InfraZoneListItem,
  "type" | "code" | "parentCommuneCode"
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
    .select(["type", "code", "parentCommuneCode", "name"])
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
    .select(["type", "code", "parentCommuneCode"])
    .where("code", "=", code)
    .executeTakeFirst();

  return row ?? null;
}
