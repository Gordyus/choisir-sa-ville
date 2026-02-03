/**
 * Map Interaction Service - Handles hover and click interactions on the map.
 * Manages feature state for polygons and resolves city identities.
 */

import type {
    MapGeoJSONFeature,
    MapLayerMouseEvent,
    Map as MapLibreMap,
    MapMouseEvent,
    PointLike
} from "maplibre-gl";

import { resolveCommuneByClick, resolveNearestCommuneInsee } from "@/lib/data/communeSpatialIndex";

import type { FeatureStateTarget } from "./cityHighlightLayers";
import { extractCityIdentity, type CityIdentity } from "./interactiveLayers";
import { ADMIN_POLYGON_SPECS, extractLabelLayerIdFromHitbox, FEATURE_FIELDS } from "./registry/layerRegistry";

const HOVER_THROTTLE_MS = 60;
const CLICK_HITBOX_PX = 8;
const unresolvedWarningKeys = new Set<string>();

type PolygonInteractionConfig = {
    layerId: string;
};

const POLYGON_INTERACTION_CONFIGS: PolygonInteractionConfig[] = [
    {
        layerId: ADMIN_POLYGON_SPECS.arrMunicipal.fillLayerId
    },
    {
        layerId: ADMIN_POLYGON_SPECS.communes.fillLayerId
    }
];

type PolygonCityHit = {
    inseeCode: string | null;
    target: FeatureStateTarget | null;
    layerId: string | null;
};

type QueryGeometry = PointLike | [[number, number], [number, number]];

type CityInteractionEvent =
    | {
        type: "hoverCity";
        city: CityIdentity;
        interactiveLayerId: string;
        labelLayerId: string | null;
        featureStateTarget: FeatureStateTarget | null;
        lngLat: { lng: number; lat: number } | null;
    }
    | { type: "leaveCity" }
    | {
        type: "clickCity";
        city: CityIdentity;
        interactiveLayerId: string;
        labelLayerId: string | null;
        featureStateTarget: FeatureStateTarget | null;
        lngLat: { lng: number; lat: number } | null;
    };

type CityInteractionListener = (event: CityInteractionEvent) => void;

export type CityInteractionServiceOptions = {
    logHoverFeatures?: boolean;
    interactiveLayerIds: string[];
};

export function attachCityInteractionService(
    map: MapLibreMap,
    listener: CityInteractionListener,
    options?: CityInteractionServiceOptions
): () => void {
    let lastHoverId: string | null = null;
    let lastMoveTs = 0;
    let selectedPolygonTargets: FeatureStateTarget[] = [];
    let disposed = false;
    let hoverRequestToken = 0;
    const logHoverFeatures = options?.logHoverFeatures ?? false;
    const resolutionDebug = logHoverFeatures;
    const interactiveLayerIds = options?.interactiveLayerIds;
    if (!interactiveLayerIds || !interactiveLayerIds.length) {
        return () => { /* noop */ };
    }
    const polygonHoverCleanup = attachPolygonHoverHandlers(map);

    const applyPolygonSelection = (nextTargets: FeatureStateTarget[]): void => {
        selectedPolygonTargets = updatePolygonFeatureStateCollection(
            map,
            selectedPolygonTargets,
            nextTargets,
            "selected"
        );
    };

    const handlePointerMove = (event: MapMouseEvent): void => {
        const now = performance.now();
        if (now - lastMoveTs < HOVER_THROTTLE_MS) {
            return;
        }
        lastMoveTs = now;
        publishHover(event.point);
    };

    const handleMouseLeave = (): void => {
        hoverRequestToken++;
        if (lastHoverId !== null) {
            lastHoverId = null;
            listener({ type: "leaveCity" });
        }
    };

    const handleClick = (event: MapLayerMouseEvent): void => {
        void (async () => {
            try {
                const hit = await pickCityFeature(map, event.point, interactiveLayerIds, {
                    logHoverFeatures,
                    searchRadius: CLICK_HITBOX_PX,
                    warnOnUnresolved: true,
                    resolutionMode: "click",
                    debugResolution: resolutionDebug
                });
                if (disposed) {
                    return;
                }
                if (hit) {
                    listener({
                        type: "clickCity",
                        city: hit.city,
                        interactiveLayerId: hit.interactiveLayerId,
                        labelLayerId: hit.labelLayerId,
                        featureStateTarget: hit.featureStateTarget,
                        lngLat: hit.lngLat
                    });
                    applyPolygonSelection(hit.polygonTargets);
                } else {
                    applyPolygonSelection([]);
                }
            } catch (error) {
                if (process.env.NODE_ENV === "development") {
                    console.warn("[map-interaction] Failed to resolve city on click", error);
                }
            }
        })();
    };

    const publishHover = (point: PointLike): void => {
        const requestId = ++hoverRequestToken;
        void (async () => {
            try {
                const hit = await pickCityFeature(map, point, interactiveLayerIds, {
                    logHoverFeatures,
                    searchRadius: 0,
                    warnOnUnresolved: false,
                    resolutionMode: "hover",
                    debugResolution: resolutionDebug
                });
                if (disposed || requestId !== hoverRequestToken) {
                    return;
                }
                const nextId = hit?.city.id ?? null;
                if (nextId === lastHoverId) {
                    return;
                }
                lastHoverId = nextId;
                if (hit) {
                    listener({
                        type: "hoverCity",
                        city: hit.city,
                        interactiveLayerId: hit.interactiveLayerId,
                        labelLayerId: hit.labelLayerId,
                        featureStateTarget: hit.featureStateTarget,
                        lngLat: hit.lngLat
                    });
                } else {
                    listener({ type: "leaveCity" });
                }
            } catch (error) {
                if (process.env.NODE_ENV === "development") {
                    console.warn("[map-interaction] Failed to resolve city on hover", error);
                }
            }
        })();
    };

    map.on("mousemove", handlePointerMove);
    map.on("mouseleave", handleMouseLeave);
    map.on("click", handleClick);

    return () => {
        disposed = true;
        map.off("mousemove", handlePointerMove);
        map.off("mouseleave", handleMouseLeave);
        map.off("click", handleClick);
        polygonHoverCleanup.forEach((cleanup) => cleanup());
        applyPolygonSelection([]);
    };
}

