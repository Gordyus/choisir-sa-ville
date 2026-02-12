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
import { ENTITY_STATE_COLORS } from "./layers/entityVisualStateColors";

import { LAYER_IDS, SOURCE_IDS, ZOOM_RANGES } from "./registry/layerRegistry";

// ============================================================================
// Point Size Configuration (easily adjustable)
// ============================================================================

/** Base circle radius in pixels (normal state) */
const POINT_RADIUS = 10;
/** Circle radius when entity is active (selected) */
const POINT_RADIUS_ACTIVE = 12;
/** Circle radius when entity is highlighted (hovered) */
const POINT_RADIUS_HIGHLIGHT = 12;
/** Circle opacity */
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
    // promoteId: "id" tells MapLibre to use properties.id as the feature identifier
    // for setFeatureState(). Without this, feature-state won't work on GeoJSON sources
    // with string IDs.
    map.addSource(SOURCE_IDS.transactionAddresses, {
        type: "geojson",
        data: geojsonUrl,
        promoteId: "id"
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
                ["boolean", ["feature-state", "highlight"], false],
                POINT_RADIUS_HIGHLIGHT,
                POINT_RADIUS
            ],
            "circle-color": [
                "case",
                ["boolean", ["feature-state", "active"], false],
                ENTITY_STATE_COLORS.active,
                ["boolean", ["feature-state", "highlight"], false],
                ENTITY_STATE_COLORS.highlight,
                ["boolean", ["feature-state", "hasData"], false],
                ENTITY_STATE_COLORS.hasData,
                ENTITY_STATE_COLORS.noData
            ],
            "circle-opacity": POINT_OPACITY,
            "circle-stroke-width": [
                "case",
                ["boolean", ["feature-state", "active"], false],
                3,
                ["boolean", ["feature-state", "highlight"], false],
                2.5,
                0.5
            ],
            "circle-stroke-color": [
                "case",
                ["boolean", ["feature-state", "active"], false],
                "#ffffff",
                ["boolean", ["feature-state", "highlight"], false],
                "#ffffff",
                "#ffffff"
            ]
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
