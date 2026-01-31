export type TabularJson = {
    columns: string[];
    rows: unknown[][];
};

export async function fetchTabularJson(url: string, signal?: AbortSignal): Promise<TabularJson> {
    const response = await fetch(url, { signal: signal ?? null, cache: "force-cache" });
    if (!response.ok) {
        throw new Error(`Failed to load tabular file: ${url}`);
    }
    return (await response.json()) as TabularJson;
}

export function requireColumnIndex(columns: string[], name: string): number {
    const index = columns.indexOf(name);
    if (index === -1) {
        throw new Error(`Missing column: ${name}`);
    }
    return index;
}

export function readString(row: unknown[], index: number): string | null {
    const value = row[index];
    if (value == null) return null;
    if (typeof value === "string") return value;
    return String(value);
}

export function readNumber(row: unknown[], index: number): number | null {
    const value = row[index];
    if (value == null) return null;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
        const normalized = value.replace(",", ".");
        const parsed = Number.parseFloat(normalized);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