type CityFeatureHit = {
    city: CityIdentity;
    interactiveLayerId: string;
    labelLayerId: string | null;
    featureStateTarget: FeatureStateTarget | null;
    lngLat: { lng: number; lat: number } | null;
    polygonTargets: FeatureStateTarget[];
};

function attachPolygonHoverHandlers(map: MapLibreMap): Array<() => void> {
    return POLYGON_INTERACTION_CONFIGS.map((config) => attachPolygonHoverHandler(map, config));
}

function attachPolygonHoverHandler(map: MapLibreMap, config: PolygonInteractionConfig): () => void {
    if (!map.getLayer(config.layerId)) {
        return () => { /* noop */ };
    }
    let currentTarget: FeatureStateTarget | null = null;

    const applyHover = (nextTarget: FeatureStateTarget | null): void => {
        if (featureTargetsEqual(currentTarget, nextTarget)) {
            return;
        }
        if (currentTarget) {
            setPolygonFeatureState(map, currentTarget, "hover", false);
        }
        currentTarget = nextTarget;
        if (nextTarget) {
            setPolygonFeatureState(map, nextTarget, "hover", true);
        }
    };

    const handleMove = (event: MapLayerMouseEvent): void => {
        const feature = (event.features && event.features[0]) ?? null;
        if (!feature) {
            applyHover(null);
            return;
        }
        const target = createFeatureStateTarget(feature);
        applyHover(target);
    };

    const handleLeave = (): void => applyHover(null);

    map.on("mousemove", config.layerId, handleMove);
    map.on("mouseleave", config.layerId, handleLeave);

    return () => {
        map.off("mousemove", config.layerId, handleMove);
        map.off("mouseleave", config.layerId, handleLeave);
        applyHover(null);
    };
}

function setPolygonFeatureState(
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
            console.warn("[map-interaction] Failed to toggle polygon state", error);
        }
    }
}

function featureTargetsEqual(a: FeatureStateTarget | null, b: FeatureStateTarget | null): boolean {
    if (a === b) {
        return true;
    }
    if (!a || !b) {
        return false;
    }
    return a.id === b.id && a.source === b.source && a.sourceLayer === b.sourceLayer;
}

function updatePolygonFeatureStateCollection(
    map: MapLibreMap,
    current: FeatureStateTarget[],
    next: FeatureStateTarget[],
    key: "hover" | "selected"
): FeatureStateTarget[] {
    const dedupedNext = dedupeFeatureTargets(next);
    for (const target of current) {
        if (!dedupedNext.some((candidate) => featureTargetsEqual(candidate, target))) {
            setPolygonFeatureState(map, target, key, false);
        }
    }
    for (const target of dedupedNext) {
        if (!current.some((candidate) => featureTargetsEqual(candidate, target))) {
            setPolygonFeatureState(map, target, key, true);
        }
    }
    return dedupedNext;
}

function dedupeFeatureTargets(targets: FeatureStateTarget[]): FeatureStateTarget[] {
    const result: FeatureStateTarget[] = [];
    for (const target of targets) {
        if (!result.some((entry) => featureTargetsEqual(entry, target))) {
            result.push(target);
        }
    }
    return result;
}

type PickCityFeatureOptions = {
    logHoverFeatures: boolean;
    searchRadius: number;
    warnOnUnresolved: boolean;
    resolutionMode: "hover" | "click";
    debugResolution: boolean;
};

