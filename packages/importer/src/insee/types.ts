import type { Database } from "@csv/db";
import type { Insertable } from "kysely";

export type InfraZoneType = "ARM" | "COMD" | "COMA";
export type ImportOnlyType = "COM" | InfraZoneType;

export type ImportOptions = {
  source: string;
  regionSource: string;
  departmentSource: string;
  postalSource: string;
  skipPostal: boolean;
  force: boolean;
  limit?: number;
  postalLimit?: number;
  dryRun: boolean;
  onlyType?: ImportOnlyType;
  includeInfra: boolean;
};

export type CommuneInsert = Insertable<Database["commune"]>;
export type InfraZoneInsert = Insertable<Database["infra_zone"]>;
export type RegionInsert = Insertable<Database["region"]>;
export type DepartmentInsert = Insertable<Database["department"]>;
