import type {
    ExpressionSpecification,
    LegacyFilterSpecification,
    Map as MapLibreMap,
    StyleSpecification,
    SymbolLayerSpecification
} from "maplibre-gl";

import { COMMUNE_LABEL_LAYERS, PLACE_CLASS_FILTER } from "./interactiveLayers";

export const COMMUNE_INTERACTIVE_LAYER_PREFIX = "commune-label-interactive::";

const NAME_FIELDS = ["name:fr", "name", "name:en"] as const;

let missingReferenceLayerWarned = false;

type LabelLayerContext = {
    labelLayerId: string;
    source: string;
    sourceLayer?: string;
    textField?: ExpressionSpecification;
    baseFilter?: LegacyFilterSpecification;
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

    return context;
}

function buildInteractiveLayer(
    context: LabelLayerContext,
    interactiveLayerId: string
): SymbolLayerSpecification {
    const layout: SymbolLayerSpecification["layout"] = {
        "text-field": context.textField ?? ["get", "name"],
        "text-size": 12,
        "text-allow-overlap": true,
        "text-ignore-placement": true
    };

    const fallbackFilter: LegacyFilterSpecification = [
        "any",
        ...NAME_FIELDS.map((field) => ["has", field] as unknown as LegacyFilterSpecification)
    ];

    const base = context.baseFilter ?? fallbackFilter;
    const layer: SymbolLayerSpecification = {
        id: interactiveLayerId,
        type: "symbol",
        source: context.source,
        layout,
        paint: {
            "text-opacity": 0,
            "icon-opacity": 0
        },
        filter: ["all", base, PLACE_CLASS_FILTER] as any
    };

    if (context.sourceLayer) {
        layer["source-layer"] = context.sourceLayer;
    }

    return layer;
}
