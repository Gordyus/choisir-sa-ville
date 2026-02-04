/**
 * Interactive Layers - Label identity extraction for map interactions.
 * Simplified module that extracts minimal identity from map label features.
 */

import type { MapGeoJSONFeature, StyleSpecification } from "maplibre-gl";

import { FEATURE_FIELDS } from "./registry/layerRegistry";

// ============================================================================
// Types
// ============================================================================

/**
 * Minimal identity extracted from a map label feature.
 * Used for hover/selection interactions.
 */
export type LabelIdentity = {
    /** Feature ID from tile source (stable) */
    featureId: string | number;
    /** Vector source name */
    source: string;
    /** Source layer within the vector source */
    sourceLayer: string | undefined;
    /** Display name for the label */
    name: string;
    /** Place class: city, town, village, suburb, neighbourhood, etc. */
    placeClass: string | null;
};

// ============================================================================
// Label Identity Extraction
// ============================================================================

const NAME_FIELDS = FEATURE_FIELDS.names;

/**
 * Extract minimal label identity from a MapGeoJSONFeature.
 * Returns null if the feature lacks required fields.
 */
export function extractLabelIdentity(feature: MapGeoJSONFeature): LabelIdentity | null {
    const featureId = feature.id;
    if (featureId === undefined || featureId === null) {
        return null;
    }

    const source = (feature as { source?: string }).source;
    if (typeof source !== "string") {
        return null;
    }

    const name = pickFirstString(feature, [...NAME_FIELDS]);
    if (!name) {
        return null;
    }

    const sourceLayer = (feature as { sourceLayer?: string }).sourceLayer;
    const placeClass = readPlaceClass(feature);

    return {
        featureId,
        source,
        sourceLayer,
        name,
        placeClass
    };
}

// ============================================================================
// Debug Utilities
// ============================================================================

let hasLoggedSymbolHints = false;

export function debugLogSymbolLabelHints(style?: StyleSpecification | null): void {
    if (hasLoggedSymbolHints || process.env.NODE_ENV !== "development") {
        return;
    }
    if (!style?.layers) {
        return;
    }
    const candidates = style.layers.filter((layer) => {
        if (layer.type !== "symbol") {
            return false;
        }
        const layout = layer.layout as Record<string, unknown> | undefined;
        return layout && typeof layout["text-field"] !== "undefined";
    });
    if (candidates.length) {
        console.warn("[map-style] Available text symbol layers:", candidates.map((layer) => layer.id).join(", "));
    } else {
        console.warn("[map-style] No text symbol layers detected in current style.");
    }
    hasLoggedSymbolHints = true;
}

// ============================================================================
// Helper Functions
// ============================================================================

function pickFirstString(feature: MapGeoJSONFeature, fields: readonly string[]): string | null {
    for (const field of fields) {
        const value = (feature.properties ?? {})[field];
        if (typeof value === "string" && value.length > 0) {
            return value;
        }
        if (typeof value === "number" && Number.isFinite(value)) {
            return value.toString();
        }
    }
    return null;
}

function readPlaceClass(feature: MapGeoJSONFeature): string | null {
    const rawValue = (feature.properties ?? {}).class;
    if (typeof rawValue !== "string") {
        return null;
    }
    return rawValue.trim().toLowerCase() || null;
}

