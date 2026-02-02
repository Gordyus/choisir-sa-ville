/**
 * Style Sanitizer - Removes layers that reference unavailable source-layers.
 * This module ensures the style only contains layers whose sources are available.
 */

import type { StyleSpecification } from "maplibre-gl";

import type { VectorLayerAvailability } from "./styleLoader";

export type SanitizeOptions = {
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
 * Sanitize style layers by removing those with unavailable source-layer references.
 * Layers without source-layer references are always kept.
 */
export function sanitizeLayers(
    layers: StyleSpecification["layers"],
    options: SanitizeOptions = {}
): StyleSpecification["layers"] {
    const availability = options.availability;
    const verbose = options.verbose ?? false;

    if (!availability || !availability.size) {
        return layers;
    }

    return layers.filter((layer) => {
        const sourceLayer = (layer as LayerWithSourceLayer)["source-layer"];
        const layerId = String(layer.id ?? "<unknown>");
        const source = (layer as { source?: string }).source;

        // Keep layers without source-layer references
        if (typeof sourceLayer !== "string" || typeof source !== "string") {
            return true;
        }

        // Check if source-layer is available
        const availableLayers = availability.get(source);
        if (availableLayers && !availableLayers.has(sourceLayer)) {
            if (verbose) {
                console.warn(
                    `[style-sanitizer] Removing layer "${layerId}" - source-layer "${sourceLayer}" not found in "${source}".`
                );
            }
            return false;
        }

        return true;
    });
}
