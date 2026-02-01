import type {
    LegacyFilterSpecification,
    MapGeoJSONFeature,
    Map as MapLibreMap,
    StyleSpecification,
    SymbolLayerSpecification
} from "maplibre-gl";

import {
    CITY_ID_FALLBACK_FIELDS,
    CITY_ID_FIELD,
    COMMUNE_LABEL_LAYERS,
    debugLogSymbolLabelHints,
    PLACE_CLASS_FILTER
} from "./interactiveLayers";

const HIGHLIGHT_LAYER_PREFIX = "commune-label-hover-highlight::";
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

type HighlightLayerEntry = {
    labelLayerId: string;
    layerId: string;
    idFields: string[];
    baseFilter?: LegacyFilterSpecification;
};

export type CityHighlightHandle = {
    layers: Map<string, HighlightLayerEntry>;
};

export type CityHighlightLayerOptions = {
    logStyleHints?: boolean;
};

export type SetHoveredCityOptions = {
    labelLayerId?: string | null;
};

export function ensureCityHighlightLayer(
    map: MapLibreMap,
    options?: CityHighlightLayerOptions
): CityHighlightHandle | null {
    const existing = highlightHandleCache.get(map);
    if (existing && highlightLayersExist(map, existing)) {
        return existing;
    }

    const contexts = resolveCityLayerContexts(map);
    if (!contexts.length) {
        if (!missingLayerWarned) {
            if (options?.logStyleHints) {
                debugLogSymbolLabelHints(map.getStyle());
            }
            console.warn(
                `[map-style] Unable to locate commune label layers. Looked for: ${COMMUNE_LABEL_LAYERS.join(", ")}`
            );
            missingLayerWarned = true;
        }
        return null;
    }
    missingLayerWarned = false;

    const layers = new Map<string, HighlightLayerEntry>();

    for (const context of contexts) {
        const layerId = buildHighlightLayerId(context.labelLayerId);
        const idFields = determineCityIdFields(map, context);
        if (!map.getLayer(layerId)) {
            const highlightLayer = buildHighlightLayer(context, idFields, layerId);
            if (context.insertBeforeId) {
                map.addLayer(highlightLayer, context.insertBeforeId);
            } else {
                map.addLayer(highlightLayer);
            }
        }

        const entry: HighlightLayerEntry = {
            labelLayerId: context.labelLayerId,
            layerId,
            idFields
        };
        if (typeof context.baseFilter !== "undefined") {
            entry.baseFilter = context.baseFilter;
        }
        layers.set(context.labelLayerId, entry);
    }

    if (!layers.size) {
        return null;
    }

    const handle: CityHighlightHandle = { layers };
    highlightHandleCache.set(map, handle);
    return handle;
}

export function setHoveredCity(
    map: MapLibreMap,
    handle: CityHighlightHandle,
    cityId: string | null,
    options?: SetHoveredCityOptions
): void {
    if (!handle.layers.size) {
        return;
    }

    if (!cityId) {
        handle.layers.forEach((entry) => applyFilter(map, entry, createImpossibleFilter(entry.idFields)));
        return;
    }

    const targetLabelId = options?.labelLayerId ?? null;
    if (targetLabelId && handle.layers.has(targetLabelId)) {
        handle.layers.forEach((entry, labelId) => {
            const filter = labelId === targetLabelId
                ? createMatchFilter(entry.idFields, cityId)
                : createImpossibleFilter(entry.idFields);
            applyFilter(map, entry, filter);
        });
        return;
    }

    handle.layers.forEach((entry) => {
        applyFilter(map, entry, createMatchFilter(entry.idFields, cityId));
    });
}

export function removeCityHighlightLayer(map: MapLibreMap): void {
    const style = map.getStyle();
    const layerIds =
        style?.layers?.map((layer) => layer.id).filter((id) => id.startsWith(HIGHLIGHT_LAYER_PREFIX)) ?? [];
    for (const layerId of layerIds) {
        if (map.getLayer(layerId)) {
            map.removeLayer(layerId);
        }
    }
    highlightHandleCache.delete(map);
}

type LayerContext = {
    labelLayerId: string;
    source: string;
    sourceLayer?: string;
    insertBeforeId?: string;
    textField?: TextFieldValue;
    textFont?: TextFontValue;
    textSize?: TextSizeValue;
    baseFilter?: LegacyFilterSpecification;
};

function resolveCityLayerContexts(map: MapLibreMap): LayerContext[] {
    const style = map.getStyle();
    if (!style?.layers) {
        return [];
    }

    const contexts: LayerContext[] = [];
    for (const layerId of COMMUNE_LABEL_LAYERS) {
        const layer = style.layers.find((entry) => entry.id === layerId);
        const context = createLayerContext(style.layers, layer);
        if (context) {
            contexts.push(context);
        }
    }

    if (!contexts.length) {
        const fallback = style.layers.find(
            (layer) => layer.type === "symbol" && typeof (layer as { source?: unknown }).source === "string"
        ) as StyleSpecification["layers"][number] | undefined;
        const context = createLayerContext(style.layers, fallback);
        if (context) {
            contexts.push(context);
        }
    }

    return contexts;
}

