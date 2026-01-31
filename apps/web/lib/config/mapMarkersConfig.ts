export type ZoomRule = {
    maxZoom: number;
    includeInfra: boolean;
    cellSize: number;
    budget: number;
    infraShare: number;
};

export type WorldGridConfig = {
    enabled: boolean;
    tileZoomOffset: number;
    minTileZoom: number;
    maxTileZoom: number;
};

export type HysteresisConfig = {
    enabled: boolean;
    replaceRatio: number;
};

export type MapMarkersConfig = {
    zoomRules: ZoomRule[];
    worldGrid: WorldGridConfig;
    hysteresis: HysteresisConfig;
};

const DEFAULT_CONFIG: MapMarkersConfig = {
    zoomRules: [
        { maxZoom: 6, includeInfra: false, cellSize: 140, budget: 120, infraShare: 0 },
        { maxZoom: 9, includeInfra: false, cellSize: 90, budget: 300, infraShare: 0 },
        { maxZoom: 11, includeInfra: false, cellSize: 70, budget: 600, infraShare: 0 },
        { maxZoom: 99, includeInfra: true, cellSize: 60, budget: 900, infraShare: 0.4 }
    ],
    worldGrid: { enabled: true, tileZoomOffset: 0, minTileZoom: 4, maxTileZoom: 12 },
    hysteresis: { enabled: true, replaceRatio: 1.15 }
};

let configPromise: Promise<MapMarkersConfig> | null = null;

export async function loadMapMarkersConfig(signal?: AbortSignal): Promise<MapMarkersConfig> {
    if (!configPromise) {
        configPromise = resolveMapMarkersConfig(signal).catch((error) => {
            configPromise = null;
            throw error;
        });
    }
    return configPromise;
}

async function resolveMapMarkersConfig(signal?: AbortSignal): Promise<MapMarkersConfig> {
    const url = "/config/map-markers.json";

    try {
        const response = await fetch(url, { signal: signal ?? null, cache: "force-cache" });
        if (!response.ok) {
            console.warn(`[config] ${url} missing (${response.status}). Using defaults.`);
            return DEFAULT_CONFIG;
        }

        const json = (await response.json()) as unknown;
        const parsed = parseMapMarkersConfig(json);
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

function normalizeConfig(config: MapMarkersConfig): MapMarkersConfig {
    const sorted = [...config.zoomRules].sort((a, b) => a.maxZoom - b.maxZoom);
    return { ...config, zoomRules: sorted };
}

function parseMapMarkersConfig(value: unknown): MapMarkersConfig | null {
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    const zoomRulesRaw = record.zoomRules;
    if (!Array.isArray(zoomRulesRaw) || zoomRulesRaw.length === 0) return null;

    const rules: ZoomRule[] = [];
    for (const item of zoomRulesRaw) {
        const parsed = parseZoomRule(item);
        if (!parsed) return null;
        rules.push(parsed);
    }

    const worldGrid = parseWorldGridConfig(record.worldGrid) ?? DEFAULT_CONFIG.worldGrid;
    const hysteresis = parseHysteresisConfig(record.hysteresis) ?? DEFAULT_CONFIG.hysteresis;

    return { zoomRules: rules, worldGrid, hysteresis };
}

function parseZoomRule(value: unknown): ZoomRule | null {
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;

    const maxZoom = toFiniteNumber(record.maxZoom);
    const includeInfra = toBoolean(record.includeInfra);
    const cellSize = toFiniteNumber(record.cellSize);
    const budget = toFiniteNumber(record.budget);
    const infraShare = toFiniteNumber(record.infraShare);

    if (maxZoom == null || cellSize == null || budget == null || infraShare == null || includeInfra == null) {
        return null;
    }
    if (cellSize <= 0 || budget <= 0) return null;
    if (infraShare < 0 || infraShare > 1) return null;

    return { maxZoom, includeInfra, cellSize, budget, infraShare };
}

function parseWorldGridConfig(value: unknown): WorldGridConfig | null {
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;

    const enabled = toBoolean(record.enabled);
    const tileZoomOffset = toFiniteNumber(record.tileZoomOffset);
    const minTileZoom = toFiniteNumber(record.minTileZoom);
    const maxTileZoom = toFiniteNumber(record.maxTileZoom);

    if (enabled == null || tileZoomOffset == null || minTileZoom == null || maxTileZoom == null) return null;
    if (!Number.isInteger(tileZoomOffset)) return null;
    if (!Number.isInteger(minTileZoom) || !Number.isInteger(maxTileZoom)) return null;
    if (minTileZoom < 0 || maxTileZoom < 0) return null;
    if (minTileZoom > maxTileZoom) return null;

    return { enabled, tileZoomOffset, minTileZoom, maxTileZoom };
}

function parseHysteresisConfig(value: unknown): HysteresisConfig | null {
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;

    const enabled = toBoolean(record.enabled);
    const replaceRatio = toFiniteNumber(record.replaceRatio);
    if (enabled == null || replaceRatio == null) return null;
    if (replaceRatio < 1) return null;

    return { enabled, replaceRatio };
}

function toFiniteNumber(value: unknown): number | null {
    if (typeof value !== "number") return null;
    if (!Number.isFinite(value)) return null;
    return value;
}

function toBoolean(value: unknown): boolean | null {
    if (typeof value !== "boolean") return null;
    return value;
}
