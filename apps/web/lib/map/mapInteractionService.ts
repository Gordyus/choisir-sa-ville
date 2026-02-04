/**
 * Map Interaction Service - Simplified hover and click interactions on map labels.
 * Uses native OSM labels (place_label_city, place_label_other) with feature-state.
 */

import type {
    MapGeoJSONFeature,
    MapMouseEvent,
    Map as MapLibreMap,
    PointLike
} from "maplibre-gl";

import { resolveCommuneByClick } from "@/lib/data/communeSpatialIndex";
import { resolveInfraZoneByClick } from "@/lib/data/infraZoneSpatialIndex";

import type { FeatureStateTarget } from "./cityHighlightLayers";
import { extractLabelIdentity, type LabelIdentity } from "./interactiveLayers";
import type { MapSelection } from "./mapSelection";
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

export type MapInteractionEvent =
    | {
          type: "hover";
          label: LabelIdentity;
          featureStateTarget: FeatureStateTarget;
      }
    | { type: "hoverLeave" }
    | {
          type: "select";
          label: LabelIdentity;
          selection: MapSelection;
          featureStateTarget: FeatureStateTarget;
      }
    | { type: "selectClear" };

export type MapInteractionListener = (event: MapInteractionEvent) => void;

export type MapInteractionServiceOptions = {
    debug?: boolean;
};

// ============================================================================
// Main Service
// ============================================================================

/**
 * Attach map interaction handlers for hover and click on city labels.
 * Returns a cleanup function to detach all handlers.
 */
export function attachMapInteractionService(
    map: MapLibreMap,
    listener: MapInteractionListener,
    options?: MapInteractionServiceOptions
): () => void {
    let lastHoverFeatureId: string | number | null = null;
    let lastMoveTs = 0;
    let disposed = false;
    let hoverRequestToken = 0;
    const debug = options?.debug ?? false;

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
            listener({
                type: "hover",
                label: hit.label,
                featureStateTarget: hit.featureStateTarget
            });
        } else {
            listener({ type: "hoverLeave" });
        }
    };

    const handleMouseLeave = (): void => {
        hoverRequestToken++;
        if (lastHoverFeatureId !== null) {
            lastHoverFeatureId = null;
            listener({ type: "hoverLeave" });
        }
    };

    const handleClick = (event: MapMouseEvent): void => {
        void (async () => {
            try {
                const hit = pickLabelFeature(map, event.point);
                if (disposed) {
                    return;
                }

                if (!hit) {
                    listener({ type: "selectClear" });
                    return;
                }

                const lngLat = map.unproject(event.point);
                const selection = await resolveSelection(hit.label, lngLat, debug);

                if (disposed) {
                    return;
                }

                if (selection) {
                    listener({
                        type: "select",
                        label: hit.label,
                        selection,
                        featureStateTarget: hit.featureStateTarget
                    });
                } else {
                    // Could not resolve to a valid selection - clear
                    listener({ type: "selectClear" });
                }
            } catch (error) {
                if (process.env.NODE_ENV === "development") {
                    console.warn("[map-interaction] Failed to resolve selection on click", error);
                }
                listener({ type: "selectClear" });
            }
        })();
    };

    map.on("mousemove", handleMouseMove);
    map.on("mouseleave", handleMouseLeave);
    map.on("click", handleClick);

    return () => {
        disposed = true;
        map.off("mousemove", handleMouseMove);
        map.off("mouseleave", handleMouseLeave);
        map.off("click", handleClick);
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

    // Take the first (topmost) feature
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
// Selection Resolution
// ============================================================================

async function resolveSelection(
    label: LabelIdentity,
    lngLat: { lng: number; lat: number },
    debug: boolean
): Promise<MapSelection | null> {
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
                id: infraZone.entry.id,
                parentCommuneCode: infraZone.entry.parentCommuneCode,
                name: infraZone.entry.name,
                infraType: infraZone.entry.type,
                code: infraZone.entry.code
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
                inseeCode: commune.inseeCode,
                name: label.name
            };
        }
    }

    return null;
}
