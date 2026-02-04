/**
 * Map Interaction Service – highlight and click interactions on managed label layers.
 *
 * Responsibilities:
 * - Use label features as the sole interaction surface
 * - Resolve labels to entities via name-first, distance-second order
 * - Keep SelectionService highlight/active state in sync with feature-state
 * - Proactively set hasData on visible labels whenever the viewport changes
 */

import type {
    MapGeoJSONFeature,
    Map as MapLibreMap,
    MapMouseEvent,
    PointLike
} from "maplibre-gl";

import { findCommunesByNormalizedName } from "@/lib/data/communesIndexLite";
import { resolveNearestCommuneInsee } from "@/lib/data/communeSpatialIndex";
import { findInfraZonesByNormalizedName } from "@/lib/data/infraZonesIndexLite";
import { resolveNearestInfraZoneByDistance } from "@/lib/data/infraZoneSpatialIndex";
import { normalizeName } from "@/lib/data/nameNormalization";
import { entityRefKey, getSelectionService, type EntityRef } from "@/lib/selection";

import { extractLabelIdentity, type LabelIdentity } from "./interactiveLayers";
import { buildManagedCityLabelLayerId, OMT_LABEL_LAYER_IDS } from "./registry/layerRegistry";

// ============================================================================
// Constants
// ============================================================================

const HIGHLIGHT_THROTTLE_MS = 100;
const HAS_DATA_THROTTLE_MS = 150;
const HAS_DATA_TTL_MS = 60_000;
const HAS_DATA_BATCH_SIZE = 40;
const COMMUNE_LABEL_CLASSES = new Set(["city", "town", "village"]);
const INFRA_LABEL_CLASSES = new Set(["suburb", "neighbourhood", "borough"]);

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

type LabelFeatureKey = string;

type LabelEvaluation = {
    hasData: boolean;
    entityRef: EntityRef | null;
    updatedAt: number;
    name: string;
    placeClass: string | null;
};

type LabelHit = {
    label: LabelIdentity;
    featureStateTarget: FeatureStateTarget;
};

type FeatureStateHandle = {
    highlightTarget: FeatureStateTarget | null;
    activeTarget: FeatureStateTarget | null;
};

// ============================================================================
// Public API
// ============================================================================

