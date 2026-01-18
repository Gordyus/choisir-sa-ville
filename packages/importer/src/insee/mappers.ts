import type { CommuneInsert, DepartmentInsert, InfraZoneInsert, RegionInsert } from "./types.js";
import {
  communeSlug,
  infraZoneSlug,
  isInfraZoneType,
  normalizeCode,
  normalizeInseeCode,
  normalizeRecord,
  parseInteger,
  parseNumber,
  pickValue
} from "./normalize.js";

type CommuneMapResult = { row: CommuneInsert } | { skip: "ignored" | "invalid" };
type InfraZoneMapResult =
  | { row: InfraZoneInsert }
  | { skip: "ignored" | "invalid" | "missing_parent" };
type RegionMapResult = { row: RegionInsert } | { skip: "invalid" };
type DepartmentMapResult = { row: DepartmentInsert } | { skip: "invalid" };

export function mapToCommune(record: Record<string, string>): CommuneMapResult {
  const normalized = normalizeRecord(record);
  const typecom = normalizeCode(pickValue(normalized, ["typecom"]));
  if (typecom !== "COM") return { skip: "ignored" };

  const inseeCode = normalizeInseeCode(
    pickValue(normalized, ["com", "insee_code", "code_insee", "codgeo"])
  );
  const name = pickValue(normalized, ["libelle", "libelle_geo", "nccenr", "ncc", "nom"]);

  if (!inseeCode || !name) return { skip: "invalid" };

  return {
    row: {
      inseeCode,
      name: name.trim(),
      slug: communeSlug(name, inseeCode),
      population: parseInteger(
        pickValue(normalized, ["population", "pop_total", "pmun"])
      ),
      departmentCode: normalizeCode(
        pickValue(normalized, ["dep", "departement", "department_code"])
      ),
      regionCode: normalizeCode(pickValue(normalized, ["reg", "region", "region_code"])),
      lat: parseNumber(pickValue(normalized, ["lat", "latitude", "latitude_deg"])),
      lon: parseNumber(pickValue(normalized, ["lon", "longitude", "longitude_deg"]))
    }
  };
}

export function mapToInfraZone(record: Record<string, string>): InfraZoneMapResult {
  const normalized = normalizeRecord(record);
  const typecom = normalizeCode(pickValue(normalized, ["typecom"]));
  if (!typecom || typecom === "COM") return { skip: "ignored" };
  if (!isInfraZoneType(typecom)) return { skip: "ignored" };

  const code = normalizeInseeCode(
    pickValue(normalized, ["com", "insee_code", "code_insee", "codgeo"])
  );
  const parentCommuneCode = normalizeInseeCode(
    pickValue(normalized, ["comparent", "parent", "parent_commune"])
  );
  const name = pickValue(normalized, ["libelle", "libelle_geo", "nccenr", "ncc", "nom"]);

  if (!code || !name) return { skip: "invalid" };
  if (!parentCommuneCode) return { skip: "missing_parent" };

  return {
    row: {
      id: `${typecom}:${code}`,
      type: typecom,
      code,
      parentCommuneCode,
      name: name.trim(),
      slug: infraZoneSlug(name, typecom, code)
    }
  };
}

export function mapToRegion(record: Record<string, string>): RegionMapResult {
  const normalized = normalizeRecord(record);
  const code = normalizeCode(pickValue(normalized, ["reg", "code", "region_code"]));
  const name = pickValue(normalized, ["libelle", "name", "nom"]);

  if (!code || !name) return { skip: "invalid" };

  return { row: { code, name: name.trim() } };
}

export function mapToDepartment(record: Record<string, string>): DepartmentMapResult {
  const normalized = normalizeRecord(record);
  const code = normalizeCode(pickValue(normalized, ["dep", "code", "department_code"]));
  const name = pickValue(normalized, ["libelle", "name", "nom"]);
  const regionCode = normalizeCode(pickValue(normalized, ["reg", "region_code"]));

  if (!code || !name) return { skip: "invalid" };

  return { row: { code, name: name.trim(), regionCode } };
}