async function pickCityFeature(
    map: MapLibreMap,
    point: PointLike,
    interactiveLayerIds: string[],
    options: PickCityFeatureOptions
): Promise<CityFeatureHit | null> {
    if (!map.isStyleLoaded()) {
        return null;
    }
    if (!interactiveLayerIds.length) {
        return null;
    }
    const queryGeometry = buildQueryGeometry(point, options.searchRadius, map);
    const features = map.queryRenderedFeatures(queryGeometry, { layers: interactiveLayerIds });
    if (!features.length) {
        return null;
    }
    const polygonHits = queryPolygonCityHits(map, queryGeometry);
    if (options.logHoverFeatures && process.env.NODE_ENV === "development") {
        console.debug("[map-interaction] hover features", features.map((feature) => feature.layer?.id));
    }
    const lngLat = projectPoint(map, point);
    for (const feature of features) {
        const identity = extractCityIdentity(feature);
        if (!identity) {
            continue;
        }
        const layerId = feature.layer?.id;
        if (!layerId) {
            continue;
        }
        const resolvedCity = await resolveCityIdentity(feature, identity, {
            warnOnUnresolved: options.warnOnUnresolved,
            lngLat,
            polygonHits,
            resolutionMode: options.resolutionMode,
            debugResolution: options.debugResolution
        });
        const polygonTargets = collectPolygonTargetsForInsee(polygonHits, resolvedCity.inseeCode);
        return {
            city: resolvedCity,
            interactiveLayerId: layerId,
            labelLayerId: extractLabelLayerIdFromHitbox(layerId),
            featureStateTarget: createFeatureStateTarget(feature),
            lngLat,
            polygonTargets
        };
    }
    return null;
}

function buildQueryGeometry(
    point: PointLike,
    searchRadius: number,
    map: MapLibreMap
): QueryGeometry {
    if (!(typeof searchRadius === "number" && searchRadius > 0)) {
        return point;
    }
    const canvas = map.getCanvas();
    const { width, height } = canvas;
    const { x, y } = coercePoint(point);
    const minX = clamp(x - searchRadius, 0, width);
    const minY = clamp(y - searchRadius, 0, height);
    const maxX = clamp(x + searchRadius, 0, width);
    const maxY = clamp(y + searchRadius, 0, height);
    return [
        [minX, minY],
        [maxX, maxY]
    ];
}

async function resolveCityIdentity(
    feature: MapGeoJSONFeature,
    identity: CityIdentity,
    options: {
        warnOnUnresolved: boolean;
        lngLat: { lng: number; lat: number } | null;
        polygonHits: PolygonCityHit[];
        resolutionMode: "hover" | "click";
        debugResolution: boolean;
    }
): Promise<CityIdentity> {
    const location = options.lngLat ?? identity.location ?? null;
    if (identity.inseeCode) {
        return {
            ...identity,
            id: identity.inseeCode,
            resolutionMethod: identity.resolutionMethod ?? "feature",
            resolutionStatus: "resolved",
            location
        };
    }

    const viaPolygon = pickPolygonInsee(options.polygonHits);
    if (viaPolygon) {
        return {
            ...identity,
            id: viaPolygon,
            inseeCode: viaPolygon,
            resolutionMethod: "polygon",
            resolutionStatus: "resolved",
            location
        };
    }

    if (location && options.resolutionMode === "click") {
        try {
            const resolved = await resolveCommuneByClick({
                lng: location.lng,
                lat: location.lat,
                labelName: identity.name,
                debug: options.debugResolution
            });
            if (resolved) {
                return {
                    ...identity,
                    id: resolved.inseeCode,
                    inseeCode: resolved.inseeCode,
                    resolutionMethod: "position",
                    resolutionStatus: "resolved",
                    location
                };
            }
        } catch (error) {
            if (process.env.NODE_ENV === "development") {
                console.warn("[map-interaction] Label-aware INSEE resolution failed", error);
            }
        }
    }

    if (location) {
        try {
            const nearest = await resolveNearestCommuneInsee(location.lng, location.lat);
            if (nearest) {
                return {
                    ...identity,
                    id: nearest.inseeCode,
                    inseeCode: nearest.inseeCode,
                    resolutionMethod: "position",
                    resolutionStatus: "resolved",
                    location
                };
            }
        } catch (error) {
            if (process.env.NODE_ENV === "development") {
                console.warn("[map-interaction] Spatial INSEE resolution failed", error);
            }
        }
    }

    if (options.warnOnUnresolved) {
        logUnresolvedCityWarning(identity.name, {
            lngLat: options.lngLat
        });
    }

    return {
        ...identity,
        resolutionMethod: "fallback",
        resolutionStatus: "unresolved",
        unresolvedReason: "Unable to resolve INSEE from spatial index",
        location
    };
}

