/**
 * Commune Labels Vector Layer
 * 
 * Injects a custom vector tile source and symbol layer for commune labels.
 * These labels come from our own MBTiles (commune-labels.mbtiles) generated from indexLite.json.
 * 
 * Advantages over OSM labels:
 * - 100% coverage (34,870 communes including communes nouvelles)
 * - Stable feature IDs (insee codes)
 * - Full control over styling and interaction
 * 
 * The layer supports feature-state for interactive highlighting:
 * - hasData: Commune has data available
 * - highlight: Hovered
 * - active: Selected/clicked
 */

import type { LayerSpecification, StyleSpecification } from "maplibre-gl";

const COMMUNE_LABELS_SOURCE_ID = "commune-labels-vector";
const COMMUNE_LABELS_LAYER_ID = "commune_labels";

export type CommuneLabelsVectorConfig = {
    tileJsonUrl: string;
    sourceLayer?: string;
};

/**
 * Inject commune labels vector source and symbol layer into the map style.
 * Call this during style pipeline processing.
 */
export function injectCommuneLabelsVector(
    style: StyleSpecification,
    config: CommuneLabelsVectorConfig
): void {
    const sourceLayer = config.sourceLayer ?? "commune_labels";

    // Add vector tile source with promoteId to expose insee codes as feature IDs
    if (!style.sources) {
        style.sources = {};
    }

    style.sources[COMMUNE_LABELS_SOURCE_ID] = {
        type: "vector",
        url: config.tileJsonUrl,
        promoteId: { [sourceLayer]: "insee" }
    };


    // Create symbol layer for commune labels
    const labelLayer: LayerSpecification = {
        id: COMMUNE_LABELS_LAYER_ID,
        type: "symbol",
        source: COMMUNE_LABELS_SOURCE_ID,
        "source-layer": sourceLayer,
        minzoom: 6,
        maxzoom: 18,
        layout: {
            "text-field": ["get", "name"],
            "text-font": ["Noto Sans Regular"],
            "text-size": [
                "interpolate",
                ["linear"],
                ["zoom"],
                6, 11,
                9, 13,
                12, 15,
                16, 18
            ],
            "text-anchor": "center",
            "text-offset": [0, 0],
            "text-allow-overlap": false,
            "text-optional": true,
            "symbol-sort-key": ["-", ["coalesce", ["get", "population"], 0]] // Higher population = higher priority
        },
        paint: {
            "text-color": [
                "case",
                ["boolean", ["feature-state", "active"], false],
                "#f59e0b", // Active: amber
                ["boolean", ["feature-state", "highlight"], false],
                "#2563eb", // Highlight: blue
                ["boolean", ["feature-state", "hasData"], false],
                "#111827", // HasData: dark gray
                "#6b7280" // Default: gray
            ],
            "text-halo-color": "#ffffff",
            "text-halo-width": [
                "case",
                ["boolean", ["feature-state", "active"], false],
                4.2,
                ["boolean", ["feature-state", "highlight"], false],
                3.6,
                2.8
            ],
            "text-opacity": 1.0
        }
    };

    // Insert after existing label layers (or at the end)
    if (!Array.isArray(style.layers)) {
        style.layers = [];
    }

    // Find insert position: after all existing symbol layers
    let insertIdx = style.layers.length;
    if (style.layers && style.layers.length > 0) {
        for (let i = style.layers.length - 1; i >= 0; i--) {
            if (style.layers[i]?.type === "symbol") {
                insertIdx = i + 1;
                break;
            }
        }
    }

    style.layers.splice(insertIdx, 0, labelLayer);

    if (process.env.NODE_ENV === "development") {
        console.info(
            `[commune-labels-vector] Injected vector layer (source: ${sourceLayer}) at position ${insertIdx}`
        );
    }
}

/**
 * Get the layer ID for commune labels (used by interaction service).
 */
export function getCommuneLabelsVectorLayerId(): string {
    return COMMUNE_LABELS_LAYER_ID;
}

/**
 * Get the source ID for commune labels (for direct map manipulation if needed).
 */
export function getCommuneLabelsVectorSourceId(): string {
    return COMMUNE_LABELS_SOURCE_ID;
}
