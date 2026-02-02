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

export type TileJsonSourceId = "france" | "communes" | "arr_municipal";
export type TileJsonSourceMap = Record<TileJsonSourceId, string> & Record<string, string>;

export type PolygonSourceConfig = {
    tileJsonUrl: string;
    sourceLayer: string;
};

export type PolygonSourcesConfig = {
    communes: PolygonSourceConfig;
    arr_municipal: PolygonSourceConfig;
};

export type MapTilesConfig = {
    vectorTilesBaseUrl: string;
    styleUrl: string;
    excludeLayers?: string[];
    optionalSourceLayers?: string[];
    cityLabelLayerIds?: string[];
    cityLabelStyle?: CityLabelStyleConfig;
    tileJsonSources: TileJsonSourceMap;
    cityClasses: string[];
    polygonSources: PolygonSourcesConfig;
};

type ParsedMapTilesConfig = Omit<MapTilesConfig, "tileJsonSources" | "cityClasses" | "polygonSources"> & {
    tileJsonSources?: Record<string, string>;
    cityClasses?: string[];
    polygonSources?: RawPolygonSources;
};

const REQUIRED_TILE_JSON_SOURCE_IDS: TileJsonSourceId[] = ["france", "communes", "arr_municipal"];
const DEFAULT_BASE_URL = "http://localhost:8080/data";
const DEFAULT_CITY_LABEL_LAYER_IDS = ["place_label_other", "place_label_city"];
const DEFAULT_CITY_CLASSES = ["city", "town", "village"] as const;
const DEFAULT_TILE_JSON_SOURCES = buildDefaultTileJsonSources(DEFAULT_BASE_URL);
const DEFAULT_POLYGON_SOURCES = buildDefaultPolygonSources(DEFAULT_TILE_JSON_SOURCES);
const DEFAULT_CONFIG: MapTilesConfig = {
    vectorTilesBaseUrl: DEFAULT_BASE_URL,
    styleUrl: `${DEFAULT_BASE_URL}/style.json`,
    excludeLayers: [],
    optionalSourceLayers: [],
    cityLabelLayerIds: DEFAULT_CITY_LABEL_LAYER_IDS,
    tileJsonSources: DEFAULT_TILE_JSON_SOURCES,
    cityClasses: [...DEFAULT_CITY_CLASSES],
    polygonSources: DEFAULT_POLYGON_SOURCES
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

function normalizeConfig(config: ParsedMapTilesConfig): MapTilesConfig {
    const vectorTilesBaseUrl = stripTrailingSlashes(config.vectorTilesBaseUrl ?? DEFAULT_BASE_URL);
    const styleUrl = config.styleUrl;
    const excludeLayers = dedupeStrings(config.excludeLayers ?? []);
    const optionalSourceLayers = dedupeStrings(config.optionalSourceLayers ?? []);
    const cityLabelLayerIds = dedupeStrings(config.cityLabelLayerIds ?? DEFAULT_CITY_LABEL_LAYER_IDS);
    const cityClassesRaw = dedupeStrings(config.cityClasses ?? [...DEFAULT_CITY_CLASSES]);
    const cityClasses = cityClassesRaw.length ? cityClassesRaw : [...DEFAULT_CITY_CLASSES];
    const tileJsonSources = normalizeTileJsonSources(config.tileJsonSources, vectorTilesBaseUrl);
    const polygonSources = normalizePolygonSources(config.polygonSources, tileJsonSources);
    const normalized: MapTilesConfig = {
        vectorTilesBaseUrl,
        styleUrl,
        tileJsonSources,
        cityClasses,
        polygonSources
    };
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

function parseMapTilesConfig(value: unknown): ParsedMapTilesConfig | null {
    if (!value || typeof value !== "object") {
        return null;
    }
    const record = value as Record<string, unknown>;

    const vectorTilesBaseUrl = toNonEmptyString(record.vectorTilesBaseUrl) ?? DEFAULT_BASE_URL;
    const styleUrl = toNonEmptyString(record.styleUrl);

    if (!styleUrl) {
        return null;
    }

    const excludeLayers = toStringArray(record.excludeLayers);
    const optionalSourceLayers = toStringArray(record.optionalSourceLayers);
    const cityLabelLayerIds = toStringArray(record.cityLabelLayerIds) ?? DEFAULT_CITY_LABEL_LAYER_IDS;
    const cityLabelStyle = parseCityLabelStyleConfig(record.cityLabelStyle);
    const tileJsonSources = parseTileJsonSourceOverrides(record.tileJsonSources);
    const cityClasses = toStringArray(record.cityClasses);
    const polygonSources = parsePolygonSources(record.polygonSources);

    const parsed: ParsedMapTilesConfig = { vectorTilesBaseUrl, styleUrl, cityLabelLayerIds };
    if (excludeLayers && excludeLayers.length) {
        parsed.excludeLayers = excludeLayers;
    }
    if (optionalSourceLayers && optionalSourceLayers.length) {
        parsed.optionalSourceLayers = optionalSourceLayers;
    }
    if (cityLabelStyle) {
        parsed.cityLabelStyle = cityLabelStyle;
    }
    if (tileJsonSources) {
        parsed.tileJsonSources = tileJsonSources;
    }
    if (cityClasses && cityClasses.length) {
        parsed.cityClasses = cityClasses;
    }
    if (polygonSources) {
        parsed.polygonSources = polygonSources;
    }
    return parsed;
}

function normalizeTileJsonSources(
    overrides: Record<string, string> | undefined,
    vectorTilesBaseUrl: string
): TileJsonSourceMap {
    const defaults = buildDefaultTileJsonSources(vectorTilesBaseUrl);
    if (!overrides) {
        return defaults;
    }
    const normalized: TileJsonSourceMap = { ...defaults };
    for (const [key, value] of Object.entries(overrides)) {
        if (typeof value !== "string") {
            continue;
        }
        const trimmed = value.trim();
        if (!trimmed) {
            continue;
        }
        normalized[key] = trimmed;
    }
    for (const required of REQUIRED_TILE_JSON_SOURCE_IDS) {
        if (!normalized[required]) {
            normalized[required] = defaults[required];
        }
    }
    return normalized;
}

function parseTileJsonSourceOverrides(value: unknown): Record<string, string> | undefined {
    if (!value || typeof value !== "object") {
        return undefined;
    }
    const record = value as Record<string, unknown>;
    const overrides: Record<string, string> = {};
    for (const [key, raw] of Object.entries(record)) {
        const normalized = toNonEmptyString(raw);
        if (normalized) {
            overrides[key] = normalized;
        }
    }
    return Object.keys(overrides).length ? overrides : undefined;
}

function buildDefaultTileJsonSources(baseUrl: string): TileJsonSourceMap {
    const normalizedBase = stripTrailingSlashes(baseUrl);
    return {
        france: `${normalizedBase}/france.json`,
        communes: `${normalizedBase}/communes.json`,
        arr_municipal: `${normalizedBase}/arr_municipal.json`
    };
}

function buildDefaultPolygonSources(tileJsonSources: TileJsonSourceMap): PolygonSourcesConfig {
    return {
        communes: {
            tileJsonUrl: tileJsonSources.communes,
            sourceLayer: "communes"
        },
        arr_municipal: {
            tileJsonUrl: tileJsonSources.arr_municipal,
            sourceLayer: "arr_municipal"
        }
    };
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

const COLOR_KEYS = [
    "textColor",
    "hoverTextColor",
    "selectedTextColor",
    "textHaloColor",
    "hoverTextHaloColor",
    "selectedTextHaloColor"
] as const;

type ColorKey = (typeof COLOR_KEYS)[number];

function assignColor(target: CityLabelStyleConfig, key: keyof CityLabelStyleConfig, value: unknown): void {
    if (!COLOR_KEYS.includes(key as ColorKey)) {
        return;
    }
    if (typeof value !== "string") {
        return;
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return;
    }
    (target as Record<ColorKey, string>)[key as ColorKey] = trimmed;
}

const NUMERIC_KEYS = [
    "textHaloWidth",
    "hoverTextHaloWidth",
    "selectedTextHaloWidth"
] as const;

type NumericKey = (typeof NUMERIC_KEYS)[number];

function assignNumber(target: CityLabelStyleConfig, key: keyof CityLabelStyleConfig, value: unknown): void {
    if (!NUMERIC_KEYS.includes(key as NumericKey)) {
        return;
    }
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return;
    }
    (target as Record<NumericKey, number>)[key as NumericKey] = value;
}

function toNonEmptyString(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function stripTrailingSlashes(value: string): string {
    return value.replace(/\/+$/, "");
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

type RawPolygonSources = Partial<Record<keyof PolygonSourcesConfig, Partial<PolygonSourceConfig>>>;

function parsePolygonSources(value: unknown): RawPolygonSources | undefined {
    if (!value || typeof value !== "object") {
        return undefined;
    }
    const record = value as Record<string, unknown>;
    const entries: RawPolygonSources = {};
    for (const key of Object.keys(record)) {
        if (key !== "communes" && key !== "arr_municipal") {
            continue;
        }
        const raw = record[key];
        if (!raw || typeof raw !== "object") {
            continue;
        }
        const typed = raw as Record<string, unknown>;
        const tileJsonUrl = toNonEmptyString(typed.tileJsonUrl);
        const sourceLayer = toNonEmptyString(typed.sourceLayer);
        entries[key as keyof PolygonSourcesConfig] = {
            ...(tileJsonUrl ? { tileJsonUrl } : {}),
            ...(sourceLayer ? { sourceLayer } : {})
        };
    }
    return Object.keys(entries).length ? entries : undefined;
}

function normalizePolygonSources(
    overrides: RawPolygonSources | undefined,
    tileJsonSources: TileJsonSourceMap
): PolygonSourcesConfig {
    const defaults = buildDefaultPolygonSources(tileJsonSources);
    const buildEntry = (
        key: keyof PolygonSourcesConfig,
        fallback: PolygonSourceConfig
    ): PolygonSourceConfig => {
        const override = overrides?.[key];
        return {
            tileJsonUrl: override?.tileJsonUrl ?? fallback.tileJsonUrl,
            sourceLayer: override?.sourceLayer ?? fallback.sourceLayer
        };
    };
    return {
        communes: buildEntry("communes", defaults.communes),
        arr_municipal: buildEntry("arr_municipal", defaults.arr_municipal)
    };
}