function readProperty(feature: MapGeoJSONFeature, fields: readonly string[]): string | null {
    const props = feature.properties ?? {};
    for (const field of fields) {
        const value = props[field];
        if (typeof value === "string" && value.length) {
            return value;
        }
        if (typeof value === "number" && Number.isFinite(value)) {
            return value.toString();
        }
    }
    return null;
}

function queryPolygonCityHits(map: MapLibreMap, geometry: QueryGeometry): PolygonCityHit[] {
    const layerIds = POLYGON_INTERACTION_CONFIGS
        .map((config) => config.layerId)
        .filter((layerId) => Boolean(map.getLayer(layerId)));
    if (!layerIds.length) {
        return [];
    }
    const features = map.queryRenderedFeatures(geometry, { layers: layerIds });
    return features.map((feature) => ({
        inseeCode: readProperty(feature, [FEATURE_FIELDS.inseeCode]),
        target: createFeatureStateTarget(feature),
        layerId: feature.layer?.id ?? null
    }));
}

function pickPolygonInsee(polygonHits: PolygonCityHit[]): string | null {
    for (const config of POLYGON_INTERACTION_CONFIGS) {
        const preferred = polygonHits.find((hit) => hit.layerId === config.layerId && Boolean(hit.inseeCode));
        if (preferred?.inseeCode) {
            return preferred.inseeCode;
        }
    }
    return polygonHits.find((hit) => Boolean(hit.inseeCode))?.inseeCode ?? null;
}

function collectPolygonTargetsForInsee(
    polygonHits: PolygonCityHit[],
    inseeCode: string | null | undefined
): FeatureStateTarget[] {
    if (!inseeCode) {
        return [];
    }
    return polygonHits
        .filter((hit) => hit.inseeCode === inseeCode && hit.target)
        .map((hit) => hit.target as FeatureStateTarget);
}

function coercePoint(point: PointLike): { x: number; y: number } {
    if (Array.isArray(point)) {
        return { x: point[0], y: point[1] };
    }
    if (typeof point === "object" && point) {
        const typed = point as { x?: number; y?: number; lng?: number; lat?: number };
        if (typeof typed.x === "number" && typeof typed.y === "number") {
            return { x: typed.x, y: typed.y };
        }
    }
    return { x: 0, y: 0 };
}

function projectPoint(map: MapLibreMap, point: PointLike): { lng: number; lat: number } | null {
    if (!Array.isArray(point) && typeof point === "object" && point && "lng" in point && "lat" in point) {
        const typed = point as { lng?: number; lat?: number };
        if (typeof typed.lng === "number" && typeof typed.lat === "number") {
            return { lng: typed.lng, lat: typed.lat };
        }
    }
    const { x, y } = coercePoint(point);
    try {
        const lngLat = map.unproject([x, y]);
        return { lng: lngLat.lng, lat: lngLat.lat };
    } catch {
        return null;
    }
}

function createFeatureStateTarget(feature: MapGeoJSONFeature): FeatureStateTarget | null {
    const source = typeof (feature as { source?: unknown }).source === "string"
        ? (feature as { source: string }).source
        : null;
    if (!source) {
        return null;
    }
    const id = feature.id ?? readPromotedId(feature, FEATURE_FIELDS.inseeCode);
    if (id === null || typeof id === "undefined") {
        return null;
    }
    const sourceLayer = (feature as { sourceLayer?: string }).sourceLayer;
    const result: FeatureStateTarget = { source, id };
    if (sourceLayer) {
        result.sourceLayer = sourceLayer;
    }
    return result;
}

function readPromotedId(feature: MapGeoJSONFeature, field?: string): string | number | null {
    if (!field) {
        return null;
    }
    const props = feature.properties ?? {};
    const value = props[field];
    if (typeof value === "string" && value.length) {
        return value;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    return null;
}

function logUnresolvedCityWarning(
    name: string,
    details: { lngLat: { lng: number; lat: number } | null }
): void {
    const key = buildUnresolvedWarningKey(name, details);
    if (unresolvedWarningKeys.has(key)) {
        return;
    }
    unresolvedWarningKeys.add(key);
    if (unresolvedWarningKeys.size > 1024) {
        unresolvedWarningKeys.clear();
    }
    console.warn("[map-interaction] Unable to resolve INSEE", {
        name,
        location: details.lngLat ?? "<unknown>"
    });
}

function buildUnresolvedWarningKey(
    name: string,
    details: { lngLat: { lng: number; lat: number } | null }
): string {
    if (details.lngLat) {
        const roundedLng = details.lngLat.lng.toFixed(3);
        const roundedLat = details.lngLat.lat.toFixed(3);
        return `coord:${roundedLng}:${roundedLat}`;
    }
    return `name:${name}`;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}
