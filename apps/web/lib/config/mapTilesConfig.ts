import type { ExpressionSpecification } from "maplibre-gl";

export const DEFAULT_INTERACTABLE_LABEL_LAYER_ID = "place_label_interractable";

export type CityLabelStyleConfig = {
    textColor?: string;
    highlightTextColor?: string;
    activeTextColor?: string;
    textHaloColor?: string;
    highlightTextHaloColor?: string;
    activeTextHaloColor?: string;
    textHaloWidth?: number;
    highlightTextHaloWidth?: number;
    activeTextHaloWidth?: number;
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
    interactableLabelLayerId: string;
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
    const url = "/api/config/map-tiles";

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
    const interactableLabelLayerId = parseInteractableLabelLayerId(record.interactableLabelLayerId);
    const polygonSources = requirePolygonSources(record.polygonSources);
    const cityLabelStyle = parseCityLabelStyleConfig(record.cityLabelStyle);

    if (
        !styleUrl ||
        !tileJsonSources ||
        !cityClasses ||
        !interactableLabelLayerId ||
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
        interactableLabelLayerId
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
    if ("highlightTextColor" in record) {
        if (typeof record.highlightTextColor !== "string") return null;
        style.highlightTextColor = record.highlightTextColor;
    }
    if ("activeTextColor" in record) {
        if (typeof record.activeTextColor !== "string") return null;
        style.activeTextColor = record.activeTextColor;
    }
    if ("textHaloColor" in record) {
        if (typeof record.textHaloColor !== "string") return null;
        style.textHaloColor = record.textHaloColor;
    }
    if ("highlightTextHaloColor" in record) {
        if (typeof record.highlightTextHaloColor !== "string") return null;
        style.highlightTextHaloColor = record.highlightTextHaloColor;
    }
    if ("activeTextHaloColor" in record) {
        if (typeof record.activeTextHaloColor !== "string") return null;
        style.activeTextHaloColor = record.activeTextHaloColor;
    }
    if ("textHaloWidth" in record) {
        if (typeof record.textHaloWidth !== "number" || !Number.isFinite(record.textHaloWidth)) return null;
        style.textHaloWidth = record.textHaloWidth;
    }
    if ("highlightTextHaloWidth" in record) {
        if (typeof record.highlightTextHaloWidth !== "number" || !Number.isFinite(record.highlightTextHaloWidth)) return null;
        style.highlightTextHaloWidth = record.highlightTextHaloWidth;
    }
    if ("activeTextHaloWidth" in record) {
        if (typeof record.activeTextHaloWidth !== "number" || !Number.isFinite(record.activeTextHaloWidth)) return null;
        style.activeTextHaloWidth = record.activeTextHaloWidth;
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

function parseInteractableLabelLayerId(value: unknown): string | null {
    if (typeof value === "undefined") {
        return DEFAULT_INTERACTABLE_LABEL_LAYER_ID;
    }
    return requireNonEmptyString(value);
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
