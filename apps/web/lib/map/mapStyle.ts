import type {
    ExpressionSpecification,
    LegacyFilterSpecification,
    StyleSpecification,
    SymbolLayerSpecification
} from "maplibre-gl";

import type { CityLabelStyleConfig, MapTilesConfig } from "@/lib/config/mapTilesConfig";
import {
    BASE_COMMUNE_LABEL_LAYER_IDS,
    buildManagedCityLabelLayerId,
    MANAGED_CITY_LABEL_METADATA_BASE_ID,
    MANAGED_CITY_LABEL_METADATA_FLAG,
    PLACE_ALLOWED_CLASSES,
    PLACE_CLASS_FILTER
} from "@/lib/map/interactiveLayers";

type LoadVectorMapStyleOptions = {
    enableManagedCityLabels?: boolean;
};

export async function loadVectorMapStyle(
    config: MapTilesConfig,
    signal?: AbortSignal,
    options?: LoadVectorMapStyleOptions
): Promise<StyleSpecification> {
    const [style, availableLayers] = await Promise.all([
        fetchJson<StyleSpecification>(config.styleUrl, signal),
        loadVectorLayerNames(config.tilesMetadataUrl, signal).catch(() => null)
    ]);

    if (!Array.isArray(style.layers)) {
        return style;
    }

    const availableLayerSet = availableLayers ? new Set(availableLayers) : null;
    const excludedLayerSet = buildStringSet(config.excludeLayers);
    const optionalSourceLayerSet = buildStringSet(config.optionalSourceLayers);

    const sanitizedLayers = style.layers.filter((layer) => {
        const sourceLayer = (layer as { "source-layer"?: unknown })["source-layer"];
        if (shouldHideLayer(layer, sourceLayer, excludedLayerSet)) {
            console.info(`[map-style] Removing layer ${layer.id} via excludeLayers setting.`);
            return false;
        }

        if (shouldHideOptionalSourceLayer(layer, sourceLayer, optionalSourceLayerSet, availableLayerSet)) {
            return false;
        }

        if (availableLayerSet && typeof sourceLayer === "string" && !availableLayerSet.has(sourceLayer)) {
            console.warn(`[map-style] Removing layer ${layer.id} referencing missing source-layer ${sourceLayer}`);
            return false;
        }

        return true;
    });

    const managedEnabled = options?.enableManagedCityLabels ?? true;
    const finalLayers =
        managedEnabled && !hasManagedCityLayers(sanitizedLayers)
            ? splitCityLabelLayers(
                sanitizedLayers,
                new Set(config.cityLabelLayerIds ?? Array.from(BASE_COMMUNE_LABEL_LAYER_IDS)),
                config.cityLabelStyle
            )
            : sanitizedLayers;

    return { ...style, layers: finalLayers };
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
    const response = await fetch(url, { signal: signal ?? null, cache: "force-cache" });
    if (!response.ok) {
        throw new Error(`[map-style] Failed to fetch ${url} (${response.status})`);
    }
    return (await response.json()) as T;
}

async function loadVectorLayerNames(url: string | undefined, signal?: AbortSignal): Promise<string[]> {
    if (!url) {
        return [];
    }
    const metadata = await fetchJson<{
        vector_layers?: Array<{ id?: string; name?: string }>;
    }>(url, signal);
    const layers = metadata.vector_layers ?? [];
    return layers
        .map((layer) => layer.name || layer.id)
        .filter((name): name is string => typeof name === "string" && name.length > 0);
}

function buildStringSet(layers?: string[]): Set<string> | null {
    if (!layers || layers.length === 0) {
        return null;
    }
    return new Set(layers);
}

function shouldHideLayer(
    layer: { id?: string | number },
    sourceLayer: unknown,
    excludedLayerSet: Set<string> | null
): boolean {
    if (!excludedLayerSet || excludedLayerSet.size === 0) {
        return false;
    }

    const sourceLayerName = typeof sourceLayer === "string" ? sourceLayer : null;
    if (typeof layer.id === "string" && excludedLayerSet.has(layer.id)) {
        return true;
    }
    if (sourceLayerName && excludedLayerSet.has(sourceLayerName)) {
        return true;
    }
    return false;
}

