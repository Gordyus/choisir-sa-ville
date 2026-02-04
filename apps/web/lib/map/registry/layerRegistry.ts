/**
 * Layer Registry - Single source of truth for all map layer IDs, source names, and ordering rules.
 * This module eliminates magic strings and provides type-safe access to layer configuration.
 */

// ============================================================================
// Source IDs - Vector tile sources
// ============================================================================

export const SOURCE_IDS = {
    /** OpenMapTiles base map (streets, labels, etc.) */
    france: "france",
    /** Commune polygon overlays */
    communes: "communes",
    /** Arrondissement municipal polygon overlays */
    arrMunicipal: "arr_municipal"
} as const;

export type SourceId = (typeof SOURCE_IDS)[keyof typeof SOURCE_IDS];

// ============================================================================
// Source Layer Names - Names of layers within vector tile sources
// ============================================================================

export const SOURCE_LAYERS = {
    /** Default source-layer name for communes mbtiles */
    communes: "communes",
    /** Default source-layer name for arr_municipal mbtiles */
    arrMunicipal: "arr_municipal"
} as const;

// ============================================================================
// Layer IDs - Unique IDs for layers we inject
// ============================================================================

export const LAYER_IDS = {
    // Polygon fill layers
    communesFill: "communes-fill",
    communesLine: "communes-line",
    arrMunicipalFill: "arr-municipal-fill",
    arrMunicipalLine: "arr-municipal-line"
} as const;

// ============================================================================
// Zoom Ranges - Visibility ranges for polygon layers
// ============================================================================

export const ZOOM_RANGES = {
    communes: { min: 11, max: 15 } as const,
    arrMunicipal: { min: 13, max: 15 } as const
} as const;

// ============================================================================
// Feature Property Fields
// ============================================================================

export const FEATURE_FIELDS = {
    /** Primary ID field for city/commune identification */
    inseeCode: "insee",
    /** Fallback ID fields in priority order */
    fallbackIds: ["code", "id", "name:fr", "name"] as const,
    /** Name fields in priority order */
    names: ["name:fr", "name", "name:en"] as const,
    /** Place class field */
    placeClass: "class"
} as const;

// ============================================================================
// Default Place Classes - Types of places to highlight
// ============================================================================

export const DEFAULT_PLACE_CLASSES = ["city", "town", "village"] as const;

export type PlaceClass = string;

// ============================================================================
// Admin Polygon Layer Specs - Combined specification for polygon layers
// ============================================================================

export type AdminPolygonSpec = {
    readonly sourceId: string;
    readonly sourceLayer: string;
    readonly fillLayerId: string;
    readonly lineLayerId: string;
    readonly zoomRange: { readonly min: number; readonly max: number };
};

export const ADMIN_POLYGON_SPECS: Record<"communes" | "arrMunicipal", AdminPolygonSpec> = {
    communes: {
        sourceId: SOURCE_IDS.communes,
        sourceLayer: SOURCE_LAYERS.communes,
        fillLayerId: LAYER_IDS.communesFill,
        lineLayerId: LAYER_IDS.communesLine,
        zoomRange: ZOOM_RANGES.communes
    },
    arrMunicipal: {
        sourceId: SOURCE_IDS.arrMunicipal,
        sourceLayer: SOURCE_LAYERS.arrMunicipal,
        fillLayerId: LAYER_IDS.arrMunicipalFill,
        lineLayerId: LAYER_IDS.arrMunicipalLine,
        zoomRange: ZOOM_RANGES.arrMunicipal
    }
} as const;

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get all polygon fill layer IDs
 */
export function getPolygonFillLayerIds(): string[] {
    return [LAYER_IDS.communesFill, LAYER_IDS.arrMunicipalFill];
}

/**
 * Get all polygon line layer IDs
 */
export function getPolygonLineLayerIds(): string[] {
    return [LAYER_IDS.communesLine, LAYER_IDS.arrMunicipalLine];
}

/**
 * Get all polygon layer IDs (fill + line)
 */
export function getAllPolygonLayerIds(): string[] {
    return [...getPolygonFillLayerIds(), ...getPolygonLineLayerIds()];
}
