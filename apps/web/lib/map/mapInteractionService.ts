/**
 * Map Interaction Service - Simplified hover and click interactions on map labels.
 *
 * This service handles map interactions and translates them to SelectionService calls.
 * It uses native OSM labels (place_label_city, place_label_other) with feature-state.
 *
 * ARCHITECTURE:
 * - Map interactions → mapInteractionService → SelectionService
 * - The map component does NOT manage selection state directly
 * - Feature-state for visual feedback is managed internally
 */

import type {
    MapGeoJSONFeature,
    Map as MapLibreMap,
    MapMouseEvent,
    PointLike
} from "maplibre-gl";

import { resolveCommuneByClick } from "@/lib/data/communeSpatialIndex";
import { resolveInfraZoneByClick } from "@/lib/data/infraZoneSpatialIndex";
import { getSelectionService, type EntityRef } from "@/lib/selection";

import { extractLabelIdentity, type LabelIdentity } from "./interactiveLayers";
import { buildManagedCityLabelLayerId, OMT_LABEL_LAYER_IDS } from "./registry/layerRegistry";

// ============================================================================
// Constants
// ============================================================================

const HOVER_THROTTLE_MS = 60;
const COMMUNE_LABEL_CLASSES = new Set(["city", "town", "village"]);
const INFRA_LABEL_CLASSES = new Set(["suburb", "neighbourhood", "borough"]);

/** Managed label layer IDs to query for interactions */
const MANAGED_LABEL_LAYER_IDS = OMT_LABEL_LAYER_IDS.map(buildManagedCityLabelLayerId);

// ============================================================================
// Types
// ============================================================================

export type FeatureStateTarget = {
    source: string;
    sourceLayer?: string;
    id: string | number;
};

export type MapInteractionServiceOptions = {
    debug?: boolean;
};

// ============================================================================
// Feature State Management (Internal)
// ============================================================================

type FeatureStateHandle = {
    hoverTarget: FeatureStateTarget | null;
    selectedTarget: FeatureStateTarget | null;
};

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
    } catch {
        // Silently ignore feature state errors
    }
}

function updateFeatureState(
    map: MapLibreMap,
    handle: FeatureStateHandle,
    key: "hoverTarget" | "selectedTarget",
    nextTarget: FeatureStateTarget | null,
    stateKey: "hover" | "selected"
): void {
    const current = handle[key];
    
    // Skip if same target
    if (current === nextTarget) return;
    if (current && nextTarget && 
        current.id === nextTarget.id && 
        current.source === nextTarget.source && 
        current.sourceLayer === nextTarget.sourceLayer) {
        return;
    }

    // Clear previous
    if (current) {
        applyFeatureState(map, current, stateKey, false);
        handle[key] = null;
    }

    // Apply new
    if (nextTarget) {
        applyFeatureState(map, nextTarget, stateKey, true);
        handle[key] = nextTarget;
    }
}

// ============================================================================
// Main Service
// ============================================================================

/**
 * Attach map interaction handlers for hover and click on city labels.
 * All selection changes go through the central SelectionService.
 * Returns a cleanup function to detach all handlers.
 */