function shouldHideOptionalSourceLayer(
    layer: { id?: string | number },
    sourceLayer: unknown,
    optionalSet: Set<string> | null,
    availableLayerSet: Set<string> | null
): boolean {
    if (!optionalSet || optionalSet.size === 0) {
        return false;
    }
    const sourceLayerName = typeof sourceLayer === "string" ? sourceLayer : null;
    if (!sourceLayerName || !optionalSet.has(sourceLayerName)) {
        return false;
    }
    if (availableLayerSet && availableLayerSet.has(sourceLayerName)) {
        return false;
    }
    console.info(`[map-style] Removing optional layer ${layer.id ?? "<unknown>"} referencing ${sourceLayerName}.`);
    return true;
}

function hasManagedCityLayers(layers: StyleSpecification["layers"]): boolean {
    return layers.some((layer) => Boolean(readManagedMetadataFlag(layer)));
}

function splitCityLabelLayers(
    layers: StyleSpecification["layers"],
    targetIds: Set<string>,
    styleOverrides?: CityLabelStyleConfig
): StyleSpecification["layers"] {
    if (!targetIds.size) {
        return layers;
    }

    let applied = false;
    const result: typeof layers = [];
    for (const layer of layers) {
        if (shouldSplitLayer(layer, targetIds)) {
            const { baseLayer, managedLayer } = buildManagedLayerPair(
                layer as SymbolLayerSpecification,
                styleOverrides
            );
            result.push(managedLayer, baseLayer);
            applied = true;
        } else {
            result.push(layer);
        }
    }

    return applied ? result : layers;
}

function shouldSplitLayer(layer: StyleSpecification["layers"][number], targetIds: Set<string>): boolean {
    if (!targetIds.size) {
        return false;
    }
    if (layer.type !== "symbol" || typeof layer.id !== "string") {
        return false;
    }
    if (!targetIds.has(layer.id)) {
        return false;
    }
    return true;
}

function buildManagedLayerPair(
    layer: SymbolLayerSpecification,
    styleOverrides?: CityLabelStyleConfig
): {
    baseLayer: SymbolLayerSpecification;
    managedLayer: SymbolLayerSpecification;
} {
    const baseLayer = cloneLayer(layer);
    const managedLayer = cloneLayer(layer);
    const originalFilter = layer.filter as LegacyFilterSpecification | undefined;

    baseLayer.filter = combineFilters(originalFilter, COMMUNE_EXCLUDE_FILTER);
    managedLayer.filter = combineFilters(originalFilter, COMMUNE_INCLUDE_FILTER);
    managedLayer.id = buildManagedCityLabelLayerId(String(layer.id));
    managedLayer.paint = buildManagedPaint(layer.paint, styleOverrides);
    managedLayer.metadata = buildManagedMetadata(layer);
    applyLayoutOverrides(managedLayer, styleOverrides);

    return { baseLayer, managedLayer };
}

const COMMUNE_INCLUDE_FILTER: LegacyFilterSpecification = PLACE_CLASS_FILTER;

const COMMUNE_EXCLUDE_FILTER: LegacyFilterSpecification = [
    "!in",
    "class",
    ...PLACE_ALLOWED_CLASSES
] as LegacyFilterSpecification;

type SymbolPaint = Exclude<SymbolLayerSpecification["paint"], undefined>;

const DEFAULT_TEXT_COLOR = "#1f2933";
const HOVER_TEXT_COLOR = "#1130ff";
const SELECTED_TEXT_COLOR = "#0f172a";
const DEFAULT_HALO_COLOR = "#f7f4ef";
const HOVER_HALO_COLOR = "#ffffff";
const SELECTED_HALO_COLOR = "#ffe28f";
const DEFAULT_HALO_WIDTH = 1.5;
const HOVER_HALO_WIDTH = 2.2;
const SELECTED_HALO_WIDTH = 2.8;

