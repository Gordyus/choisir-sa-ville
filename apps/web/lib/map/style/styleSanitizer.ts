/**
 * Style Sanitizer - Removes unwanted layers based on configuration.
 * Handles excludeLayers, optionalSourceLayers, and missing source-layer cleanup.
 */

import type { StyleSpecification } from "maplibre-gl";

import type { VectorLayerAvailability } from "./styleLoader";

export type SanitizeOptions = {
    /** Layers to always exclude (by layer id or source-layer name) */
    excludeLayers?: string[];
    /** Optional source-layers that should only be included if available */
    optionalSourceLayers?: string[];
    /** Map of sourceId -> Set of available source-layer names */
    availability?: VectorLayerAvailability;
    /** Enable verbose logging */
    verbose?: boolean;
};

type LayerWithSourceLayer = {
    id: string | number;
    "source-layer"?: string;
};

/**
 * Sanitize style layers by removing excluded, optional missing, or unavailable layers
 */
export function sanitizeLayers(
    layers: StyleSpecification["layers"],
    options: SanitizeOptions = {}
): StyleSpecification["layers"] {
    const excludeSet = buildStringSet(options.excludeLayers);
    const optionalSet = buildStringSet(options.optionalSourceLayers);
    const availability = options.availability;
    const verbose = options.verbose ?? false;

    return layers.filter((layer) => {
        const sourceLayer = (layer as LayerWithSourceLayer)["source-layer"];
        const layerId = String(layer.id ?? "<unknown>");

        // Check explicit exclusions
        if (shouldExclude(layerId, sourceLayer, excludeSet)) {
            if (verbose) {
                console.info(`[style-sanitizer] Excluding layer "${layerId}" (matched excludeLayers).`);
            }
            return false;
        }

        // Check optional source-layers that are missing
        if (shouldHideOptional(layerId, sourceLayer, optionalSet, availability)) {
            if (verbose) {
                console.info(`[style-sanitizer] Removing optional layer "${layerId}" (source-layer "${sourceLayer}" unavailable).`);
            }
            return false;
        }

        // Check if source-layer exists in metadata (only if we have metadata)
        if (availability && typeof sourceLayer === "string") {
            // We need to know which source this layer uses to check availability
            // For now, we skip this check since we don't have source info here
            // The injectAdministrativeSourcesAndLayers will handle this properly
        }

        return true;
    });
}

/**
 * Check if a layer should be excluded based on excludeLayers config
 */
function shouldExclude(
    layerId: string,
    sourceLayer: unknown,
    excludeSet: Set<string> | null
): boolean {
    if (!excludeSet || excludeSet.size === 0) {
        return false;
    }

    if (excludeSet.has(layerId)) {
        return true;
    }

    if (typeof sourceLayer === "string" && excludeSet.has(sourceLayer)) {
        return true;
    }

    return false;
}

/**
 * Check if an optional layer should be hidden because its source-layer is unavailable
 */
function shouldHideOptional(
    layerId: string,
    sourceLayer: unknown,
    optionalSet: Set<string> | null,
    availability: VectorLayerAvailability | undefined
): boolean {
    if (!optionalSet || optionalSet.size === 0) {
        return false;
    }

    if (typeof sourceLayer !== "string") {
        return false;
    }

    if (!optionalSet.has(sourceLayer)) {
        return false;
    }

    // If we have availability info and this source-layer is available, keep it
    if (availability) {
        // Check all sources - if any source has this layer, keep it
        for (const layerSet of availability.values()) {
            if (layerSet.has(sourceLayer)) {
                return false;
            }
        }
    }

    // Optional layer is missing - hide it
    return true;
}

/**
 * Build a Set from an array of strings
 */
function buildStringSet(values?: string[]): Set<string> | null {
    if (!values || values.length === 0) {
        return null;
    }
    return new Set(values);
}

/**
 * Remove layers that reference unavailable source-layers from a specific source
 */
export function removeUnavailableSourceLayers(
    layers: StyleSpecification["layers"],
    sourceId: string,
    availableLayers: Set<string>,
    verbose = false
): StyleSpecification["layers"] {
    return layers.filter((layer) => {
        const source = (layer as { source?: string }).source;
        const sourceLayer = (layer as LayerWithSourceLayer)["source-layer"];

        // Only check layers from the specified source
        if (source !== sourceId || typeof sourceLayer !== "string") {
            return true;
        }

        if (!availableLayers.has(sourceLayer)) {
            if (verbose) {
                console.warn(`[style-sanitizer] Removing layer "${layer.id}" - source-layer "${sourceLayer}" not found in "${sourceId}".`);
            }
            return false;
        }

        return true;
    });
}
