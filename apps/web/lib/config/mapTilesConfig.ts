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
    styleUrl: string;
    tileJsonSources: TileJsonSourceMap;
    cityClasses: string[];
    polygonSources: PolygonSourcesConfig;
    cityLabelLayerIds: string[];
    cityLabelStyle?: CityLabelStyleConfig;
};

let tilesConfigPromise: Promise<MapTilesConfig> | null = null;

export async function loadMapTilesConfig(signal?: AbortSignal): Promise<MapTilesConfig> {
    if (!tilesConfigPromise) {
        tilesConfigPromise = resolveMapTilesConfig(signal);
    }
    return tilesConfigPromise;
}

async function resolveMapTilesConfig(signal?: AbortSignal): Promise<MapTilesConfig> {
    const url = "/config/map-tiles.json";

    const cache = process.env.NODE_ENV === "development" ? "no-store" : "force-cache";
    const response = await fetch(url, { signal: signal ?? null, cache });
    if (!response.ok) {
        throw new Error(`[config] ${url} missing (${response.status}).`);
    }

    const json = (await response.json()) as unknown;
    const parsed = parseMapTilesConfig(json);
    if (!parsed) {
        throw new Error(`[config] ${url} invalid.`);
    }

    return parsed;
}

function parseMapTilesConfig(value: unknown): MapTilesConfig | null {
    if (!value || typeof value !== "object") {
        return null;
    }
    const record = value as Record<string, unknown>;

    const styleUrl = requireNonEmptyString(record.styleUrl);
    const tileJsonSources = requireTileJsonSources(record.tileJsonSources);
    const cityClasses = requireStringArray(record.cityClasses);
    const cityLabelLayerIds = requireStringArray(record.cityLabelLayerIds);
    const polygonSources = requirePolygonSources(record.polygonSources);
    const cityLabelStyle = parseCityLabelStyleConfig(record.cityLabelStyle);

    if (
        !styleUrl ||
        !tileJsonSources ||
        !cityClasses ||
        !cityLabelLayerIds ||
        !polygonSources ||
        cityLabelStyle === null
    ) {
        return null;
    }

    const parsed: MapTilesConfig = {
        styleUrl,
        tileJsonSources,
        cityClasses,
        polygonSources,
        cityLabelLayerIds
    };
    if (cityLabelStyle) {
        parsed.cityLabelStyle = cityLabelStyle;
    }
    return parsed;
}

function parseCityLabelStyleConfig(value: unknown): CityLabelStyleConfig | undefined | null {
    if (typeof value === "undefined" || value === null) {
        return undefined;
    }
    if (typeof value !== "object") {
        return null;
    }
    const record = value as Record<string, unknown>;
    const style: CityLabelStyleConfig = {};

    if ("textColor" in record) {
        if (typeof record.textColor !== "string") return null;
        style.textColor = record.textColor;
    }
    if ("hoverTextColor" in record) {
        if (typeof record.hoverTextColor !== "string") return null;
        style.hoverTextColor = record.hoverTextColor;
    }
    if ("selectedTextColor" in record) {
        if (typeof record.selectedTextColor !== "string") return null;
        style.selectedTextColor = record.selectedTextColor;
    }
    if ("textHaloColor" in record) {
        if (typeof record.textHaloColor !== "string") return null;
        style.textHaloColor = record.textHaloColor;
    }
    if ("hoverTextHaloColor" in record) {
        if (typeof record.hoverTextHaloColor !== "string") return null;
        style.hoverTextHaloColor = record.hoverTextHaloColor;
    }
    if ("selectedTextHaloColor" in record) {
        if (typeof record.selectedTextHaloColor !== "string") return null;
        style.selectedTextHaloColor = record.selectedTextHaloColor;
    }
    if ("textHaloWidth" in record) {
        if (typeof record.textHaloWidth !== "number" || !Number.isFinite(record.textHaloWidth)) return null;
        style.textHaloWidth = record.textHaloWidth;
    }
    if ("hoverTextHaloWidth" in record) {
        if (typeof record.hoverTextHaloWidth !== "number" || !Number.isFinite(record.hoverTextHaloWidth)) return null;
        style.hoverTextHaloWidth = record.hoverTextHaloWidth;
    }
    if ("selectedTextHaloWidth" in record) {
        if (typeof record.selectedTextHaloWidth !== "number" || !Number.isFinite(record.selectedTextHaloWidth)) return null;
        style.selectedTextHaloWidth = record.selectedTextHaloWidth;
    }
    if ("textFont" in record) {
        if (!Array.isArray(record.textFont)) return null;
        if (record.textFont.some((entry) => typeof entry !== "string" || entry.length === 0)) return null;
        style.textFont = record.textFont as string[];
    }
    if ("textSize" in record) {
        const textSize = record.textSize;
        if (typeof textSize === "number" && Number.isFinite(textSize)) {
            style.textSize = textSize;
        } else if (Array.isArray(textSize)) {
            style.textSize = textSize as ExpressionSpecification;
        } else {
            return null;
        }
    }

    return Object.keys(style).length ? style : undefined;
}

function requireNonEmptyString(value: unknown): string | null {
    if (typeof value !== "string") return null;
    return value.length > 0 ? value : null;
}

function requireStringArray(value: unknown): string[] | null {
    if (!Array.isArray(value)) {
        return null;
    }
    if (!value.length) {
        return null;
    }
    if (value.some((entry) => typeof entry !== "string" || entry.length === 0)) {
        return null;
    }
    return value as string[];
}
function requireTileJsonSources(value: unknown): TileJsonSourceMap | null {
    if (!value || typeof value !== "object") {
        return null;
    }
    const record = value as Record<string, unknown>;
    const sources: Record<string, string> = {};
    for (const [key, raw] of Object.entries(record)) {
        const normalized = requireNonEmptyString(raw);
        if (!normalized) {
            return null;
        }
        sources[key] = normalized;
    }
    if (!sources.france || !sources.communes || !sources.arr_municipal) {
        return null;
    }
    return sources as TileJsonSourceMap;
}

function requirePolygonSources(value: unknown): PolygonSourcesConfig | null {
    if (!value || typeof value !== "object") {
        return null;
    }
    const record = value as Record<string, unknown>;
    const communes = record.communes;
    const arrMunicipal = record.arr_municipal;
    if (!communes || typeof communes !== "object") {
        return null;
    }
    if (!arrMunicipal || typeof arrMunicipal !== "object") {
        return null;
    }
    const communesRecord = communes as Record<string, unknown>;
    const arrRecord = arrMunicipal as Record<string, unknown>;
    const communesTileJsonUrl = requireNonEmptyString(communesRecord.tileJsonUrl);
    const communesSourceLayer = requireNonEmptyString(communesRecord.sourceLayer);
    const arrTileJsonUrl = requireNonEmptyString(arrRecord.tileJsonUrl);
    const arrSourceLayer = requireNonEmptyString(arrRecord.sourceLayer);
    if (!communesTileJsonUrl || !communesSourceLayer || !arrTileJsonUrl || !arrSourceLayer) {
        return null;
    }
    return {
        communes: {
            tileJsonUrl: communesTileJsonUrl,
            sourceLayer: communesSourceLayer
        },
        arr_municipal: {
            tileJsonUrl: arrTileJsonUrl,
            sourceLayer: arrSourceLayer
        }
    };
}
