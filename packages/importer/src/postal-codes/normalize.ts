export function normalizeCommuneCode(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const padded = trimmed.padStart(5, "0");
  if (!/^\d{5}$/.test(padded)) return null;
  return padded;
}

export function normalizePostalCode(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const padded = trimmed.padStart(5, "0");
  if (!/^\d{5}$/.test(padded)) return null;
  return padded;
}

export function splitPostalValues(value: string): string[] {
  if (/[;,/|]/.test(value)) {
    return value
      .split(/[;,/|]/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  return [value.trim()];
}

export function parseCoordinate(value: string | undefined): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const normalized = trimmed.replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}
