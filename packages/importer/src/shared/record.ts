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

export function resolveColumn(record: Record<string, string>, keys: string[]): string | null {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      return key;
    }
  }
  return null;
}

