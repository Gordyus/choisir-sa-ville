/**
 * Style Pipeline - Orchestrates loading and transforming MapLibre styles.
 * This is the single entry point for loading map styles with all customizations.
 *
 * Layer ordering and injection:
 * 1. Base style is fetched from styleUrl
 * 2. TileJSON metadata is loaded to check source-layer availability
 * 3. Layers with unavailable source-layers are removed
 * 4. City label layers are split into managed (feature-state) and base variants
 * 5. Admin polygon sources (communes, arr_municipal) are injected before labels
 * 6. Final style is returned with deterministic layer ordering
 */

import type { StyleSpecification } from "maplibre-gl";

import type { MapTilesConfig } from "@/lib/config/mapTilesConfig";

import { injectAdminPolygons } from "../layers/adminPolygons";
import { setPlaceClasses } from "../layers/baseLabels";
import { hasManagedCityLayers, splitCityLabelLayers } from "../layers/managedCityLabels";
import { OMT_LABEL_LAYER_IDS } from "../registry/layerRegistry";
import { loadSourceAvailability, loadStyle, type VectorLayerAvailability } from "./styleLoader";
import { sanitizeLayers } from "./styleSanitizer";

/**
 * Load and transform a MapLibre style with all customizations.
 * This is the ONLY way to load a map style - no alternative code paths exist.
 */
export async function loadMapStyle(
    config: MapTilesConfig,
    signal?: AbortSignal
): Promise<StyleSpecification> {
    const verbose = process.env.NODE_ENV === "development";

    // Step 1: Load base style and source availability in parallel
    const [baseStyle, availability] = await Promise.all([
        loadStyle(config.styleUrl, signal),
        loadTileJsonAvailability(config, signal)
    ]);

    if (!Array.isArray(baseStyle.layers)) {
        return baseStyle;
    }

    // Step 2: Configure place class filtering (city/town/village)
    setPlaceClasses(config.cityClasses);

    // Step 3: Sanitize layers - remove those with unavailable source-layers
    let processedLayers = sanitizeLayers(baseStyle.layers, { availability, verbose });

    // Step 4: Split city label layers for managed hover/selection styling
    if (!hasManagedCityLayers(processedLayers)) {
        const targetIds = new Set(config.cityLabelLayerIds ?? OMT_LABEL_LAYER_IDS);
        processedLayers = splitCityLabelLayers(
            processedLayers,
            targetIds,
            config.cityLabelStyle
        );
    }

    // Step 5: Build the output style
    const outputStyle: StyleSpecification = {
        ...baseStyle,
        layers: processedLayers,
        sources: { ...(baseStyle.sources ?? {}) }
    };

    // Step 6: Inject admin polygon sources and layers (before labels for proper z-order)
    injectAdminPolygons(outputStyle, config.polygonSources, availability);

    return outputStyle;
}

/**
 * Load TileJSON availability for all configured sources
 */
async function loadTileJsonAvailability(
    config: MapTilesConfig,
    signal?: AbortSignal
): Promise<VectorLayerAvailability> {
    // Build a map of sourceId -> tileJsonUrl
    const sourceUrls: Record<string, string> = {};

    // Add explicit TileJSON sources from config
    if (config.tileJsonSources) {
        for (const [key, url] of Object.entries(config.tileJsonSources)) {
            if (typeof url === "string" && url.length > 0) {
                sourceUrls[key] = url;
            }
        }
    }

    // Add polygon sources
    if (config.polygonSources) {
        if (config.polygonSources.communes?.tileJsonUrl) {
            sourceUrls.communes = config.polygonSources.communes.tileJsonUrl;
        }
        if (config.polygonSources.arr_municipal?.tileJsonUrl) {
            sourceUrls.arr_municipal = config.polygonSources.arr_municipal.tileJsonUrl;
        }
    }

    return loadSourceAvailability(sourceUrls, signal);
}

// Re-export commonly used types and functions for convenience
export { getPlaceClasses, setPlaceClasses } from "../layers/baseLabels";
export { type VectorLayerAvailability } from "./styleLoader";

