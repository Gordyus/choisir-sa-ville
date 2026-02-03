/**
 * City Interactive Layer - Creates invisible hitbox layers for city label interactions.
 * These circle layers provide a forgiving click/hover target area for city labels.
 */

import type {
    CircleLayerSpecification,
    ExpressionSpecification,
    LegacyFilterSpecification,
    Map as MapLibreMap,
    StyleSpecification
} from "maplibre-gl";

import { buildPlaceClassIncludeFilter } from "./layers/baseLabels";
import { isManagedCityLabelLayer } from "./layers/managedCityLabels";
import { buildCityHitboxLayerId, isCityHitboxLayer } from "./registry/layerRegistry";

const NAME_FIELDS = ["name:fr", "name", "name:en"] as const;

type LabelLayerContext = {
    labelLayerId: string;
    source: string;
    sourceLayer?: string;
    textField?: ExpressionSpecification;
    baseFilter?: LegacyFilterSpecification;
    minzoom?: number;
    maxzoom?: number;
};

export type CommuneInteractiveLayerHandle = {
    layerIds: string[];
    addedLayerIds: string[];
};

export function ensureCommuneInteractiveLayers(map: MapLibreMap): CommuneInteractiveLayerHandle | null {
    const contexts = collectLabelLayerContexts(map);
    if (!contexts.length) {
        return null;
    }

    const layerIds: string[] = [];
    const addedLayerIds: string[] = [];

    for (const context of contexts) {
        const interactiveLayerId = buildCityHitboxLayerId(context.labelLayerId);
        layerIds.push(interactiveLayerId);
        if (map.getLayer(interactiveLayerId)) {
            continue;
        }
        const interactiveLayer = buildInteractiveLayer(context, interactiveLayerId);
        map.addLayer(interactiveLayer, context.labelLayerId);
        addedLayerIds.push(interactiveLayerId);
    }

    if (!layerIds.length) {
        return null;
    }

    return { layerIds, addedLayerIds };
}

export function listCommuneInteractiveLayerIds(map: MapLibreMap): string[] {
    const style = map.getStyle();
    const layers = style?.layers ?? [];
    return layers
        .map((layer) => layer.id)
        .filter((id): id is string => typeof id === "string" && isCityHitboxLayer(id));
}

function collectLabelLayerContexts(map: MapLibreMap): LabelLayerContext[] {
    const style = map.getStyle();
    const layers = style?.layers ?? [];
    return collectManagedLabelContexts(layers);
}

function collectManagedLabelContexts(layers: StyleSpecification["layers"]): LabelLayerContext[] {
    return layers
        .filter((layer) => isManagedCityLabelLayer(layer))
        .map((layer) => normalizeLayerContext(layer))
        .filter((context): context is LabelLayerContext => Boolean(context));
}

function normalizeLayerContext(layer: StyleSpecification["layers"][number] | undefined): LabelLayerContext | null {
    if (!layer || layer.type !== "symbol" || typeof (layer as { source?: unknown }).source !== "string") {
        return null;
    }
    const layout = layer.layout as Record<string, unknown> | undefined;
    const sourceLayer = (layer as { "source-layer"?: string })["source-layer"];
    const textField = layout?.["text-field"] as ExpressionSpecification | undefined;
    const baseFilter = (layer as { filter?: unknown }).filter as LegacyFilterSpecification | undefined;

    const context: LabelLayerContext = {
        labelLayerId: layer.id,
        source: (layer as { source: string }).source
    };

    if (sourceLayer) {
        context.sourceLayer = sourceLayer;
    }
    if (typeof textField !== "undefined") {
        context.textField = textField;
    }
    if (typeof baseFilter !== "undefined") {
        context.baseFilter = baseFilter;
    }
    if (typeof (layer as { minzoom?: number }).minzoom === "number") {
        context.minzoom = (layer as { minzoom: number }).minzoom;
    }
    if (typeof (layer as { maxzoom?: number }).maxzoom === "number") {
        context.maxzoom = (layer as { maxzoom: number }).maxzoom;
    }

    return context;
}

function buildInteractiveLayer(
    context: LabelLayerContext,
    interactiveLayerId: string
): CircleLayerSpecification {
    const fallbackFilter: LegacyFilterSpecification = [
        "any",
        ...NAME_FIELDS.map((field) => ["has", field] as unknown as LegacyFilterSpecification)
    ];

    const base = context.baseFilter ?? fallbackFilter;
    const placeFilter = buildPlaceClassIncludeFilter();

    const layer: CircleLayerSpecification = {
        id: interactiveLayerId,
        type: "circle",
        source: context.source,
        paint: {
            "circle-radius": buildInteractionRadiusExpression(),
            "circle-opacity": 0,
            "circle-color": "#000000",
            "circle-stroke-width": 0
        },
        filter: ["all", base, placeFilter] as unknown as LegacyFilterSpecification
    };

    if (context.sourceLayer) {
        layer["source-layer"] = context.sourceLayer;
    }
    if (typeof context.minzoom === "number") {
        layer.minzoom = context.minzoom;
    }
    if (typeof context.maxzoom === "number") {
        layer.maxzoom = context.maxzoom;
    }

    return layer;
}

function buildInteractionRadiusExpression(): ExpressionSpecification {
    return [
        "interpolate",
        ["linear"],
        ["zoom"],
        3, 6,
        7, 10,
        10, 16,
        14, 24
    ] as ExpressionSpecification;
}