export function attachMapInteractionService(
    map: MapLibreMap,
    options?: MapInteractionServiceOptions
): () => void {
    const selectionService = getSelectionService();
    const featureStateHandle: FeatureStateHandle = {
        hoverTarget: null,
        selectedTarget: null
    };

    let lastHoverFeatureId: string | number | null = null;
    let lastMoveTs = 0;
    let disposed = false;
    let hoverRequestToken = 0;
    const debug = options?.debug ?? false;

    // ========================================================================
    // Mouse Move (Hover)
    // ========================================================================

    const handleMouseMove = (event: MapMouseEvent): void => {
        const now = performance.now();
        if (now - lastMoveTs < HOVER_THROTTLE_MS) {
            return;
        }
        lastMoveTs = now;

        const requestId = ++hoverRequestToken;
        const hit = pickLabelFeature(map, event.point);

        if (disposed || requestId !== hoverRequestToken) {
            return;
        }

        const nextId = hit?.label.featureId ?? null;
        if (nextId === lastHoverFeatureId) {
            return;
        }
        lastHoverFeatureId = nextId;

        if (hit) {
            // Update feature state for visual feedback
            updateFeatureState(map, featureStateHandle, "hoverTarget", hit.featureStateTarget, "hover");
            
            // Resolve to EntityRef and update SelectionService
            void resolveEntityRef(hit.label, map.unproject(event.point), debug).then((ref) => {
                if (!disposed && ref) {
                    selectionService.setHighlighted(ref);
                }
            });
        } else {
            updateFeatureState(map, featureStateHandle, "hoverTarget", null, "hover");
            selectionService.setHighlighted(null);
        }
    };

    // ========================================================================
    // Mouse Leave
    // ========================================================================

    const handleMouseLeave = (): void => {
        hoverRequestToken++;
        if (lastHoverFeatureId !== null) {
            lastHoverFeatureId = null;
            updateFeatureState(map, featureStateHandle, "hoverTarget", null, "hover");
            selectionService.setHighlighted(null);
        }
    };

    // ========================================================================
    // Click (Select)
    // ========================================================================

    const handleClick = (event: MapMouseEvent): void => {
        void (async () => {
            try {
                const hit = pickLabelFeature(map, event.point);
                if (disposed) {
                    return;
                }

                if (!hit) {
                    updateFeatureState(map, featureStateHandle, "selectedTarget", null, "selected");
                    selectionService.setActive(null);
                    return;
                }

                const lngLat = map.unproject(event.point);
                const ref = await resolveEntityRef(hit.label, lngLat, debug);

                if (disposed) {
                    return;
                }

                if (ref) {
                    updateFeatureState(map, featureStateHandle, "selectedTarget", hit.featureStateTarget, "selected");
                    selectionService.setActive(ref);
                } else {
                    updateFeatureState(map, featureStateHandle, "selectedTarget", null, "selected");
                    selectionService.setActive(null);
                }
            } catch (error) {
                if (process.env.NODE_ENV === "development") {
                    console.warn("[map-interaction] Failed to resolve selection on click", error);
                }
                selectionService.setActive(null);
            }
        })();
    };

    // ========================================================================
    // Attach Handlers
    // ========================================================================

    map.on("mousemove", handleMouseMove);
    map.on("mouseleave", handleMouseLeave);
    map.on("click", handleClick);

    // ========================================================================
    // Cleanup
    // ========================================================================

    return () => {
        disposed = true;
        map.off("mousemove", handleMouseMove);
        map.off("mouseleave", handleMouseLeave);
        map.off("click", handleClick);

        // Clear feature states
        if (featureStateHandle.hoverTarget) {
            applyFeatureState(map, featureStateHandle.hoverTarget, "hover", false);
        }
        if (featureStateHandle.selectedTarget) {
            applyFeatureState(map, featureStateHandle.selectedTarget, "selected", false);
        }
    };
}

// ============================================================================
// Feature Picking
// ============================================================================

type LabelHit = {
    label: LabelIdentity;
    featureStateTarget: FeatureStateTarget;
};

function pickLabelFeature(map: MapLibreMap, point: PointLike): LabelHit | null {
    if (!map.isStyleLoaded()) {
        return null;
    }

    const availableLayers = MANAGED_LABEL_LAYER_IDS.filter((id) => map.getLayer(id));
    if (!availableLayers.length) {
        return null;
    }

    const features = map.queryRenderedFeatures(point, { layers: availableLayers });
    if (!features.length) {
        return null;
    }

    const feature = features[0];
    if (!feature) {
        return null;
    }

    const label = extractLabelIdentity(feature);
    if (!label) {
        return null;
    }

    const featureStateTarget = createFeatureStateTarget(feature);
    if (!featureStateTarget) {
        return null;
    }

    return { label, featureStateTarget };
}

function createFeatureStateTarget(feature: MapGeoJSONFeature): FeatureStateTarget | null {
    const source = (feature as { source?: string }).source;
    if (typeof source !== "string") {
        return null;
    }

    const id = feature.id;
    if (id === null || id === undefined) {
        return null;
    }

    const sourceLayer = (feature as { sourceLayer?: string }).sourceLayer;
    const target: FeatureStateTarget = { source, id };
    if (sourceLayer) {
        target.sourceLayer = sourceLayer;
    }
    return target;
}

// ============================================================================
// Entity Resolution
// ============================================================================

async function resolveEntityRef(
    label: LabelIdentity,
    lngLat: { lng: number; lat: number },
    debug: boolean
): Promise<EntityRef | null> {
    const placeClass = label.placeClass;

    // InfraZone resolution for suburb/neighbourhood/borough
    if (placeClass && INFRA_LABEL_CLASSES.has(placeClass)) {
        const infraZone = await resolveInfraZoneByClick({
            lng: lngLat.lng,
            lat: lngLat.lat,
            labelName: label.name,
            debug,
            requireNameMatch: true
        });

        if (infraZone) {
            return {
                kind: "infraZone",
                id: infraZone.entry.id
            };
        }

        // InfraZone label but no match - don't fall back to commune
        return null;
    }

    // Commune resolution for city/town/village (or unknown class)
    if (!placeClass || COMMUNE_LABEL_CLASSES.has(placeClass)) {
        const commune = await resolveCommuneByClick({
            lng: lngLat.lng,
            lat: lngLat.lat,
            labelName: label.name,
            debug,
            requireNameMatch: true
        });

        if (commune) {
            return {
                kind: "commune",
                inseeCode: commune.inseeCode
            };
        }
    }

    return null;
}