export function attachMapInteractionService(
    map: MapLibreMap,
    options?: MapInteractionServiceOptions
): () => void {
    const selectionService = getSelectionService();
    const featureStateHandle: FeatureStateHandle = {
        highlightTarget: null,
        activeTarget: null
    };

    let lastHighlightFeatureId: string | number | null = null;
    let lastMoveTs = 0;
    let disposed = false;
    let highlightRequestToken = 0;
    const debug = options?.debug ?? false;

    const hasDataEvaluator = new LabelHasDataEvaluator(map, debug);
    hasDataEvaluator.start();

    const unsubscribe = selectionService.subscribe(() => {
        const state = selectionService.getState();
        const highlightTarget = hasDataEvaluator.getLabelForEntity(state.highlighted);
        const activeTarget = hasDataEvaluator.getLabelForEntity(state.active);

        updateFeatureState(map, featureStateHandle, "highlightTarget", highlightTarget, "highlight");
        updateFeatureState(map, featureStateHandle, "activeTarget", activeTarget, "active");
    });

    const handleMouseMove = (event: MapMouseEvent): void => {
        const now = performance.now();
        if (now - lastMoveTs < HIGHLIGHT_THROTTLE_MS) {
            return;
        }
        lastMoveTs = now;

        const requestId = ++highlightRequestToken;
        const hit = pickLabelFeature(map, event.point);

        if (disposed || requestId !== highlightRequestToken) {
            return;
        }

        const nextId = hit?.label.featureId ?? null;
        if (nextId === lastHighlightFeatureId) {
            return;
        }
        lastHighlightFeatureId = nextId;

        if (!hit) {
            updateFeatureState(map, featureStateHandle, "highlightTarget", null, "highlight");
            selectionService.setHighlighted(null);
            return;
        }

        const lngLat = map.unproject(event.point);
        void hasDataEvaluator.evaluateAndCache(hit.label, hit.featureStateTarget, lngLat).then((evaluation) => {
            if (disposed || requestId !== highlightRequestToken) {
                return;
            }

            if (!evaluation.hasData || !evaluation.entityRef) {
                updateFeatureState(map, featureStateHandle, "highlightTarget", null, "highlight");
                selectionService.setHighlighted(null);
                return;
            }

            updateFeatureState(map, featureStateHandle, "highlightTarget", hit.featureStateTarget, "highlight");
            selectionService.setHighlighted(evaluation.entityRef);
        });
    };

    const handleMouseLeave = (): void => {
        highlightRequestToken++;
        if (lastHighlightFeatureId !== null) {
            lastHighlightFeatureId = null;
            updateFeatureState(map, featureStateHandle, "highlightTarget", null, "highlight");
            selectionService.setHighlighted(null);
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
                    updateFeatureState(map, featureStateHandle, "activeTarget", null, "active");
                    selectionService.setActive(null);
                    return;
                }

                const lngLat = map.unproject(event.point);
                const evaluation = await hasDataEvaluator.evaluateAndCache(
                    hit.label,
                    hit.featureStateTarget,
                    lngLat
                );

                if (disposed) {
                    return;
                }

                if (evaluation.hasData && evaluation.entityRef) {
                    updateFeatureState(map, featureStateHandle, "activeTarget", hit.featureStateTarget, "active");
                    selectionService.setActive(evaluation.entityRef);
                } else {
                    updateFeatureState(map, featureStateHandle, "activeTarget", null, "active");
                    selectionService.setActive(null);
                }
            } catch (error) {
                if (process.env.NODE_ENV === "development") {
                    console.warn("[map-interaction] Failed to resolve entity on click", error);
                }
                selectionService.setActive(null);
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

        hasDataEvaluator.stop();
        unsubscribe();

        if (featureStateHandle.highlightTarget) {
            applyFeatureState(map, featureStateHandle.highlightTarget, { highlight: false });
        }
        if (featureStateHandle.activeTarget) {
            applyFeatureState(map, featureStateHandle.activeTarget, { active: false });
        }
    };
}

// ============================================================================
// Feature State Helpers
// ============================================================================

function applyFeatureState(map: MapLibreMap, target: FeatureStateTarget, state: Record<string, boolean>): void {
    try {
        map.setFeatureState(
            {
                source: target.source,
                sourceLayer: target.sourceLayer,
                id: target.id
            },
            state
        );
    } catch {
        // Ignore invalid targets (feature left the tile pyramid)
    }
}

function updateFeatureState(
    map: MapLibreMap,
    handle: FeatureStateHandle,
    key: "highlightTarget" | "activeTarget",
    nextTarget: FeatureStateTarget | null,
    stateKey: "highlight" | "active"
): void {
    const current = handle[key];

    if (current === nextTarget) {
        return;
    }
    if (
        current &&
        nextTarget &&
        current.id === nextTarget.id &&
        current.source === nextTarget.source &&
        current.sourceLayer === nextTarget.sourceLayer
    ) {
        return;
    }

    if (current) {
        applyFeatureState(map, current, { [stateKey]: false });
        handle[key] = null;
    }

    if (nextTarget) {
        applyFeatureState(map, nextTarget, { [stateKey]: true });
        handle[key] = nextTarget;
    }
}

// ============================================================================
// Label Has-Data Evaluator
// ============================================================================

class LabelHasDataEvaluator {
    private map: MapLibreMap;
    private debug: boolean;
    private timer: number | null = null;
    private requestId = 0;
    private disposed = false;
    private cache = new Map<LabelFeatureKey, LabelEvaluation>();
    private entityToLabel = new Map<string, FeatureStateTarget>();

    constructor(map: MapLibreMap, debug: boolean) {
        this.map = map;
        this.debug = debug;
    }

    start(): void {
        if (this.map.isStyleLoaded()) {
            this.scheduleEvaluation();
        } else {
            this.map.once("load", () => this.scheduleEvaluation());
        }
        this.map.on("moveend", this.handleViewportChange);
        this.map.on("zoomend", this.handleViewportChange);
    }

    stop(): void {
        this.disposed = true;
        this.map.off("moveend", this.handleViewportChange);
        this.map.off("zoomend", this.handleViewportChange);
        if (this.timer !== null) {
            window.clearTimeout(this.timer);
            this.timer = null;
        }
    }

