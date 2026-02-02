/**
 * Style Pipeline - Orchestrates loading and transforming MapLibre styles.
 * This is the main entry point for loading map styles with all customizations.
 */

import type { StyleSpecification } from "maplibre-gl";

import type { MapTilesConfig } from "@/lib/config/mapTilesConfig";

import { injectAdminPolygons } from "../layers/adminPolygons";
import { setPlaceClasses } from "../layers/baseLabels";
import { hasManagedCityLayers, splitCityLabelLayers } from "../layers/managedCityLabels";
import { OMT_LABEL_LAYER_IDS } from "../registry/layerRegistry";
import { loadSourceAvailability, loadStyle, type VectorLayerAvailability } from "./styleLoader";
import { sanitizeLayers } from "./styleSanitizer";

export type StylePipelineOptions = {
    /** Enable verbose logging */
    verbose?: boolean;
    /** Enable managed city labels with feature-state styling (default: true) */
    enableManagedCityLabels?: boolean;
};

/**
 * Load and transform a MapLibre style with all customizations:
 * - Fetches the base style from styleUrl
 * - Loads TileJSON metadata for auxiliary sources
 * - Sanitizes layers (removes excluded, optional missing, etc.)
 * - Splits city label layers for feature-state styling
 * - Injects admin polygon sources and layers
 * - Sets up place class filtering
 */
export async function loadMapStyle(
    config: MapTilesConfig,
    signal?: AbortSignal,
    options?: StylePipelineOptions
): Promise<StyleSpecification> {
    const verbose = options?.verbose ?? (process.env.NODE_ENV === "development");
    const enableManagedCityLabels = options?.enableManagedCityLabels ?? true;

    // Step 1: Load base style and source availability in parallel
    const [baseStyle, availability] = await Promise.all([
        loadStyle(config.styleUrl, signal),
        loadTileJsonAvailability(config, signal)
    ]);

    if (!Array.isArray(baseStyle.layers)) {
        return baseStyle;
    }

    // Step 2: Set up place class filtering
    setPlaceClasses(config.cityClasses);

    // Step 3: Sanitize layers
    const sanitizeOpts: Parameters<typeof sanitizeLayers>[1] = {
        availability,
        verbose
    };
    if (config.excludeLayers) sanitizeOpts.excludeLayers = config.excludeLayers;
    if (config.optionalSourceLayers) sanitizeOpts.optionalSourceLayers = config.optionalSourceLayers;
    
    let processedLayers = sanitizeLayers(baseStyle.layers, sanitizeOpts);

    // Step 4: Split city label layers for managed hover/selection styling
    if (enableManagedCityLabels && !hasManagedCityLayers(processedLayers)) {
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

    // Step 6: Inject admin polygon sources and layers
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
export { type VectorLayerAvailability } from "./styleLoader";
export { setPlaceClasses, getPlaceClasses } from "../layers/baseLabels";
