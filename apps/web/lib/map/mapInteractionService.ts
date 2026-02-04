/**
 * Map Interaction Service – highlight and click interactions on the interactable label layer.
 *
 * Responsibilities:
 * - Use label features as the sole interaction surface
 * - Resolve labels to entities via name-first, distance-second order
 * - Update EntityStateService on user interactions (hover, click)
 * - Proactively set hasData on visible labels whenever the viewport changes
 * - Expose getLabelTargetForEntity for the EntityGraphicsBinder
 *
 * Note: This service does NOT apply highlight/active feature-state directly.
 * That responsibility belongs to EntityGraphicsBinder.
 */

import type {
    MapGeoJSONFeature,
    Map as MapLibreMap,
    MapMouseEvent,
    PointLike
} from "maplibre-gl";

import { DEFAULT_INTERACTABLE_LABEL_LAYER_ID } from "@/lib/config/mapTilesConfig";
import { findCommunesByNormalizedName } from "@/lib/data/communesIndexLite";
import { findInfraZonesByNormalizedName } from "@/lib/data/infraZonesIndexLite";
import { normalizeName } from "@/lib/data/nameNormalization";
import { entityRefKey, getEntityStateService, type EntityRef } from "@/lib/selection";

import { extractLabelIdentity, type LabelIdentity } from "./interactiveLayers";

// ============================================================================
// Constants
// ============================================================================

const HIGHLIGHT_THROTTLE_MS = 100;
const HAS_DATA_THROTTLE_MS = 150;
const HAS_DATA_TTL_MS = 60_000;
const HAS_DATA_BATCH_SIZE = 40;
const COMMUNE_LABEL_CLASSES = new Set(["city", "town", "village"]);
const INFRA_LABEL_CLASSES = new Set(["suburb", "neighbourhood", "borough"]);

// ============================================================================
// Types
// ============================================================================

export type FeatureStateTarget = {
    source: string;
    sourceLayer?: string;
    id: string | number;
};

export type GetLabelTargetForEntity = (entity: EntityRef | null) => FeatureStateTarget | null;

export type MapInteractionServiceResult = {
    cleanup: () => void;
    getLabelTargetForEntity: GetLabelTargetForEntity;
};

