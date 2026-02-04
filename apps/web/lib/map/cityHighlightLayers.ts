/**
 * City Highlight Layers - Manages hover and selection feature-state for city labels.
 * Uses feature-state for styling changes without layer filter manipulation.
 */

import type { Map as MapLibreMap } from "maplibre-gl";

import { isManagedCityLabelLayer } from "./layers/managedCityLabels";

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

/**
 * Initialize highlight state tracking for a map.
 * Returns a handle for managing hover/selection state.
 */
export function ensureCityHighlightLayer(
    map: MapLibreMap
): CityHighlightHandle | null {
    const existing = highlightHandleCache.get(map);
    if (existing) {
        return existing;
    }

    if (!hasManagedCityLabelLayer(map)) {
        if (!missingLayerWarned) {
            console.warn("[map-style] Unable to locate managed city label layers.");
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
