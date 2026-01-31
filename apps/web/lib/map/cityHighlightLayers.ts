import type { ExpressionSpecification, MapGeoJSONFeature, Map as MapLibreMap, SymbolLayerSpecification } from "maplibre-gl";

import {
    CITY_ID_FALLBACK_FIELDS,
    CITY_ID_FIELD,
    CITY_LABEL_LAYERS,
    debugLogSymbolLabelHints,
    pickCityIdFieldFromFeatures
} from "./interactiveLayers";

const HIGHLIGHT_LAYER_ID = "city-label-hover-highlight";
const highlightHandleCache = new WeakMap<MapLibreMap, CityHighlightHandle>();
let missingLayerWarned = false;

type SymbolLayout = Exclude<SymbolLayerSpecification["layout"], undefined>;
type TextFieldValue = Exclude<SymbolLayout["text-field"], undefined>;
type TextFontValue = Exclude<SymbolLayout["text-font"], undefined>;
type TextSizeValue = Exclude<SymbolLayout["text-size"], undefined>;

const DEFAULT_TEXT_FIELD: TextFieldValue = [
    "coalesce",
    ["get", "name:fr"],
    ["get", "name"]
] as unknown as TextFieldValue;

const DEFAULT_TEXT_SIZE: TextSizeValue = [
    "interpolate",
    ["linear"],
    ["zoom"],
    4,
    11,
    10,
    18
] as TextSizeValue;

const DEFAULT_TEXT_FONT: TextFontValue = ["Open Sans Bold", "Arial Unicode MS Bold"] as unknown as TextFontValue;

export type CityHighlightHandle = {
    layerId: string;
    idField: string;
};

export type CityHighlightLayerOptions = {
    logStyleHints?: boolean;
};

export function ensureCityHighlightLayer(map: MapLibreMap, options?: CityHighlightLayerOptions): CityHighlightHandle | null {
    const existing = highlightHandleCache.get(map);
    if (existing && map.getLayer(existing.layerId)) {
        return existing;
    }

    const context = resolveCityLayerContext(map);
    if (!context) {
        if (!missingLayerWarned) {
            if (options?.logStyleHints) {
                debugLogSymbolLabelHints(map.getStyle());
            }
            console.warn(
                `[map-style] Unable to locate city label layer. Looked for: ${CITY_LABEL_LAYERS.join(", ")}`
            );
            missingLayerWarned = true;
        }
        return null;
    }
    missingLayerWarned = false;

    const idField = determineCityIdField(map, context) ?? CITY_ID_FIELD;
    const highlightLayer = buildHighlightLayer(context, idField);
    if (context.insertBeforeId) {
        map.addLayer(highlightLayer, context.insertBeforeId);
    } else {
        map.addLayer(highlightLayer);
    }

    const handle: CityHighlightHandle = { layerId: HIGHLIGHT_LAYER_ID, idField };
    highlightHandleCache.set(map, handle);
    return handle;
}

export function setHoveredCity(map: MapLibreMap, handle: CityHighlightHandle, cityId: string | null): void {
    if (!map.getLayer(handle.layerId)) {
        return;
    }
    const filter = cityId ? createMatchFilter(handle.idField, cityId) : createImpossibleFilter(handle.idField);
    map.setFilter(handle.layerId, filter);
}

export function removeCityHighlightLayer(map: MapLibreMap): void {
    if (map.getLayer(HIGHLIGHT_LAYER_ID)) {
        map.removeLayer(HIGHLIGHT_LAYER_ID);
    }
    highlightHandleCache.delete(map);
}

type LayerContext = {
    layerId: string;
    source: string;
    sourceLayer?: string;
    insertBeforeId?: string;
    textField?: TextFieldValue;
    textFont?: TextFontValue;
    textSize?: TextSizeValue;
};

