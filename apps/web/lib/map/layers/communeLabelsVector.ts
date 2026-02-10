/**
 * Commune Labels Vector Layer
 * 
 * Injects a custom vector tile source and symbol layer for commune labels.
 * These labels come from our own MBTiles (commune-labels.mbtiles) generated from indexLite.json.
 * 
 * Progressive label density mimics OSM behavior:
 * - z0-5: Megacities only (pop > 300k) - Paris, Lyon, Marseille, etc.
 * - z6-7: Major cities (pop > 50k)
 * - z8-9: Medium cities (pop > 10k)
 * - z10-11: Towns (pop > 2k)
 * - z12+: All communes visible
 * 
 * The layer supports feature-state for interactive highlighting:
 * - hasData: Commune has data available
 * - highlight: Hovered
 * - active: Selected/clicked
 */

import type { ExpressionSpecification, LayerSpecification, StyleSpecification } from "maplibre-gl";

import { ENTITY_STATE_COLORS } from "./entityVisualStateColors";

const COMMUNE_LABELS_SOURCE_ID = "commune-labels-vector";
const COMMUNE_LABELS_LAYER_ID = "commune_labels";

export type CommuneLabelsVectorConfig = {
    tileJsonUrl: string;
    sourceLayer?: string;
};

// Population-based text size: varies by both zoom and population.
// At each zoom step, larger cities get bigger text.
// Features with text-size 0 are effectively hidden by MapLibre.
// CRITICAL: Use "step" at root level (not "interpolate") to avoid zoom interpolation
// that breaks population thresholds between zoom levels.
const TEXT_SIZE_EXPRESSION: ExpressionSpecification = [
    "step", ["zoom"],
    // z0-5: Only megacities (> 300k)
    ["step", ["coalesce", ["get", "population"], 0],
        0,        // pop < 300k: hidden
        300000, 20
    ],
    // z6-7: Major cities (> 50k)
    6, ["step", ["coalesce", ["get", "population"], 0],
        0,        // pop < 50k: hidden
        50000, 14,
        100000, 16,
        300000, 20
    ],
    // z8-9: Medium cities (> 10k)
    8, ["step", ["coalesce", ["get", "population"], 0],
        0,        // pop < 10k: hidden
        10000, 14,
        100000, 16,
        300000, 20
    ],
    // z10-11: Towns (> 2k)
    10, ["step", ["coalesce", ["get", "population"], 0],
        0,        // pop < 2k: hidden
        2000, 14,
        100000, 16,
        300000, 20
    ],
    // z12-13: All communes visible, scaled by size
    11, ["step", ["coalesce", ["get", "population"], 0],
        14,       // villages: 11px
        5000, 14,
        100000, 16,
        300000, 20
    ],
    // z14+: Larger text for detail
    14, ["step", ["coalesce", ["get", "population"], 0],
        16,
        10000, 16,
        100000, 16,
        300000, 20
    ]
];

/**
 * Inject commune labels vector source and symbol layer into the map style.
 * Call this during style pipeline processing.
 */
export function injectCommuneLabelsVector(
    style: StyleSpecification,
    config: CommuneLabelsVectorConfig
): void {
    const sourceLayer = config.sourceLayer ?? "commune_labels";

    if (!style.sources) {
        style.sources = {};
    }

    style.sources[COMMUNE_LABELS_SOURCE_ID] = {
        type: "vector",
        url: config.tileJsonUrl,
        promoteId: { [sourceLayer]: "insee" }
    };

    const labelLayer: LayerSpecification = {
        id: COMMUNE_LABELS_LAYER_ID,
        type: "symbol",
        source: COMMUNE_LABELS_SOURCE_ID,
        "source-layer": sourceLayer,
        minzoom: 0,
        maxzoom: 18,
        layout: {
            "text-field": ["get", "name"],
            "text-font": ["Noto Sans Regular"],
            "text-size": TEXT_SIZE_EXPRESSION,
            "text-anchor": "center",
            "text-offset": [0, 0],
            "text-allow-overlap": false,
            "text-optional": true,
            "text-padding": 3,
            "symbol-sort-key": ["-", ["coalesce", ["get", "population"], 0]]
        },
        paint: {
            "text-color": [
                "case",
                ["boolean", ["feature-state", "active"], false],
                ENTITY_STATE_COLORS.active,
                ["boolean", ["feature-state", "highlight"], false],
                ENTITY_STATE_COLORS.highlight,
                ["boolean", ["feature-state", "hasData"], false],
                ENTITY_STATE_COLORS.hasData,
                ENTITY_STATE_COLORS.noData
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

    if (!Array.isArray(style.layers)) {
        style.layers = [];
    }

    // Insert BEFORE place_label_other so arrondissement labels render on top
    let insertIdx = style.layers.length;
    for (let i = 0; i < style.layers.length; i++) {
        if (style.layers[i]?.id === "place_label_other") {
            insertIdx = i;
            break;
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
