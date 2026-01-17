import type { Db } from "@csv/db";

export type InfraZoneListItem = {
  id: string;
  type: "ARM" | "COMD" | "COMA";
  code: string;
  parentCommuneCode: string;
  name: string;
};

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
    .select(["id", "type", "code", "parentCommuneCode", "name"])
    .where("parentCommuneCode", "=", params.parentCommuneCode);

  if (params.type) {
    query = query.where("type", "=", params.type);
  }

  return query.orderBy("name", "asc").limit(params.limit).offset(params.offset).execute();
}
