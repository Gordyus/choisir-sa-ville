/**
 * Style Pipeline - Orchestrates loading and transforming MapLibre styles.
 * This is the single entry point for loading map styles with all customizations.
 *
 * Layer ordering and injection:
 * 1. Base style is fetched from styleUrl
 * 2. TileJSON metadata is loaded to check source-layer availability
 * 3. Layers with unavailable source-layers are removed
 * 4. Interactable label layer receives feature-state styling overrides
 * 5. Admin polygon sources (communes, arr_municipal) are injected before labels
 * 6. Final style is returned with deterministic layer ordering
 */

import type { StyleSpecification } from "maplibre-gl";

import type { MapTilesConfig } from "@/lib/config/mapTilesConfig";

import { injectAdminPolygons } from "../layers/adminPolygons";
import { setPlaceClasses } from "../layers/baseLabels";
import { applyInteractableLabelStyling } from "../layers/interactableLabelStyling";
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

    const resolvedBaseStyle = baseStyle ?? buildFallbackStyle(config);
    if (!Array.isArray(resolvedBaseStyle.layers)) {
        return resolvedBaseStyle;
    }

    // Step 2: Configure place class filtering (city/town/village)
    setPlaceClasses(config.cityClasses);

    // Step 3: Sanitize layers - remove those with unavailable source-layers
    const processedLayers = sanitizeLayers(resolvedBaseStyle.layers, { availability, verbose });

    // Step 4: Apply feature-state styling on the interactable label layer
    applyInteractableLabelStyling(
        processedLayers,
        config.interactableLabelLayerId,
        config.cityLabelStyle
    );

    // Step 5: Build the output style
    const outputStyle: StyleSpecification = {
        ...resolvedBaseStyle,
        layers: processedLayers,
        sources: { ...(resolvedBaseStyle.sources ?? {}) }
    };

    // Step 6: Inject admin polygon sources and layers (before labels for proper z-order)
    injectAdminPolygons(outputStyle, config.polygonSources, availability);

    return outputStyle;
}

function buildFallbackStyle(config: MapTilesConfig): StyleSpecification {
    const origin = safeOrigin(config.styleUrl) ?? safeOrigin(Object.values(config.tileJsonSources ?? {})[0] ?? "");
    const glyphs = origin ? `${origin}/fonts/{fontstack}/{range}.pbf` : undefined;

    const sources: StyleSpecification["sources"] = {};
    for (const [id, url] of Object.entries(config.tileJsonSources ?? {})) {
        if (typeof url === "string" && url.length) {
            sources[id] = { type: "vector", url } as unknown as StyleSpecification["sources"][string];
        }
    }

    const style: StyleSpecification = {
        version: 8,
        name: "Fallback",
        sources,
        layers: [
            {
                id: "background",
                type: "background",
                paint: { "background-color": "#f7f4ef" }
            }
        ]
    } as StyleSpecification;

    if (glyphs) {
        (style as unknown as { glyphs?: string }).glyphs = glyphs;
    }

    return style;
}

function safeOrigin(value: string): string | null {
    try {
        const url = new URL(value);
        return url.origin;
    } catch {
        return null;
    }
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