function buildManagedPaint(
    paint: SymbolLayerSpecification["paint"],
    overrides?: CityLabelStyleConfig
): SymbolPaint {
    const base: SymbolPaint = paint ? ({ ...(paint as Record<string, unknown>) } as SymbolPaint) : {};

    const baseTextColor = overrides?.textColor ?? getPaintValue(base, "text-color", DEFAULT_TEXT_COLOR);
    const hoverTextColor = overrides?.hoverTextColor ?? HOVER_TEXT_COLOR;
    const selectedTextColor = overrides?.selectedTextColor ?? SELECTED_TEXT_COLOR;
    base["text-color"] = buildStatefulPaintValue(baseTextColor, hoverTextColor, selectedTextColor);

    const baseHaloColor = overrides?.textHaloColor ?? getPaintValue(base, "text-halo-color", DEFAULT_HALO_COLOR);
    const hoverHaloColor = overrides?.hoverTextHaloColor ?? HOVER_HALO_COLOR;
    const selectedHaloColor = overrides?.selectedTextHaloColor ?? SELECTED_HALO_COLOR;
    base["text-halo-color"] = buildStatefulPaintValue(baseHaloColor, hoverHaloColor, selectedHaloColor);

    const baseHaloWidth = overrides?.textHaloWidth ?? getPaintValue(base, "text-halo-width", DEFAULT_HALO_WIDTH);
    const hoverHaloWidth = overrides?.hoverTextHaloWidth ?? HOVER_HALO_WIDTH;
    const selectedHaloWidth = overrides?.selectedTextHaloWidth ?? SELECTED_HALO_WIDTH;
    base["text-halo-width"] = buildStatefulPaintValue(baseHaloWidth, hoverHaloWidth, selectedHaloWidth);

    return base;
}

function applyLayoutOverrides(layer: SymbolLayerSpecification, overrides?: CityLabelStyleConfig): void {
    if (!overrides) {
        return;
    }
    const layout = (layer.layout = { ...(layer.layout ?? {}) });
    if (overrides.textFont?.length) {
        layout["text-font"] = overrides.textFont;
    }
    if (typeof overrides.textSize !== "undefined") {
        layout["text-size"] = overrides.textSize as SymbolLayerSpecification["layout"]["text-size"];
    }
}

function buildStatefulPaintValue(
    baseValue: unknown,
    hoverValue: unknown,
    selectedValue: unknown
): ExpressionSpecification {
    return [
        "case",
        ["boolean", ["feature-state", "selected"], false],
        selectedValue,
        ["boolean", ["feature-state", "hover"], false],
        hoverValue,
        baseValue
    ] as ExpressionSpecification;
}

function getPaintValue(paint: SymbolPaint, key: keyof SymbolPaint, fallback: unknown): unknown {
    const value = paint[key];
    return typeof value === "undefined" ? fallback : value;
}

function buildManagedMetadata(layer: SymbolLayerSpecification): Record<string, unknown> {
    const metadata = (layer as { metadata?: Record<string, unknown> }).metadata ?? {};
    return {
        ...metadata,
        [MANAGED_CITY_LABEL_METADATA_FLAG]: true,
        [MANAGED_CITY_LABEL_METADATA_BASE_ID]: layer.id
    };
}

function combineFilters(
    baseFilter: LegacyFilterSpecification | undefined,
    extra: LegacyFilterSpecification
): LegacyFilterSpecification {
    if (!baseFilter) {
        return extra;
    }
    return ["all", baseFilter, extra] as unknown as LegacyFilterSpecification;
}

function readManagedMetadataFlag(layer: StyleSpecification["layers"][number]): boolean {
    const metadata = (layer as { metadata?: unknown }).metadata;
    if (!metadata || typeof metadata !== "object") {
        return false;
    }
    return Boolean((metadata as Record<string, unknown>)[MANAGED_CITY_LABEL_METADATA_FLAG]);
}

function cloneLayer<T>(layer: T): T {
    return JSON.parse(JSON.stringify(layer)) as T;
}
