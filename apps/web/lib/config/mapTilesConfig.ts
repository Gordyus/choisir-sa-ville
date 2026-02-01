import type { ExpressionSpecification } from "maplibre-gl";

export type CityLabelStyleConfig = {
    textColor?: string;
    hoverTextColor?: string;
    selectedTextColor?: string;
    textHaloColor?: string;
    hoverTextHaloColor?: string;
    selectedTextHaloColor?: string;
    textHaloWidth?: number;
    hoverTextHaloWidth?: number;
    selectedTextHaloWidth?: number;
    textFont?: string[];
    textSize?: number | ExpressionSpecification;
};

export type MapTilesConfig = {
    vectorTilesBaseUrl: string;
    styleUrl: string;
    tilesMetadataUrl?: string;
    excludeLayers?: string[];
    optionalSourceLayers?: string[];
    cityLabelLayerIds?: string[];
    cityLabelStyle?: CityLabelStyleConfig;
};

const DEFAULT_BASE_URL = "http://localhost:8080/data/v3";
const DEFAULT_CITY_LABEL_LAYER_IDS = ["place_label_other", "place_label_city"];
const DEFAULT_CONFIG: MapTilesConfig = {
    vectorTilesBaseUrl: DEFAULT_BASE_URL,
    styleUrl: `${DEFAULT_BASE_URL}/style.json`,
    tilesMetadataUrl: `${DEFAULT_BASE_URL}/tiles.json`,
    excludeLayers: [],
    optionalSourceLayers: [],
    cityLabelLayerIds: DEFAULT_CITY_LABEL_LAYER_IDS
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
    const optionalSourceLayers = dedupeStrings(config.optionalSourceLayers ?? []);
    const cityLabelLayerIds = dedupeStrings(config.cityLabelLayerIds ?? DEFAULT_CITY_LABEL_LAYER_IDS);
    const normalized: MapTilesConfig = { vectorTilesBaseUrl, styleUrl, tilesMetadataUrl };
    if (excludeLayers.length) {
        normalized.excludeLayers = excludeLayers;
    }
    if (optionalSourceLayers.length) {
        normalized.optionalSourceLayers = optionalSourceLayers;
    }
    if (cityLabelLayerIds.length) {
        normalized.cityLabelLayerIds = cityLabelLayerIds;
    }
    if (config.cityLabelStyle) {
        normalized.cityLabelStyle = config.cityLabelStyle;
    }
    return normalized;
}

function parseMapTilesConfig(value: unknown): MapTilesConfig | null {
    if (!value || typeof value !== "object") {
        return null;
    }
    const record = value as Record<string, unknown>;

    const vectorTilesBaseUrl = toNonEmptyString(record.vectorTilesBaseUrl);
    const styleUrl = toNonEmptyString(record.styleUrl) ??
        (vectorTilesBaseUrl ? `${vectorTilesBaseUrl}/style.json` : null);

    if (!vectorTilesBaseUrl || !styleUrl) {
        return null;
    }

    const tilesMetadataUrl = toNonEmptyString(record.tilesMetadataUrl) ?? `${vectorTilesBaseUrl}/tiles.json`;
    const excludeLayers = toStringArray(record.excludeLayers);
    const optionalSourceLayers = toStringArray(record.optionalSourceLayers);
    const cityLabelLayerIds = toStringArray(record.cityLabelLayerIds) ?? DEFAULT_CITY_LABEL_LAYER_IDS;
    const cityLabelStyle = parseCityLabelStyleConfig(record.cityLabelStyle);

    const parsed: MapTilesConfig = { vectorTilesBaseUrl, styleUrl, tilesMetadataUrl, cityLabelLayerIds };
    if (excludeLayers && excludeLayers.length) {
        parsed.excludeLayers = excludeLayers;
    }
    if (optionalSourceLayers && optionalSourceLayers.length) {
        parsed.optionalSourceLayers = optionalSourceLayers;
    }
    if (cityLabelStyle) {
        parsed.cityLabelStyle = cityLabelStyle;
    }
    return parsed;
}

function parseCityLabelStyleConfig(value: unknown): CityLabelStyleConfig | undefined {
    if (!value || typeof value !== "object") {
        return undefined;
    }
    const record = value as Record<string, unknown>;
    const style: CityLabelStyleConfig = {};

    assignColor(style, "textColor", record.textColor);
    assignColor(style, "hoverTextColor", record.hoverTextColor);
    assignColor(style, "selectedTextColor", record.selectedTextColor);
    assignColor(style, "textHaloColor", record.textHaloColor);
    assignColor(style, "hoverTextHaloColor", record.hoverTextHaloColor);
    assignColor(style, "selectedTextHaloColor", record.selectedTextHaloColor);
    assignNumber(style, "textHaloWidth", record.textHaloWidth);
    assignNumber(style, "hoverTextHaloWidth", record.hoverTextHaloWidth);
    assignNumber(style, "selectedTextHaloWidth", record.selectedTextHaloWidth);

    if (Array.isArray(record.textFont)) {
        const fonts = record.textFont
            .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
            .filter((entry) => entry.length > 0);
        if (fonts.length) {
            style.textFont = fonts;
        }
    }

    const textSize = record.textSize;
    if (typeof textSize === "number" && Number.isFinite(textSize)) {
        style.textSize = textSize;
    } else if (Array.isArray(textSize)) {
        style.textSize = textSize as ExpressionSpecification;
    }

    return Object.keys(style).length ? style : undefined;
}

const COLOR_KEYS: Array<keyof CityLabelStyleConfig> = [
    "textColor",
    "hoverTextColor",
    "selectedTextColor",
    "textHaloColor",
    "hoverTextHaloColor",
    "selectedTextHaloColor"
];

function assignColor(target: CityLabelStyleConfig, key: keyof CityLabelStyleConfig, value: unknown): void {
    if (!COLOR_KEYS.includes(key)) {
        return;
    }
    if (typeof value !== "string") {
        return;
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return;
    }
    target[key] = trimmed;
}

const NUMERIC_KEYS: Array<keyof CityLabelStyleConfig> = [
    "textHaloWidth",
    "hoverTextHaloWidth",
    "selectedTextHaloWidth"
];

function assignNumber(target: CityLabelStyleConfig, key: keyof CityLabelStyleConfig, value: unknown): void {
    if (!NUMERIC_KEYS.includes(key)) {
        return;
    }
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return;
    }
    target[key] = value;
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
