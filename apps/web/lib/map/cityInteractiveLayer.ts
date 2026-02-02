import type {
    CircleLayerSpecification,
    ExpressionSpecification,
    LegacyFilterSpecification,
    Map as MapLibreMap,
    StyleSpecification
} from "maplibre-gl";

import {
    buildPlaceClassFilter,
    COMMUNE_LABEL_LAYERS,
    MANAGED_CITY_LABEL_METADATA_FLAG
} from "./interactiveLayers";

export const COMMUNE_INTERACTIVE_LAYER_PREFIX = "city-hitbox::";

const NAME_FIELDS = ["name:fr", "name", "name:en"] as const;

let missingReferenceLayerWarned = false;

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
        if (!missingReferenceLayerWarned) {
            console.warn(
                `[map-style] Unable to derive commune interactive layers; looked for: ${COMMUNE_LABEL_LAYERS.join(", ")}`
            );
            missingReferenceLayerWarned = true;
        }
        return null;
    }
    missingReferenceLayerWarned = false;

    const layerIds: string[] = [];
    const addedLayerIds: string[] = [];

    for (const context of contexts) {
        const interactiveLayerId = buildInteractiveLayerId(context.labelLayerId);
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

export function buildInteractiveLayerId(labelLayerId: string): string {
    return `${COMMUNE_INTERACTIVE_LAYER_PREFIX}${labelLayerId}`;
}

export function extractLabelLayerIdFromInteractive(interactiveLayerId: string): string | null {
    if (!interactiveLayerId.startsWith(COMMUNE_INTERACTIVE_LAYER_PREFIX)) {
        return null;
    }
    return interactiveLayerId.slice(COMMUNE_INTERACTIVE_LAYER_PREFIX.length) || null;
}

export function listCommuneInteractiveLayerIds(map: MapLibreMap): string[] {
    const style = map.getStyle();
    const layers = style?.layers ?? [];
    return layers
        .map((layer) => layer.id)
        .filter((id): id is string => typeof id === "string" && id.startsWith(COMMUNE_INTERACTIVE_LAYER_PREFIX));
}

function collectLabelLayerContexts(map: MapLibreMap): LabelLayerContext[] {
    const style = map.getStyle();
    const layers = style?.layers ?? [];
    const managedContexts = collectManagedLabelContexts(layers);
    if (managedContexts.length) {
        return managedContexts;
    }

    const contexts: LabelLayerContext[] = [];
    for (const labelLayerId of COMMUNE_LABEL_LAYERS) {
        const layer = layers.find((entry) => entry.id === labelLayerId);
        const context = normalizeLayerContext(layer);
        if (context) {
            contexts.push(context);
        }
    }

    if (!contexts.length) {
        const fallback = layers.find((layer) => layer.type === "symbol" && typeof (layer as { source?: unknown }).source === "string");
        const context = normalizeLayerContext(fallback);
        if (context) {
            contexts.push(context);
        }
    }

    return contexts;
}

function collectManagedLabelContexts(layers: StyleSpecification["layers"]): LabelLayerContext[] {
    return layers
        .filter((layer) => isManagedCityLabelLayer(layer))
        .map((layer) => normalizeLayerContext(layer))
        .filter((context): context is LabelLayerContext => Boolean(context));
}

function isManagedCityLabelLayer(layer: StyleSpecification["layers"][number] | undefined): boolean {
    if (!layer) {
        return false;
    }
    const metadata = (layer as { metadata?: unknown }).metadata;
    if (!metadata || typeof metadata !== "object") {
        return false;
    }
    return Boolean((metadata as Record<string, unknown>)[MANAGED_CITY_LABEL_METADATA_FLAG]);
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
        context.minzoom = (layer as { minzoom?: number }).minzoom;
    }
    if (typeof (layer as { maxzoom?: number }).maxzoom === "number") {
        context.maxzoom = (layer as { maxzoom?: number }).maxzoom;
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
    const placeFilter = buildPlaceClassFilter();
    // Circle hitboxes give us a forgiving hover/click target while keeping
    // the visual label layer untouched.
    const layer: CircleLayerSpecification = {
        id: interactiveLayerId,
        type: "circle",
        source: context.source,
        paint: {
            "circle-radius": buildInteractionRadiusExpression(context),
            "circle-opacity": 0,
            "circle-color": "#000000",
            "circle-stroke-width": 0
        },
        filter: ["all", base, placeFilter] as any
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

function buildInteractionRadiusExpression(_context: LabelLayerContext): ExpressionSpecification {
    // Keep the stops easy to tweak: increase the later zoom values if we ever need
    // larger hitboxes at city zoom levels.
    return [
        "interpolate",
        ["linear"],
        ["zoom"],
        3,
        6,
        7,
        10,
        10,
        16,
        14,
        24
    ] as ExpressionSpecification;
}