export type MapInteractionServiceOptions = {
    debug?: boolean;
    labelLayerId?: string;
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

// ============================================================================
// Public API
// ============================================================================

export function attachMapInteractionService(
    map: MapLibreMap,
    options?: MapInteractionServiceOptions
): MapInteractionServiceResult {
    const entityStateService = getEntityStateService();
    const labelLayerId = options?.labelLayerId ?? DEFAULT_INTERACTABLE_LABEL_LAYER_ID;

    let lastHighlightFeatureId: string | number | null = null;
    let lastMoveTs = 0;
    let disposed = false;
    let highlightRequestToken = 0;
    const debug = options?.debug ?? false;

    const canvas = map.getCanvas();
    const hasDataEvaluator = new LabelHasDataEvaluator(map, labelLayerId, debug);
    hasDataEvaluator.start();

    const handleMouseMove = (event: MapMouseEvent): void => {
        const now = performance.now();
        if (now - lastMoveTs < HIGHLIGHT_THROTTLE_MS) {
            return;
        }
        lastMoveTs = now;

        const requestId = ++highlightRequestToken;
        const hit = pickLabelFeature(map, event.point, labelLayerId);

        if (disposed || requestId !== highlightRequestToken) {
            return;
        }

        const nextId = hit?.label.featureId ?? null;
        if (nextId === lastHighlightFeatureId) {
            return;
        }
        lastHighlightFeatureId = nextId;

        if (!hit) {
            canvas.style.cursor = "";
            entityStateService.setHighlighted(null);
            return;
        }

        const lngLat = map.unproject(event.point);
        void hasDataEvaluator.evaluateAndCache(hit.label, hit.featureStateTarget, lngLat).then((evaluation) => {
            if (disposed || requestId !== highlightRequestToken) {
                return;
            }

            if (!evaluation.hasData || !evaluation.entityRef) {
                canvas.style.cursor = "";
                entityStateService.setHighlighted(null);
                return;
            }

            canvas.style.cursor = "pointer";
            entityStateService.setHighlighted(evaluation.entityRef);
        });
    };

    const handleMouseLeave = (): void => {
        highlightRequestToken++;
        canvas.style.cursor = "";
        if (lastHighlightFeatureId !== null) {
            lastHighlightFeatureId = null;
            entityStateService.setHighlighted(null);
        }
    };

    const handleClick = (event: MapMouseEvent): void => {
        void (async () => {
            try {
                const hit = pickLabelFeature(map, event.point, labelLayerId);
                if (disposed) {
                    return;
                }

                if (!hit) {
                    entityStateService.setActive(null);
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
                    entityStateService.setActive(evaluation.entityRef);
                } else {
                    entityStateService.setActive(null);
                }
            } catch (error) {
                if (process.env.NODE_ENV === "development") {
                    console.warn("[map-interaction] Failed to resolve entity on click", error);
                }
                entityStateService.setActive(null);
            }
        })();
    };

    map.on("mousemove", handleMouseMove);
    map.on("mouseleave", handleMouseLeave);
    map.on("click", handleClick);

    const cleanup = (): void => {
        disposed = true;
        canvas.style.cursor = "";
        map.off("mousemove", handleMouseMove);
        map.off("mouseleave", handleMouseLeave);
        map.off("click", handleClick);
        hasDataEvaluator.stop();
    };

    const getLabelTargetForEntity: GetLabelTargetForEntity = (entity) => {
        return hasDataEvaluator.getLabelForEntity(entity);
    };

    return { cleanup, getLabelTargetForEntity };
}

// ============================================================================
// Feature State Helpers (hasData only - highlight/active moved to EntityGraphicsBinder)
// ============================================================================

function applyHasDataState(map: MapLibreMap, target: FeatureStateTarget, hasData: boolean): void {
    try {
        map.setFeatureState(
            {
                source: target.source,
                sourceLayer: target.sourceLayer,
                id: target.id
            },
            { hasData }
        );
    } catch {
        // Ignore invalid targets (feature left the tile pyramid)
    }
}

// ============================================================================
// Label Has-Data Evaluator
// ============================================================================

class LabelHasDataEvaluator {
    private map: MapLibreMap;
    private labelLayerId: string;
    private debug: boolean;
    private timer: number | null = null;
    private requestId = 0;
    private disposed = false;
    private cache = new Map<LabelFeatureKey, LabelEvaluation>();
    private entityToLabel = new Map<string, FeatureStateTarget>();

    constructor(map: MapLibreMap, labelLayerId: string, debug: boolean) {
        this.map = map;
        this.labelLayerId = labelLayerId;
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
            applyHasDataState(this.map, target, cached.hasData);
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
        applyHasDataState(this.map, target, hasData);

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

        if (!this.map.getLayer(this.labelLayerId)) {
            return;
        }

        const canvas = this.map.getCanvas();
        const bounds: [PointLike, PointLike] = [
            [0, 0],
            [canvas.width, canvas.height]
        ];

        const features = this.map.queryRenderedFeatures(bounds, { layers: [this.labelLayerId] });
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

function pickLabelFeature(map: MapLibreMap, point: PointLike, layerId: string): LabelHit | null {
    if (!map.isStyleLoaded()) {
        return null;
    }

    if (!map.getLayer(layerId)) {
        return null;
    }

    const features = map.queryRenderedFeatures(point, { layers: [layerId] });
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
    if (!normalized) {
        logNoMatchingEntity(label, debug);
        return null;
    }

    const candidates = await findCommunesByNormalizedName(normalized);

    if (!candidates.length) {
        logNoMatchingEntity(label, debug);
        return null;
    }

    if (candidates.length === 1) {
        const [only] = candidates;
        return only ? { kind: "commune", inseeCode: only.inseeCode } : null;
    }

    const nearest = pickNearestByDistance(candidates, lngLat);
    if (nearest) {
        return { kind: "commune", inseeCode: nearest.inseeCode };
    }

    return null;
}

async function resolveInfraZoneLabel(
    label: LabelIdentity,
    lngLat: { lng: number; lat: number },
    debug: boolean
): Promise<EntityRef | null> {
    const normalized = normalizeName(label.name);
    if (!normalized) {
        logNoMatchingEntity(label, debug);
        return null;
    }

    const candidates = await findInfraZonesByNormalizedName(normalized);

    if (!candidates.length) {
        logNoMatchingEntity(label, debug);
        return null;
    }

    if (candidates.length === 1) {
        const [only] = candidates;
        return only ? { kind: "infraZone", id: only.id } : null;
    }

    const nearest = pickNearestByDistance(candidates, lngLat);
    if (nearest) {
        return { kind: "infraZone", id: nearest.id };
    }

    return null;
}

function logNoMatchingEntity(label: LabelIdentity, debug: boolean): void {
    if (!debug || process.env.NODE_ENV !== "development") {
        return;
    }

    console.warn("[map-interaction] No matching entity for label", {
        labelName: label.name,
        placeClass: label.placeClass
    });
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
