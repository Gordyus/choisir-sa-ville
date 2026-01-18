import type { Generated } from "kysely";

export type CommuneTable = {
  inseeCode: string;
  name: string;
  slug: string;
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
  slug: string;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
};

export type RegionTable = {
  code: string;
  name: string;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
};

export type DepartmentTable = {
  code: string;
  name: string;
  regionCode: string | null;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
};

export type CommunePostalCodeTable = {
  communeCode: string;
  postalCode: string;
};

export type CacheStoreTable = {
  key: string;
  value: unknown;
  expiresAt: Date;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
};

export type Database = {
  commune: CommuneTable;
  infra_zone: InfraZoneTable;
  region: RegionTable;
  department: DepartmentTable;
  commune_postal_code: CommunePostalCodeTable;
  cache_store: CacheStoreTable;
  city: CommuneTable;
};
