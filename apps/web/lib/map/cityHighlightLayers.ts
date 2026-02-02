/**
 * City Highlight Layers - Manages hover and selection state for city labels.
 * Uses feature-state for styling changes without layer filter manipulation.
 */

import type { Map as MapLibreMap, StyleSpecification } from "maplibre-gl";

import { OMT_LABEL_LAYER_IDS } from "./registry/layerRegistry";

// Managed city label metadata flag
const MANAGED_CITY_LABEL_METADATA_FLAG = "csv:managedCityLabel";

// List of commune label layers to look for
const COMMUNE_LABEL_LAYERS: string[] = [
    "custom-city-label::place_label_other",
    "custom-city-label::place_label_city",
    ...OMT_LABEL_LAYER_IDS
];

const highlightHandleCache = new WeakMap<MapLibreMap, CityHighlightHandle>();
let missingLayerWarned = false;

export type FeatureStateTarget = {
    source: string;
    sourceLayer?: string;
    id: string | number;
};

export type CityHighlightHandle = {
    hoverTarget: FeatureStateTarget | null;
    selectedTarget: FeatureStateTarget | null;
};

export type CityHighlightLayerOptions = {
    logStyleHints?: boolean;
};

export function ensureCityHighlightLayer(
    map: MapLibreMap,
    options?: CityHighlightLayerOptions
): CityHighlightHandle | null {
    const existing = highlightHandleCache.get(map);
    if (existing) {
        return existing;
    }

    if (!hasManagedCityLabelLayer(map)) {
        if (!missingLayerWarned) {
            if (options?.logStyleHints) {
                debugLogSymbolLabelHints(map.getStyle());
            }
            console.warn(
                `[map-style] Unable to locate managed commune label layers. Looked for: ${COMMUNE_LABEL_LAYERS.join(", ")}`
            );
            missingLayerWarned = true;
        }
        return null;
    }

    missingLayerWarned = false;
    const handle: CityHighlightHandle = {
        hoverTarget: null,
        selectedTarget: null
    };
    highlightHandleCache.set(map, handle);
    return handle;
}

export function setHoveredCity(
    map: MapLibreMap,
    handle: CityHighlightHandle,
    target: FeatureStateTarget | null
): void {
    updateFeatureState(map, handle, "hoverTarget", target, "hover");
}

export function setSelectedCity(
    map: MapLibreMap,
    handle: CityHighlightHandle,
    target: FeatureStateTarget | null
): void {
    updateFeatureState(map, handle, "selectedTarget", target, "selected");
}

export function removeCityHighlightLayer(map: MapLibreMap): void {
    const handle = highlightHandleCache.get(map);
    if (!handle) {
        return;
    }
    clearFeatureState(map, handle.hoverTarget, "hover");
    clearFeatureState(map, handle.selectedTarget, "selected");
    highlightHandleCache.delete(map);
}

function hasManagedCityLabelLayer(map: MapLibreMap): boolean {
    const style = map.getStyle();
    const layers = style?.layers ?? [];
    if (!layers.length) {
        return false;
    }
    return layers.some((layer) => isManagedCityLabelLayer(layer));
}

function isManagedCityLabelLayer(layer: StyleSpecification["layers"][number] | undefined): boolean {
    if (!layer) {
        return false;
    }
    const metadata = (layer as { metadata?: unknown }).metadata;
    if (!metadata || typeof metadata !== "object") {
        return false;
    }
    return Boolean((metadata as Record<string, unknown>)[MANAGED_CITY_LABEL_METADATA_FLAG]);
}

function updateFeatureState(
    map: MapLibreMap,
    handle: CityHighlightHandle,
    key: "hoverTarget" | "selectedTarget",
    nextTarget: FeatureStateTarget | null,
    stateKey: "hover" | "selected"
): void {
    const current = handle[key];
    if (isSameFeatureTarget(current, nextTarget)) {
        return;
    }

    if (current) {
        clearFeatureState(map, current, stateKey);
        handle[key] = null;
    }

    if (nextTarget) {
        applyFeatureState(map, nextTarget, stateKey, true);
        handle[key] = nextTarget;
    }
}

function isSameFeatureTarget(a: FeatureStateTarget | null, b: FeatureStateTarget | null): boolean {
    if (a === b) {
        return true;
    }
    if (!a || !b) {
        return false;
    }
    return a.id === b.id && a.source === b.source && a.sourceLayer === b.sourceLayer;
}

function clearFeatureState(
    map: MapLibreMap,
    target: FeatureStateTarget | null,
    key: "hover" | "selected"
): void {
    if (!target) {
        return;
    }
    applyFeatureState(map, target, key, false);
}

function applyFeatureState(
    map: MapLibreMap,
    target: FeatureStateTarget,
    key: "hover" | "selected",
    value: boolean
): void {
    try {
        map.setFeatureState(
            {
                source: target.source,
                sourceLayer: target.sourceLayer,
                id: target.id
            },
            { [key]: value }
        );
    } catch (error) {
        if (process.env.NODE_ENV === "development") {
            console.warn(`[map-style] Failed to update feature state for ${key}`, error);
        }
    }
}

function debugLogSymbolLabelHints(style?: StyleSpecification | null): void {
    if (!style?.layers) {
        return;
    }
    const candidates = style.layers.filter((layer) => {
        if (layer.type !== "symbol") {
            return false;
        }
        const layout = layer.layout as Record<string, unknown> | undefined;
        return layout && typeof layout["text-field"] !== "undefined";
    });
    if (candidates.length) {
        console.warn("[map-style] Available text symbol layers:", candidates.map((layer) => layer.id).join(", "));
    }
}
