/**
 * Base Labels - Helpers to identify and target OpenMapTiles label layers.
 * Used for hitbox creation and styling.
 */

import type {
    CircleLayerSpecification,
    ExpressionSpecification,
    LegacyFilterSpecification,
    Map as MapLibreMap,
    StyleSpecification
} from "maplibre-gl";

import {
    buildCityHitboxLayerId,
    DEFAULT_PLACE_CLASSES,
    LAYER_IDS,
    OMT_LABEL_LAYER_IDS
} from "@/lib/map/registry/layerRegistry";

// ============================================================================
// Place Class Management
// ============================================================================

let currentPlaceClasses: string[] = [...DEFAULT_PLACE_CLASSES];
let placeClassSet = new Set(currentPlaceClasses);

/**
 * Set the list of place classes to target (city, town, village, etc.)
 */
export function setPlaceClasses(classes?: readonly string[]): void {
    if (!classes || !classes.length) {
        currentPlaceClasses = [...DEFAULT_PLACE_CLASSES];
    } else {
        const normalized = classes
            .map((c) => (typeof c === "string" ? c.trim().toLowerCase() : ""))
            .filter((c) => c.length > 0);
        currentPlaceClasses = normalized.length
            ? Array.from(new Set(normalized))
            : [...DEFAULT_PLACE_CLASSES];
    }
    placeClassSet = new Set(currentPlaceClasses);
}

/**
 * Get the current list of place classes
 */
export function getPlaceClasses(): readonly string[] {
    return currentPlaceClasses;
}

/**
 * Check if a place class is in the current list
 */
export function isPlaceClass(value: string): boolean {
    return placeClassSet.has(value.toLowerCase());
}

/**
 * Build a filter expression that includes the current place classes
 */
export function buildPlaceClassIncludeFilter(): LegacyFilterSpecification {
    return ["in", "class", ...currentPlaceClasses] as LegacyFilterSpecification;
}

/**
 * Build a filter expression that excludes the current place classes
 */
export function buildPlaceClassExcludeFilter(): LegacyFilterSpecification {
    return ["!in", "class", ...currentPlaceClasses] as LegacyFilterSpecification;
}

// ============================================================================
// Label Layer Context
// ============================================================================

export type LabelLayerContext = {
    layerId: string;
    source: string;
    sourceLayer?: string;
    filter?: LegacyFilterSpecification;
    minzoom?: number;
    maxzoom?: number;
};

/**
 * Extract context from OpenMapTiles label layers in the style
 */
export function extractLabelContexts(style: StyleSpecification): LabelLayerContext[] {
    if (!style.layers) {
        return [];
    }

    const contexts: LabelLayerContext[] = [];

    for (const layerId of OMT_LABEL_LAYER_IDS) {
        const layer = style.layers.find((l) => l.id === layerId);
        if (!layer || layer.type !== "symbol") {
            continue;
        }

        const source = (layer as { source?: string }).source;
        if (typeof source !== "string") {
            continue;
        }

        const context: LabelLayerContext = {
            layerId: layer.id,
            source
        };

        const sourceLayer = (layer as { "source-layer"?: string })["source-layer"];
        if (sourceLayer) {
            context.sourceLayer = sourceLayer;
        }

        const filter = (layer as { filter?: LegacyFilterSpecification }).filter;
        if (filter) {
            context.filter = filter;
        }

        if (typeof (layer as { minzoom?: number }).minzoom === "number") {
            context.minzoom = (layer as { minzoom: number }).minzoom;
        }

        if (typeof (layer as { maxzoom?: number }).maxzoom === "number") {
            context.maxzoom = (layer as { maxzoom: number }).maxzoom;
        }

        contexts.push(context);
    }

    return contexts;
}

/**
 * Extract label contexts from a live map instance
 */
export function extractLabelContextsFromMap(map: MapLibreMap): LabelLayerContext[] {
    const style = map.getStyle();
    if (!style) {
        return [];
    }
    return extractLabelContexts(style);
}

// ============================================================================
// Hitbox Layer Creation
// ============================================================================

const NAME_FIELDS = ["name:fr", "name", "name:en"] as const;

/**
 * Build a circle hitbox layer for a label layer
 * These invisible layers provide a generous click target
 */
export function buildHitboxLayer(context: LabelLayerContext): CircleLayerSpecification {
    const hitboxId = buildCityHitboxLayerId(context.layerId);

    // Build a filter that requires a name field AND matches our place classes
    const nameFilter: LegacyFilterSpecification = [
        "any",
        ...NAME_FIELDS.map((field) => ["has", field] as unknown as LegacyFilterSpecification)
    ];

    const placeFilter = buildPlaceClassIncludeFilter();

    // Combine with any existing filter from the label layer
    let finalFilter: LegacyFilterSpecification;
    if (context.filter) {
        finalFilter = ["all", context.filter, nameFilter, placeFilter] as unknown as LegacyFilterSpecification;
    } else {
        finalFilter = ["all", nameFilter, placeFilter] as unknown as LegacyFilterSpecification;
    }

    const layer: CircleLayerSpecification = {
        id: hitboxId,
        type: "circle",
        source: context.source,
        filter: finalFilter,
        paint: {
            "circle-radius": buildHitboxRadiusExpr(),
            "circle-opacity": 0,
            "circle-color": "#000000",
            "circle-stroke-width": 0
        }
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

/**
 * Build the radius expression for hitbox circles
 * Grows with zoom level for better UX at higher zooms
 */
function buildHitboxRadiusExpr(): ExpressionSpecification {
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

/**
 * Ensure hitbox layers exist for all label layers on a map
 * Returns the list of hitbox layer IDs
 */
export function ensureHitboxLayers(map: MapLibreMap): string[] {
    const contexts = extractLabelContextsFromMap(map);
    const hitboxIds: string[] = [];

    for (const context of contexts) {
        const hitboxId = buildCityHitboxLayerId(context.layerId);
        hitboxIds.push(hitboxId);

        // Skip if already exists
        if (map.getLayer(hitboxId)) {
            continue;
        }

        const hitboxLayer = buildHitboxLayer(context);
        // Insert before the label layer so labels stay on top
        map.addLayer(hitboxLayer, context.layerId);
    }

    return hitboxIds;
}

/**
 * List all hitbox layer IDs currently on the map
 */
export function listHitboxLayerIds(map: MapLibreMap): string[] {
    const style = map.getStyle();
    if (!style?.layers) {
        return [];
    }

    return style.layers
        .map((l) => l.id)
        .filter((id): id is string =>
            typeof id === "string" && id.startsWith(LAYER_IDS.cityHitboxPrefix)
        );
}
