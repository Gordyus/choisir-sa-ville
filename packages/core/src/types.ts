export type City = {
  inseeCode: string;
  name: string;
  population: number | null;
};

export type Commune = {
  inseeCode: string;
  name: string;
  slug: string;
  population: number | null;
  departmentCode: string | null;
  regionCode: string | null;
  lat: number | null;
  lon: number | null;
  departmentName?: string | null;
  regionName?: string | null;
  postalCodes?: string[];
};

export type InfraZoneType = "ARM" | "COMD" | "COMA";

export type InfraZone = {
  id: string;
  type: InfraZoneType;
  code: string;
  parentCommuneCode: string;
  name: string;
  slug: string;
};

export type Region = {
  code: string;
  name: string;
};

export type Department = {
  code: string;
  name: string;
  regionCode: string | null;
};
