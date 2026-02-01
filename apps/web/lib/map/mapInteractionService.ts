import type { MapLayerMouseEvent, Map as MapLibreMap, MapMouseEvent, PointLike } from "maplibre-gl";

import {
    extractLabelLayerIdFromInteractive,
    listCommuneInteractiveLayerIds
} from "./cityInteractiveLayer";
import { extractCityIdentity, type CityIdentity } from "./interactiveLayers";

const HOVER_THROTTLE_MS = 60;

type CityInteractionEvent =
    | { type: "hoverCity"; city: CityIdentity; interactiveLayerId: string; labelLayerId: string | null }
    | { type: "leaveCity" }
    | { type: "clickCity"; city: CityIdentity; interactiveLayerId: string; labelLayerId: string | null };

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
        const hit = pickCityFeature(map, event.point, interactiveLayerIds, logHoverFeatures);
        if (hit) {
            listener({
                type: "clickCity",
                city: hit.city,
                interactiveLayerId: hit.interactiveLayerId,
                labelLayerId: hit.labelLayerId
            });
        }
    };

    const publishHover = (point: PointLike): void => {
        const hit = pickCityFeature(map, point, interactiveLayerIds, logHoverFeatures);
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
                labelLayerId: hit.labelLayerId
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
};

function pickCityFeature(
    map: MapLibreMap,
    point: PointLike,
    interactiveLayerIds: string[],
    logHoverFeatures: boolean
): CityFeatureHit | null {
    if (!map.isStyleLoaded()) {
        return null;
    }
    if (!interactiveLayerIds.length) {
        warnMissingInteractiveLayer();
        return null;
    }
    const features = map.queryRenderedFeatures(point, { layers: interactiveLayerIds });
    console.debug(...features)
    if (!features.length) {
        return null;
    }
    if (logHoverFeatures && process.env.NODE_ENV === "development") {

        console.debug("[map-interaction] hover features", features.map((feature) => feature.layer?.id));
    }
    for (const feature of features) {
        const identity = extractCityIdentity(feature);
        if (!identity) {
            continue;
        }
        const layerId = feature.layer?.id;
        if (!layerId) {
            continue;
        }
        return {
            city: identity,
            interactiveLayerId: layerId,
            labelLayerId: extractLabelLayerIdFromInteractive(layerId)
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
