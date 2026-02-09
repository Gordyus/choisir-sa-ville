/**
 * Arrondissement Municipal Labels Vector Layer
 * 
 * Injects text labels for arrondissements municipaux (Paris, Lyon, Marseille).
 * Uses arr_municipal source which already exists for polygon rendering.
 * 
 * Display rules:
 * - z11+: All arrondissements visible with text labels
 * - Text size fixed at 12px (smaller than commune labels to avoid conflicts)
 * - Feature-state support for highlight/active interactions
 */

import type { LayerSpecification, StyleSpecification } from "maplibre-gl";

const ARR_MUNICIPAL_LABELS_LAYER_ID = "arr_municipal_labels";

/**
 * Inject arrondissement labels symbol layer into the map style.
 * Uses the existing arr_municipal vector source (already configured for polygons).
 */
export function injectArrMunicipalLabelsVector(style: StyleSpecification): void {
    if (!Array.isArray(style.layers)) {
        style.layers = [];
    }

    // Check if arr_municipal source exists (it should, from adminPolygons.ts)
    if (!style.sources?.arr_municipal) {
        if (process.env.NODE_ENV === "development") {
            console.warn("[arr-municipal-labels] arr_municipal source not found, skipping label injection");
        }
        return;
    }

    const labelLayer: LayerSpecification = {
        id: ARR_MUNICIPAL_LABELS_LAYER_ID,
        type: "symbol",
        source: "arr_municipal",
        "source-layer": "arr_municipal",
        minzoom: 11,
        maxzoom: 18,
        layout: {
            "text-field": ["get", "name"],
            "text-font": ["Noto Sans Regular"],
            "text-size": 12,
            "text-anchor": "center",
            "text-allow-overlap": false,
            "text-optional": true,
            "text-padding": 2
        },
        paint: {
            "text-color": [
                "case",
                ["boolean", ["feature-state", "active"], false],
                "#f59e0b",
                ["boolean", ["feature-state", "highlight"], false],
                "#2563eb",
                ["boolean", ["feature-state", "hasData"], false],
                "#475569", // Slightly lighter than communes to differentiate
                "#94a3b8"  // Light gray default
            ],
            "text-halo-color": "#ffffff",
            "text-halo-width": [
                "case",
                ["boolean", ["feature-state", "active"], false],
                4.0,
                ["boolean", ["feature-state", "highlight"], false],
                3.5,
                2.5
            ],
            "text-opacity": 0.9
        }
    };

    // Insert after commune labels or at the end of symbol layers
    let insertIdx = style.layers.length;
    for (let i = style.layers.length - 1; i >= 0; i--) {
        if (style.layers[i]?.id === "commune_labels") {
            insertIdx = i + 1;
            break;
        }
    }

    style.layers.splice(insertIdx, 0, labelLayer);

    if (process.env.NODE_ENV === "development") {
        console.info(
            `[arr-municipal-labels] Injected arrondissement labels layer at position ${insertIdx}`
        );
    }
}

/**
 * Get the layer ID for arrondissement labels (used by interaction service).
 */
export function getArrMunicipalLabelsVectorLayerId(): string {
    return ARR_MUNICIPAL_LABELS_LAYER_ID;
}
