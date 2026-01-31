export type MapTilesConfig = {
    vectorTilesBaseUrl: string;
    styleUrl: string;
    tilesMetadataUrl?: string;
    excludeLayers?: string[];
};

const DEFAULT_BASE_URL = "http://localhost:8080/data/v3";
const DEFAULT_CONFIG: MapTilesConfig = {
    vectorTilesBaseUrl: DEFAULT_BASE_URL,
    styleUrl: `${DEFAULT_BASE_URL}/style.json`,
    tilesMetadataUrl: `${DEFAULT_BASE_URL}/tiles.json`,
    excludeLayers: []
};

let tilesConfigPromise: Promise<MapTilesConfig> | null = null;

export async function loadMapTilesConfig(signal?: AbortSignal): Promise<MapTilesConfig> {
    if (process.env.NODE_ENV === "development") {
        return resolveMapTilesConfig(signal);
    }
    if (!tilesConfigPromise) {
        tilesConfigPromise = resolveMapTilesConfig(signal).catch((error) => {
            tilesConfigPromise = null;
            throw error;
        });
    }
    return tilesConfigPromise;
}

async function resolveMapTilesConfig(signal?: AbortSignal): Promise<MapTilesConfig> {
    const url = "/config/map-tiles.json";

    try {
        const cache = process.env.NODE_ENV === "development" ? "no-store" : "force-cache";
        const response = await fetch(url, { signal: signal ?? null, cache });
        if (!response.ok) {
            console.warn(`[config] ${url} missing (${response.status}). Using defaults.`);
            return DEFAULT_CONFIG;
        }

        const json = (await response.json()) as unknown;
        const parsed = parseMapTilesConfig(json);
        if (!parsed) {
            console.warn(`[config] ${url} invalid. Using defaults.`);
            return DEFAULT_CONFIG;
        }

        return normalizeConfig(parsed);
    } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
            throw error;
        }
        console.warn(`[config] Failed to load ${url}. Using defaults.`, error);
        return DEFAULT_CONFIG;
    }
}

function normalizeConfig(config: MapTilesConfig): MapTilesConfig {
    const vectorTilesBaseUrl = config.vectorTilesBaseUrl.replace(/\/$/, "");
    const styleUrl = config.styleUrl;
    const tilesMetadataUrl = config.tilesMetadataUrl ?? `${vectorTilesBaseUrl}/tiles.json`;
    const excludeLayers = dedupeStrings(config.excludeLayers ?? []);
    return excludeLayers && excludeLayers.length
        ? { vectorTilesBaseUrl, styleUrl, tilesMetadataUrl, excludeLayers }
        : { vectorTilesBaseUrl, styleUrl, tilesMetadataUrl };
}

function parseMapTilesConfig(value: unknown): MapTilesConfig | null {
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;

    const vectorTilesBaseUrl = toNonEmptyString(record.vectorTilesBaseUrl);
    const styleUrl = toNonEmptyString(record.styleUrl) ??
        (vectorTilesBaseUrl ? `${vectorTilesBaseUrl}/style.json` : null);

    if (!vectorTilesBaseUrl || !styleUrl) {
        return null;
    }

    const tilesMetadataUrl = toNonEmptyString(record.tilesMetadataUrl) ?? `${vectorTilesBaseUrl}/tiles.json`;
    const excludeLayers = toStringArray(record.excludeLayers);

    return excludeLayers && excludeLayers.length
        ? { vectorTilesBaseUrl, styleUrl, tilesMetadataUrl, excludeLayers }
        : { vectorTilesBaseUrl, styleUrl, tilesMetadataUrl };
}

function toNonEmptyString(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function toStringArray(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) {
        return undefined;
    }
    const normalized = value
        .map((entry) => toNonEmptyString(entry))
        .filter((entry): entry is string => Boolean(entry));
    return normalized.length > 0 ? normalized : undefined;
}

function dedupeStrings(values: string[]): string[] {
    if (!values.length) {
        return [];
    }
    return Array.from(new Set(values));
}