function resolveCityLayerContext(map: MapLibreMap): LayerContext | null {
    const style = map.getStyle();
    if (!style?.layers) {
        return null;
    }
    for (const layerId of CITY_LABEL_LAYERS) {
        const layer = style.layers.find((entry) => entry.id === layerId);
        if (layer && layer.type === "symbol" && typeof layer.source === "string") {
            const layout = layer.layout as Record<string, unknown> | undefined;
            const sourceLayer = (layer as { "source-layer"?: string })["source-layer"];
            const textField = layout?.["text-field"] as TextFieldValue | undefined;
            const textFont = layout?.["text-font"] as TextFontValue | undefined;
            const textSize = layout?.["text-size"] as TextSizeValue | undefined;

            const context: LayerContext = {
                layerId,
                source: layer.source
            };

            const insertBeforeId = findLayerInsertedAfter(style.layers, layer.id);
            if (typeof insertBeforeId !== "undefined") {
                context.insertBeforeId = insertBeforeId;
            }

            if (sourceLayer) {
                context.sourceLayer = sourceLayer;
            }
            if (typeof textField !== "undefined") {
                context.textField = textField;
            }
            if (typeof textFont !== "undefined") {
                context.textFont = textFont;
            }
            if (typeof textSize !== "undefined") {
                context.textSize = textSize;
            }

            return context;
        }
    }
    return null;
}

function findLayerInsertedAfter(layers: { id: string }[], referenceLayerId: string): string | undefined {
    const index = layers.findIndex((layer) => layer.id === referenceLayerId);
    return index === -1 ? undefined : layers[index + 1]?.id;
}

function determineCityIdField(map: MapLibreMap, context: LayerContext): string | null {
    try {
        const options: { sourceLayer?: string } = {};
        if (context.sourceLayer) {
            options.sourceLayer = context.sourceLayer;
        }
        const features = map.querySourceFeatures(context.source, options) as MapGeoJSONFeature[];
        if (!features.length) {
            return null;
        }
        const picked = pickCityIdFieldFromFeatures(features);
        if (!picked && process.env.NODE_ENV === "development") {
            console.warn(
                "[map-style] No suitable identifier found on city label features. Falling back to name-based filtering."
            );
        }
        const fallback = CITY_ID_FALLBACK_FIELDS[CITY_ID_FALLBACK_FIELDS.length - 1];
        return picked ?? fallback ?? null;
    } catch (error) {
        if (process.env.NODE_ENV === "development") {
            console.warn("[map-style] Unable to inspect source features for city labels", error);
        }
        return null;
    }
}

function buildHighlightLayer(context: LayerContext, idField: string): SymbolLayerSpecification {
    const textField: TextFieldValue = context.textField ?? DEFAULT_TEXT_FIELD;
    const textSize: TextSizeValue = context.textSize ?? DEFAULT_TEXT_SIZE;
    const textFont: TextFontValue = context.textFont ?? DEFAULT_TEXT_FONT;

    const layout: SymbolLayout = {
        "text-field": textField,
        "text-size": textSize,
        "text-font": textFont,
        "text-allow-overlap": true,
        "text-ignore-placement": true
    };

    const layer: SymbolLayerSpecification = {
        id: HIGHLIGHT_LAYER_ID,
        type: "symbol",
        source: context.source,
        layout,
        paint: {
            "text-color": "#1d4ed8",
            "text-halo-color": "#ffffff",
            "text-halo-width": 2.5,
            "text-halo-blur": 0.4
        },
        filter: createImpossibleFilter(idField)
    };

    if (context.sourceLayer) {
        layer["source-layer"] = context.sourceLayer;
    }

    return layer;
}

function createImpossibleFilter(idField: string): ExpressionSpecification {
    return ["==", ["coalesce", ["get", idField], "__none__"], "__none__"];
}

function createMatchFilter(idField: string, cityId: string): ExpressionSpecification {
    return ["==", ["coalesce", ["get", idField], "__none__"], cityId];
}
