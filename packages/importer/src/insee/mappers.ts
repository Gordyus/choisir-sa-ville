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

type CommuneMapResult =
  | { row: CommuneInsert; parentCode: string | null }
  | { skip: "ignored" | "invalid" };
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

  const departmentCode = normalizeCode(
    pickValue(normalized, ["dep", "departement", "department_code"])
  );
  const explicitParent = pickValue(normalized, [
    "comparent",
    "parent",
    "parent_commune",
    "code_commune_parent",
    "code_insee_rattachement",
    "parent_code_insee"
  ]);
  const inferredParent =
    explicitParent ??
    (() => {
      const key = Object.keys(normalized).find(
        (entry) => entry.includes("parent") || entry.includes("ratt")
      );
      return key ? normalized[key] : undefined;
    })();
  const depDigits = (departmentCode ?? "").replace(/\D/g, "");
  let parentCode = normalizeParentInseeCode(inferredParent, depDigits);
  if (!parentCode) {
    const entries = Object.entries(normalized);
    for (let i = entries.length - 1; i >= 0; i -= 1) {
      const value = entries[i]?.[1];
      if (!value) continue;
      const candidate = value.trim();
      if (!/^\d{4,5}$/.test(candidate)) continue;
      if (candidate === inseeCode) continue;
      parentCode = normalizeParentInseeCode(candidate, depDigits);
      if (parentCode) break;
    }
  }

  return {
    row: {
      inseeCode,
      name: name.trim(),
      slug: communeSlug(name, inseeCode),
      population: parseInteger(
        pickValue(normalized, ["population", "pop_total", "pmun"])
      ),
      departmentCode,
      regionCode: normalizeCode(pickValue(normalized, ["reg", "region", "region_code"])),
      lat: parseNumber(pickValue(normalized, ["lat", "latitude", "latitude_deg"])),
      lon: parseNumber(pickValue(normalized, ["lon", "longitude", "longitude_deg"]))
    },
    parentCode
  };
}

export function normalizeParentInseeCode(
  value: string | undefined,
  departmentCode: string | null
): string | null {
  if (!value) return null;
  const cleaned = value.trim();
  if (!cleaned) return null;

  const digits = cleaned.replace(/\D/g, "");
  if (!digits) return null;

  if (digits.length === 5) {
    return digits;
  }

  const depDigits = (departmentCode ?? "").replace(/\D/g, "");
  if (depDigits.length >= 2) {
    if (digits.startsWith(depDigits)) {
      const suffix = digits.slice(depDigits.length).padStart(3, "0");
      return `${depDigits}${suffix}`;
    }
    return `${depDigits}${digits.padStart(3, "0")}`;
  }

  return normalizeInseeCode(digits);
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
