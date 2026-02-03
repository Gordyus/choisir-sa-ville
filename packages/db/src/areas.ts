import { sql } from "kysely";
import type { Db } from "./db.js";

type SearchAreasParams = {
    q: string;
    limit: number;
};

type DbAreaRow = {
    id: string;
    type: "commune" | "infra";
    label: string;
    communeCode: string;
    departmentCode: string | null;
    regionCode: string | null;
    populationSort: number | null;
};

export type AreaSearchItem = {
    id: string;
    type: "commune" | "infra";
    label: string;
    communeCode: string;
    departmentCode: string | null;
    regionCode: string | null;
};

export const searchAreas = async (
    db: Db,
    params: SearchAreasParams
): Promise<AreaSearchItem[]> => {
    const pattern = `${params.q}%`;
    const limit = Math.max(1, params.limit);

    const communeQuery = db
        .selectFrom("commune")
        .select([
            sql<"commune" | "infra">`'commune'`.as("type"),
            "commune.inseeCode as id",
            "commune.name as label",
            "commune.inseeCode as communeCode",
            "commune.departmentCode as departmentCode",
            "commune.regionCode as regionCode",
            "commune.population as populationSort"
        ])
        .where("commune.name", "ilike", pattern);

    const infraQuery = db
        .selectFrom("infra_zone")
        .innerJoin("commune", "commune.inseeCode", "infra_zone.parentCommuneCode")
        .select([
            sql<"commune" | "infra">`'infra'`.as("type"),
            "infra_zone.id as id",
            sql<string>`(${sql.ref("infra_zone.name")} || ' (' || ${sql.ref("commune.name")} || ')')`.as(
                "label"
            ),
            "infra_zone.parentCommuneCode as communeCode",
            "commune.departmentCode as departmentCode",
            "commune.regionCode as regionCode",
            sql<number | null>`null`.as("populationSort")
        ])
        .where("infra_zone.name", "ilike", pattern);

    const rows = await communeQuery
        .unionAll(infraQuery)
        .orderBy("populationSort", "desc")
        .orderBy("label", "asc")
        .limit(limit)
        .execute();

    return (rows as DbAreaRow[]).map((row) => ({
        id: row.id,
        type: row.type,
        label: row.label,
        communeCode: row.communeCode,
        departmentCode: row.departmentCode,
        regionCode: row.regionCode
    }));
};
