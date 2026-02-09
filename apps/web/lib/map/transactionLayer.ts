/**
 * Transaction Address Layer
 *
 * Adds the DVF transaction addresses GeoJSON source and circle layer to the map.
 * Points appear at zoom >= 14 and are styled with the brand color.
 *
 * This module follows the layer architecture:
 * - Uses layerRegistry constants (no magic strings)
 * - Does NOT handle interactions (delegated to mapInteractionService)
 * - Does NOT set feature-state (delegated to entityGraphicsBinder)
 */

import type { Map as MapLibreMap } from "maplibre-gl";

import { getTransactionAddressesGeoJsonUrl } from "@/lib/data/transactionBundles";

import { LAYER_IDS, SOURCE_IDS, ZOOM_RANGES } from "./registry/layerRegistry";

// ============================================================================
// Constants
// ============================================================================

/** Brand color for transaction points */
const POINT_COLOR = "#1b4d3e";
const POINT_COLOR_ACTIVE = "#e07020";
const POINT_RADIUS_BASE = 4;
const POINT_RADIUS_ACTIVE = 7;
const POINT_OPACITY = 0.8;

// ============================================================================
// Public API
// ============================================================================

/**
 * Add the transaction addresses source and layer to the map.
 * Call this after map "load" event.
 *
 * Returns a cleanup function to remove source and layer.
 */
export async function addTransactionLayer(
    map: MapLibreMap,
    signal?: AbortSignal
): Promise<() => void> {
    const geojsonUrl = await getTransactionAddressesGeoJsonUrl(signal);

    if (signal?.aborted) {
        return () => { /* noop */ };
    }

    // Add GeoJSON source
    map.addSource(SOURCE_IDS.transactionAddresses, {
        type: "geojson",
        data: geojsonUrl,
        generateId: false
    });

    // Add circle layer
    map.addLayer({
        id: LAYER_IDS.transactionAddresses,
        type: "circle",
        source: SOURCE_IDS.transactionAddresses,
        minzoom: ZOOM_RANGES.transactionAddresses.min,
        paint: {
            "circle-radius": [
                "case",
                ["boolean", ["feature-state", "active"], false],
                POINT_RADIUS_ACTIVE,
                POINT_RADIUS_BASE
            ],
            "circle-color": [
                "case",
                ["boolean", ["feature-state", "active"], false],
                POINT_COLOR_ACTIVE,
                POINT_COLOR
            ],
            "circle-opacity": POINT_OPACITY,
            "circle-stroke-width": [
                "case",
                ["boolean", ["feature-state", "highlight"], false],
                2,
                0.5
            ],
            "circle-stroke-color": "#ffffff"
        }
    });

    return () => {
        try {
            if (map.getLayer(LAYER_IDS.transactionAddresses)) {
                map.removeLayer(LAYER_IDS.transactionAddresses);
            }
            if (map.getSource(SOURCE_IDS.transactionAddresses)) {
                map.removeSource(SOURCE_IDS.transactionAddresses);
            }
        } catch {
            // Map may already be destroyed
        }
    };
}
