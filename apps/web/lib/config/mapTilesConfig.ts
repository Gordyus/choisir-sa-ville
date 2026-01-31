export type MapTilesConfig = {
    vectorTilesBaseUrl: string;
    styleUrl: string;
};

const DEFAULT_BASE_URL = "http://localhost:8080/data/v3";
const DEFAULT_CONFIG: MapTilesConfig = {
    vectorTilesBaseUrl: DEFAULT_BASE_URL,
    styleUrl: `${DEFAULT_BASE_URL}/style.json`
};

let tilesConfigPromise: Promise<MapTilesConfig> | null = null;

export async function loadMapTilesConfig(signal?: AbortSignal): Promise<MapTilesConfig> {
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
        const response = await fetch(url, { signal: signal ?? null, cache: "force-cache" });
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
    return { vectorTilesBaseUrl, styleUrl };
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

    return { vectorTilesBaseUrl, styleUrl };
}

function toNonEmptyString(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}