    getLabelForEntity(entity: EntityRef | null): FeatureStateTarget | null {
        if (!entity) {
            return null;
        }
        return this.entityToLabel.get(entityRefKey(entity)) ?? null;
    }

    scheduleEvaluation(): void {
        if (this.disposed) {
            return;
        }
        this.requestId += 1;
        const currentId = this.requestId;
        if (this.timer !== null) {
            window.clearTimeout(this.timer);
        }
        this.timer = window.setTimeout(() => {
            this.timer = null;
            void this.evaluateVisibleLabels(currentId);
        }, HAS_DATA_THROTTLE_MS);
    }

    async evaluateAndCache(
        label: LabelIdentity,
        target: FeatureStateTarget,
        lngLat: { lng: number; lat: number }
    ): Promise<LabelEvaluation> {
        const cached = this.getCachedEvaluation(target, label);
        if (cached) {
            applyFeatureState(this.map, target, { hasData: cached.hasData });
            return cached;
        }

        const entityRef = await resolveEntityRef(label, lngLat, this.debug);
        const hasData = Boolean(entityRef);
        const evaluation: LabelEvaluation = {
            hasData,
            entityRef,
            updatedAt: Date.now(),
            name: label.name,
            placeClass: label.placeClass
        };

        this.cache.set(buildLabelFeatureKey(target), evaluation);
        applyFeatureState(this.map, target, { hasData });

        if (entityRef) {
            this.entityToLabel.set(entityRefKey(entityRef), target);
        }

        return evaluation;
    }

    private getCachedEvaluation(target: FeatureStateTarget, label: LabelIdentity): LabelEvaluation | null {
        const key = buildLabelFeatureKey(target);
        const cached = this.cache.get(key);
        if (!cached) {
            return null;
        }
        if (Date.now() - cached.updatedAt > HAS_DATA_TTL_MS) {
            return null;
        }
        if (cached.name !== label.name || cached.placeClass !== label.placeClass) {
            return null;
        }
        return cached;
    }

    private handleViewportChange = (): void => {
        this.scheduleEvaluation();
    };

    private async evaluateVisibleLabels(currentId: number): Promise<void> {
        if (this.disposed || currentId !== this.requestId || !this.map.isStyleLoaded()) {
            return;
        }

        const availableLayers = MANAGED_LABEL_LAYER_IDS.filter((id) => this.map.getLayer(id));
        if (!availableLayers.length) {
            return;
        }

        const canvas = this.map.getCanvas();
        const bounds: [PointLike, PointLike] = [
            [0, 0],
            [canvas.width, canvas.height]
        ];

        const features = this.map.queryRenderedFeatures(bounds, { layers: availableLayers });
        if (!features.length) {
            return;
        }

        const labeledFeatures = features
            .map((feature) => {
                const label = extractLabelIdentity(feature);
                if (!label) {
                    return null;
                }
                const target = createFeatureStateTarget(feature);
                if (!target) {
                    return null;
                }
                const lngLat = getFeatureLngLat(feature);
                if (!lngLat) {
                    return null;
                }
                return { label, target, lngLat };
            })
            .filter(Boolean) as Array<{ label: LabelIdentity; target: FeatureStateTarget; lngLat: { lng: number; lat: number } }>;

        for (let i = 0; i < labeledFeatures.length; i += HAS_DATA_BATCH_SIZE) {
            if (this.disposed || currentId !== this.requestId) {
                return;
            }
            const batch = labeledFeatures.slice(i, i + HAS_DATA_BATCH_SIZE);
            await Promise.all(
                batch.map((entry) => this.evaluateAndCache(entry.label, entry.target, entry.lngLat))
            );
            if (i + HAS_DATA_BATCH_SIZE < labeledFeatures.length) {
                await new Promise((resolve) => window.setTimeout(resolve, 0));
            }
        }
    }
}

// ============================================================================
// Label Picking Helpers
// ============================================================================

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

function buildLabelFeatureKey(target: FeatureStateTarget): LabelFeatureKey {
    return `${target.source}:${target.sourceLayer ?? ""}:${target.id}`;
}