function createLayerContext(
    layers: { id: string }[],
    layer: StyleSpecification["layers"][number] | undefined
): LayerContext | null {
    if (!layer || layer.type !== "symbol" || typeof layer.source !== "string") {
        return null;
    }

    const layout = layer.layout as Record<string, unknown> | undefined;
    const sourceLayer = (layer as { "source-layer"?: string })["source-layer"];
    const textField = layout?.["text-field"] as TextFieldValue | undefined;
    const textFont = layout?.["text-font"] as TextFontValue | undefined;
    const textSize = layout?.["text-size"] as TextSizeValue | undefined;
    const baseFilter = (layer as { filter?: unknown }).filter as LegacyFilterSpecification | undefined;

    const context: LayerContext = {
        labelLayerId: layer.id,
        source: layer.source
    };

    const insertBeforeId = findLayerInsertedAfter(layers, layer.id);
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
    if (typeof baseFilter !== "undefined") {
        context.baseFilter = baseFilter;
    }

    return context;
}

function findLayerInsertedAfter(layers: { id: string }[], referenceLayerId: string): string | undefined {
    const index = layers.findIndex((layer) => layer.id === referenceLayerId);
    return index === -1 ? undefined : layers[index + 1]?.id;
}

function determineCityIdFields(map: MapLibreMap, context: LayerContext): string[] {
    const candidates = [CITY_ID_FIELD, ...CITY_ID_FALLBACK_FIELDS];
    try {
        const options: { sourceLayer?: string } = {};
        if (context.sourceLayer) {
            options.sourceLayer = context.sourceLayer;
        }
        const features = map.querySourceFeatures(context.source, options) as MapGeoJSONFeature[];
        if (features.length) {
            const available = candidates.filter((field) => featureHasReadableProperty(features, field));
            if (available.length) {
                return available;
            }
        }
    } catch (error) {
        if (process.env.NODE_ENV === "development") {
            console.warn("[map-style] Unable to inspect source features for city labels", error);
        }
    }
    return ["name", "name:fr"];
}

function buildHighlightLayer(
    context: LayerContext,
    idFields: string[],
    layerId: string
): SymbolLayerSpecification {
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
    const impossible = createImpossibleFilter(idFields);
    const withBase = withBaseFilter(impossible, context.baseFilter);
    const layer: SymbolLayerSpecification = {
        id: layerId,
        type: "symbol",
        source: context.source,
        layout,
        paint: {
            "text-color": "#1d4ed8",
            "text-halo-color": "#ffffff",
            "text-halo-width": 2.5,
            "text-halo-blur": 0.4
        },
        filter: ["all", withBase, PLACE_CLASS_FILTER] as any
    };

    if (context.sourceLayer) {
        layer["source-layer"] = context.sourceLayer;
    }

    return layer;
}

function createImpossibleFilter(idFields: readonly string[]): LegacyFilterSpecification {
    const fields = ensureFields(idFields);
    const sentinelField = fields[0] ?? "name";
    return ["all", createHasAnyExpression(fields), ["==", sentinelField, "__never__"]];
}

function createMatchFilter(idFields: readonly string[], cityId: string): LegacyFilterSpecification {
    const fields = ensureFields(idFields);
    const numericId = parseNumericId(cityId);
    const comparisons: LegacyFilterSpecification[] = [];
    for (const field of fields) {
        comparisons.push(["==", field, cityId]);
        if (numericId != null) {
            comparisons.push(["==", field, numericId]);
        }
    }
    return ["all", createHasAnyExpression(fields), ["any", ...comparisons]];
}

function parseNumericId(value: string): number | null {
    if (!/^[1-9]\d*$/.test(value)) {
        return null;
    }
    const asNumber = Number(value);
    return Number.isFinite(asNumber) ? asNumber : null;
}

function createHasAnyExpression(fields: readonly string[]): LegacyFilterSpecification {
    return ["any", ...fields.map((field) => (["has", field] as LegacyFilterSpecification))];
}

function ensureFields(fields: readonly string[]): string[] {
    if (fields.length === 0) {
        return ["name"];
    }
    return [...fields];
}

function withBaseFilter(
    filter: LegacyFilterSpecification,
    baseFilter?: LegacyFilterSpecification
): LegacyFilterSpecification {
    if (!baseFilter) {
        return filter;
    }
    return ["all", baseFilter, filter] as unknown as LegacyFilterSpecification;
}

function featureHasReadableProperty(features: readonly MapGeoJSONFeature[], field: string): boolean {
    return features.some((feature) => {
        const value = (feature.properties ?? {})[field];
        if (typeof value === "string") {
            return value.length > 0;
        }
        if (typeof value === "number") {
            return Number.isFinite(value);
        }
        return false;
    });
}

function buildHighlightLayerId(labelLayerId: string): string {
    return `${HIGHLIGHT_LAYER_PREFIX}${labelLayerId}`;
}

function applyFilter(
    map: MapLibreMap,
    entry: HighlightLayerEntry,
    filter: LegacyFilterSpecification
): void {
    if (!map.getLayer(entry.layerId)) {
        return;
    }
    map.setFilter(entry.layerId, withBaseFilter(filter, entry.baseFilter));
}

function highlightLayersExist(map: MapLibreMap, handle: CityHighlightHandle): boolean {
    for (const entry of handle.layers.values()) {
        if (!map.getLayer(entry.layerId)) {
            return false;
        }
    }
    return true;
}

