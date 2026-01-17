import type { Generated } from "kysely";

export type CommuneTable = {
  inseeCode: string;
  name: string;
  population: number | null;
  departmentCode: string | null;
  regionCode: string | null;
  lat: number | null;
  lon: number | null;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
};

export type InfraZoneTable = {
  id: string;
  type: "ARM" | "COMD" | "COMA";
  code: string;
  parentCommuneCode: string;
  name: string;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
};

export type Database = {
  commune: CommuneTable;
  infra_zone: InfraZoneTable;
  city: CommuneTable;
};