function getFeatureLngLat(feature: MapGeoJSONFeature): { lng: number; lat: number } | null {
    const geometry = feature.geometry as { type?: string; coordinates?: unknown } | null;
    if (!geometry || !geometry.coordinates) {
        return null;
    }

    if (geometry.type === "Point" && Array.isArray(geometry.coordinates)) {
        const [lng, lat] = geometry.coordinates as [number, number];
        if (Number.isFinite(lng) && Number.isFinite(lat)) {
            return { lng, lat };
        }
    }

    if (geometry.type === "MultiPoint" && Array.isArray(geometry.coordinates)) {
        const first = geometry.coordinates[0] as [number, number] | undefined;
        if (first && Number.isFinite(first[0]) && Number.isFinite(first[1])) {
            return { lng: first[0], lat: first[1] };
        }
    }

    return null;
}

// ============================================================================
// Entity Resolution (Label-First Order)
// ============================================================================

async function resolveEntityRef(
    label: LabelIdentity,
    lngLat: { lng: number; lat: number },
    debug: boolean
): Promise<EntityRef | null> {
    const placeClass = label.placeClass;

    if (placeClass && INFRA_LABEL_CLASSES.has(placeClass)) {
        return resolveInfraZoneLabel(label, lngLat, debug);
    }

    if (!placeClass || COMMUNE_LABEL_CLASSES.has(placeClass)) {
        return resolveCommuneLabel(label, lngLat, debug);
    }

    return null;
}

async function resolveCommuneLabel(
    label: LabelIdentity,
    lngLat: { lng: number; lat: number },
    debug: boolean
): Promise<EntityRef | null> {
    const normalized = normalizeName(label.name);

    if (normalized) {
        const candidates = await findCommunesByNormalizedName(normalized);
        if (candidates.length === 1) {
            return { kind: "commune", inseeCode: candidates[0].inseeCode };
        }
        if (candidates.length > 1) {
            const nearest = pickNearestByDistance(candidates, lngLat);
            if (nearest) {
                return { kind: "commune", inseeCode: nearest.inseeCode };
            }
        }
    }

    const nearest = await resolveNearestCommuneInsee(lngLat.lng, lngLat.lat);
    if (nearest) {
        return { kind: "commune", inseeCode: nearest.inseeCode };
    }

    if (debug && process.env.NODE_ENV === "development") {
        console.warn("[map-interaction] Commune resolution failed", {
            labelName: label.name,
            placeClass: label.placeClass
        });
    }

    return null;
}

async function resolveInfraZoneLabel(
    label: LabelIdentity,
    lngLat: { lng: number; lat: number },
    debug: boolean
): Promise<EntityRef | null> {
    const normalized = normalizeName(label.name);

    if (normalized) {
        const candidates = await findInfraZonesByNormalizedName(normalized);
        if (candidates.length === 1) {
            return { kind: "infraZone", id: candidates[0].id };
        }
        if (candidates.length > 1) {
            const nearest = pickNearestByDistance(candidates, lngLat);
            if (nearest) {
                return { kind: "infraZone", id: nearest.id };
            }
        }
    }

    const nearest = await resolveNearestInfraZoneByDistance(lngLat.lng, lngLat.lat);
    if (nearest) {
        return { kind: "infraZone", id: nearest.id };
    }

    if (debug && process.env.NODE_ENV === "development") {
        console.warn("[map-interaction] Infra-zone resolution failed", {
            labelName: label.name,
            placeClass: label.placeClass
        });
    }

    return null;
}

function pickNearestByDistance<T extends { lat: number; lon: number }>(
    candidates: T[],
    lngLat: { lng: number; lat: number }
): T | null {
    let best: { entry: T; distance: number } | null = null;
    for (const entry of candidates) {
        if (!Number.isFinite(entry.lat) || !Number.isFinite(entry.lon)) {
            continue;
        }
        const distance = haversineDistanceKm(lngLat.lat, lngLat.lng, entry.lat, entry.lon);
        if (!best || distance < best.distance) {
            best = { entry, distance };
        }
    }
    return best?.entry ?? null;
}

function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = degreesToRadians(lat2 - lat1);
    const dLon = degreesToRadians(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(degreesToRadians(lat1)) *
        Math.cos(degreesToRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function degreesToRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
}
