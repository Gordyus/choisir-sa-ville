import type { ExpressionSpecification, Map as MapLibreMap, SymbolLayerSpecification } from "maplibre-gl";

import { CITY_LABEL_LAYERS } from "./interactiveLayers";

export const CITY_INTERACTIVE_LAYER_ID = "city-label-interactive";

let missingReferenceLayerWarned = false;

const NAME_FIELDS = ["name:fr", "name", "name:en"] as const;

type ReferenceLayerContext = {
    layerId: string;
    source: string;
    sourceLayer: string;
    textField?: ExpressionSpecification;
};

export function ensureCityInteractiveLayer(map: MapLibreMap): { layerId: string } | null {
    if (map.getLayer(CITY_INTERACTIVE_LAYER_ID)) {
        return { layerId: CITY_INTERACTIVE_LAYER_ID };
    }

    const referenceLayer = findReferenceLayer(map);
    if (!referenceLayer) {
        if (!missingReferenceLayerWarned) {
            console.warn(
                "[map-style] Unable to derive an interactive city layer; no suitable symbol layer found in style."
            );
            missingReferenceLayerWarned = true;
        }
        return null;
    }
    missingReferenceLayerWarned = false;

    const interactiveLayer = buildInteractiveLayer(referenceLayer);
    map.addLayer(interactiveLayer, referenceLayer.layerId);

    return { layerId: CITY_INTERACTIVE_LAYER_ID };
}

function findReferenceLayer(map: MapLibreMap): ReferenceLayerContext | null {
    const style = map.getStyle();
    const layers = style?.layers ?? [];

    for (const layerId of CITY_LABEL_LAYERS) {
        const layer = layers.find((entry) => entry.id === layerId);
        if (!layer || layer.type !== "symbol") {
            continue;
        }
        if (typeof layer.source !== "string") {
            continue;
        }
        const sourceLayer = (layer as { "source-layer"?: string })["source-layer"];
        if (!sourceLayer) {
            continue;
        }
        const layout = layer.layout as Record<string, unknown> | undefined;
        const textField = layout?.["text-field"] as ExpressionSpecification | undefined;
        const context: ReferenceLayerContext = {
            layerId: layer.id,
            source: layer.source,
            sourceLayer
        };
        if (typeof textField !== "undefined") {
            context.textField = textField;
        }
        return context;
    }

    for (const layer of layers) {
        if (layer.type !== "symbol") {
            continue;
        }
        if (typeof layer.source !== "string") {
            continue;
        }
        const sourceLayer = (layer as { "source-layer"?: string })["source-layer"];
        if (!sourceLayer) {
            continue;
        }
        const layout = layer.layout as Record<string, unknown> | undefined;
        const textField = layout?.["text-field"] as ExpressionSpecification | undefined;
        const context: ReferenceLayerContext = {
            layerId: layer.id,
            source: layer.source,
            sourceLayer
        };
        if (typeof textField !== "undefined") {
            context.textField = textField;
        }
        return context;
    }
    return null;
}

function buildInteractiveLayer(context: ReferenceLayerContext): SymbolLayerSpecification {
    const layout: SymbolLayerSpecification["layout"] = {
        "text-field": context.textField ?? ["get", "name"],
        "text-size": 12,
        "text-allow-overlap": true,
        "text-ignore-placement": true
    };

    return {
        id: CITY_INTERACTIVE_LAYER_ID,
        type: "symbol",
        source: context.source,
        "source-layer": context.sourceLayer,
        layout,
        paint: {
            "text-opacity": 0,
            "icon-opacity": 0
        },
        filter: ["any", ...NAME_FIELDS.map((field) => ["has", field])] as unknown as ExpressionSpecification
    };
}
