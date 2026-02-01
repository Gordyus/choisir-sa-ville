import type {
    MapGeoJSONFeature,
    MapLayerMouseEvent,
    Map as MapLibreMap,
    MapMouseEvent,
    PointLike
} from "maplibre-gl";

import type { FeatureStateTarget } from "./cityHighlightLayers";
import { getInseeByOsmId, getInseeByWikidata } from "./cityInseeIndex";
import {
    extractLabelLayerIdFromInteractive,
    listCommuneInteractiveLayerIds
} from "./cityInteractiveLayer";
import { extractCityIdentity, type CityIdentity } from "./interactiveLayers";

const HOVER_THROTTLE_MS = 60;
const CLICK_HITBOX_PX = 8;
const unresolvedWarningKeys = new Set<string>();

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
    interactiveLayerIds?: string[];
};

export function attachCityInteractionService(
    map: MapLibreMap,
    listener: CityInteractionListener,
    options?: CityInteractionServiceOptions
): () => void {
    let lastHoverId: string | null = null;
    let lastMoveTs = 0;
    const logHoverFeatures = options?.logHoverFeatures ?? false;
    const interactiveLayerIds = resolveInteractiveLayerIds(map, options?.interactiveLayerIds);

    const handlePointerMove = (event: MapMouseEvent): void => {
        const now = performance.now();
        if (now - lastMoveTs < HOVER_THROTTLE_MS) {
            return;
        }
        lastMoveTs = now;
        publishHover(event.point);
    };

    const handleMouseLeave = (): void => {
        if (lastHoverId !== null) {
            lastHoverId = null;
            listener({ type: "leaveCity" });
        }
    };

    const handleClick = (event: MapLayerMouseEvent): void => {
        const hit = pickCityFeature(map, event.point, interactiveLayerIds, {
            logHoverFeatures,
            searchRadius: CLICK_HITBOX_PX,
            warnOnUnresolved: true
        });
        if (hit) {
            listener({
                type: "clickCity",
                city: hit.city,
                interactiveLayerId: hit.interactiveLayerId,
                labelLayerId: hit.labelLayerId,
                featureStateTarget: hit.featureStateTarget,
                lngLat: hit.lngLat
            });
        }
    };

    const publishHover = (point: PointLike): void => {
        const hit = pickCityFeature(map, point, interactiveLayerIds, {
            logHoverFeatures,
            searchRadius: 0,
            warnOnUnresolved: false
        });
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
    };

    map.on("mousemove", handlePointerMove);
    map.on("mouseleave", handleMouseLeave);
    map.on("click", handleClick);

    return () => {
        map.off("mousemove", handlePointerMove);
        map.off("mouseleave", handleMouseLeave);
        map.off("click", handleClick);
    };
}

type CityFeatureHit = {
    city: CityIdentity;
    interactiveLayerId: string;
    labelLayerId: string | null;
    featureStateTarget: FeatureStateTarget | null;
    lngLat: { lng: number; lat: number } | null;
};

type PickCityFeatureOptions = {
    logHoverFeatures: boolean;
    searchRadius: number;
    warnOnUnresolved: boolean;
};

function pickCityFeature(
    map: MapLibreMap,
    point: PointLike,
    interactiveLayerIds: string[],
    options: PickCityFeatureOptions
): CityFeatureHit | null {
    if (!map.isStyleLoaded()) {
        return null;
    }
    if (!interactiveLayerIds.length) {
        warnMissingInteractiveLayer();
        return null;
    }
    const queryGeometry = buildQueryGeometry(point, options.searchRadius, map);
    const features = map.queryRenderedFeatures(queryGeometry, { layers: interactiveLayerIds });
    if (!features.length) {
        return null;
    }
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
        const resolvedCity = resolveCityIdentity(feature, identity, {
            warnOnUnresolved: options.warnOnUnresolved,
            lngLat
        });
        return {
            city: resolvedCity,
            interactiveLayerId: layerId,
            labelLayerId: extractLabelLayerIdFromInteractive(layerId),
            featureStateTarget: createFeatureStateTarget(feature),
            lngLat
        };
    }
    return null;
}

let hasWarnedMissingInteractiveLayer = false;

function warnMissingInteractiveLayer(): void {
    if (hasWarnedMissingInteractiveLayer) {
        return;
    }
    console.warn("[map-interaction] Interactive commune layers are missing. Pointer events will be ignored.");
    hasWarnedMissingInteractiveLayer = true;
}

function resolveInteractiveLayerIds(map: MapLibreMap, explicit?: string[]): string[] {
    if (explicit?.length) {
        return [...new Set(explicit)];
    }
    return listCommuneInteractiveLayerIds(map);
}

function buildQueryGeometry(
    point: PointLike,
    searchRadius: number,
    map: MapLibreMap
): PointLike | [[number, number], [number, number]] {
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

function resolveCityIdentity(
    feature: MapGeoJSONFeature,
    identity: CityIdentity,
    options: { warnOnUnresolved: boolean; lngLat: { lng: number; lat: number } | null }
): CityIdentity {
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

    const osmId = identity.osmId ?? readProperty(feature, ["osm_id", "osmId"]);
    const wikidataId = identity.wikidataId ?? readProperty(feature, ["wikidata"]);

    const viaOsm = osmId ? getInseeByOsmId(osmId) : null;
    if (viaOsm) {
        return {
            ...identity,
            id: viaOsm,
            inseeCode: viaOsm,
            osmId: osmId ?? identity.osmId ?? null,
            wikidataId: wikidataId ?? identity.wikidataId ?? null,
            resolutionMethod: "osm",
            resolutionStatus: "resolved",
            location
        };
    }

    const viaWikidata = wikidataId ? getInseeByWikidata(wikidataId) : null;
    if (viaWikidata) {
        return {
            ...identity,
            id: viaWikidata,
            inseeCode: viaWikidata,
            osmId: osmId ?? identity.osmId ?? null,
            wikidataId: wikidataId ?? identity.wikidataId ?? null,
            resolutionMethod: "wikidata",
            resolutionStatus: "resolved",
            location
        };
    }

    if (options.warnOnUnresolved) {
        logUnresolvedCityWarning(identity.name, {
            osmId: osmId ?? null,
            wikidataId: wikidataId ?? null,
            lngLat: options.lngLat
        });
    }

    return {
        ...identity,
        osmId: osmId ?? identity.osmId ?? null,
        wikidataId: wikidataId ?? identity.wikidataId ?? null,
        resolutionMethod: "fallback",
        resolutionStatus: "unresolved",
        unresolvedReason: "Unable to resolve INSEE from mapping",
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
    const source = (feature as { source?: unknown }).source;
    if (typeof source !== "string") {
        return null;
    }
    const id = feature.id ?? null;
    if (id === null || typeof id === "undefined") {
        return null;
    }
    const sourceLayer = (feature as { sourceLayer?: string }).sourceLayer;
    return {
        source,
        id,
        sourceLayer: sourceLayer ?? undefined
    };
}

function logUnresolvedCityWarning(
    name: string,
    details: { osmId: string | null; wikidataId: string | null; lngLat: { lng: number; lat: number } | null }
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
        osmId: details.osmId ?? "<none>",
        wikidata: details.wikidataId ?? "<none>",
        location: details.lngLat ?? "<unknown>"
    });
}

function buildUnresolvedWarningKey(
    name: string,
    details: { osmId: string | null; wikidataId: string | null; lngLat: { lng: number; lat: number } | null }
): string {
    if (details.osmId) {
        return `osm:${details.osmId}`;
    }
    if (details.wikidataId) {
        return `wikidata:${details.wikidataId}`;
    }
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
