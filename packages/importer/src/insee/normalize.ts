import type { InfraZoneType } from "./types.js";

export function normalizeRecord(record: Record<string, string>): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    normalized[key.trim().toLowerCase()] = typeof value === "string" ? value.trim() : value;
  }
  return normalized;
}

export function pickValue(record: Record<string, string>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return undefined;
}

export function normalizeCode(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().toUpperCase();
  return trimmed.length === 0 ? null : trimmed;
}

export function normalizeInseeCode(value: string | undefined): string | null {
  const trimmed = normalizeCode(value);
  if (!trimmed) return null;
  if (/^\d{1,4}$/.test(trimmed)) return trimmed.padStart(5, "0");
  if (trimmed.length !== 5) return null;
  return trimmed;
}

function slugify(value: string): string {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const lower = normalized.toLowerCase();
  const cleaned = lower.replace(/[^a-z0-9]+/g, "-");
  return cleaned.replace(/-+/g, "-").replace(/^-+|-+$/g, "");
}

export function communeSlug(name: string, inseeCode: string): string {
  const base = slugify(name);
  const safeBase = base.length > 0 ? base : inseeCode;
  return `${safeBase}-${inseeCode}`;
}

export function infraZoneSlug(name: string, type: InfraZoneType, code: string): string {
  const base = slugify(name);
  const safeBase = base.length > 0 ? base : code;
  return `${safeBase}-${type.toLowerCase()}-${code}`;
}

export function parseInteger(value: string | undefined): number | null {
  if (!value) return null;
  const cleaned = value.replace(/\s/g, "").replace(",", ".");
  const parsed = Number.parseInt(cleaned, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const cleaned = value.replace(/\s/g, "").replace(",", ".");
  const parsed = Number.parseFloat(cleaned);
  return Number.isNaN(parsed) ? null : parsed;
}

export function isInfraZoneType(type: string | null): type is InfraZoneType {
  return type === "ARM" || type === "COMD" || type === "COMA";
}
