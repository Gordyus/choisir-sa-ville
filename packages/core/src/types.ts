export type City = {
  inseeCode: string;
  name: string;
  population: number | null;
};

export type Commune = {
  inseeCode: string;
  name: string;
  population: number | null;
  departmentCode: string | null;
  regionCode: string | null;
  lat: number | null;
  lon: number | null;
};

export type InfraZoneType = "ARM" | "COMD" | "COMA";

export type InfraZone = {
  id: string;
  type: InfraZoneType;
  code: string;
  parentCommuneCode: string;
  name: string;
};
