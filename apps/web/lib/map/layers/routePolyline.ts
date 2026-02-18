/**
 * Route Polyline Layer
 *
 * Adds a GeoJSON source + line layer to display a route itinerary on the map.
 * The layer is inserted before the first symbol layer so labels remain on top.
 */

import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";

// ============================================================================
// Constants
// ============================================================================

const SOURCE_ID = "route-polyline";
const LAYER_ID = "route-polyline-line";

const BRAND_COLOR = "#1b4d3e";
const LINE_WIDTH = 4;
const LINE_OPACITY = 0.8;

// ============================================================================
// Types
// ============================================================================

export type RouteGeometry = {
    type: "LineString";
    coordinates: number[][];
};

// ============================================================================
// Public API
// ============================================================================

export function addRoutePolylineLayer(map: MapLibreMap): {
    updateRoute: (geometry: RouteGeometry | null) => void;
    cleanup: () => void;
} {
    // Find the first symbol layer to insert the line below labels
    const firstSymbolLayerId = findFirstSymbolLayer(map);

    // Add empty GeoJSON source
    map.addSource(SOURCE_ID, {
        type: "geojson",
        data: {
            type: "Feature",
            properties: {},
            geometry: {
                type: "LineString",
                coordinates: [],
            },
        },
    });

    // Add line layer
    map.addLayer(
        {
            id: LAYER_ID,
            type: "line",
            source: SOURCE_ID,
            layout: {
                "line-join": "round",
                "line-cap": "round",
            },
            paint: {
                "line-color": BRAND_COLOR,
                "line-width": LINE_WIDTH,
                "line-opacity": LINE_OPACITY,
            },
        },
        firstSymbolLayerId ?? undefined
    );

    function updateRoute(geometry: RouteGeometry | null): void {
        const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
        if (!source) return;

        if (geometry) {
            source.setData({
                type: "Feature",
                properties: {},
                geometry,
            });
        } else {
            source.setData({
                type: "Feature",
                properties: {},
                geometry: {
                    type: "LineString",
                    coordinates: [],
                },
            });
        }
    }

    function cleanup(): void {
        if (map.getLayer(LAYER_ID)) {
            map.removeLayer(LAYER_ID);
        }
        if (map.getSource(SOURCE_ID)) {
            map.removeSource(SOURCE_ID);
        }
    }

    return { updateRoute, cleanup };
}

// ============================================================================
// Helpers
// ============================================================================

function findFirstSymbolLayer(map: MapLibreMap): string | null {
    const layers = map.getStyle()?.layers ?? [];
    for (const layer of layers) {
        if (layer.type === "symbol") {
            return layer.id;
        }
    }
    return null;
}
