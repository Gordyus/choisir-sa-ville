import type { MapLayerMouseEvent, Map as MapLibreMap, MapMouseEvent, PointLike } from "maplibre-gl";

import { CITY_INTERACTIVE_LAYER_ID } from "./cityInteractiveLayer";
import { extractCityIdentity, type CityIdentity } from "./interactiveLayers";

const HOVER_THROTTLE_MS = 60;

type CityInteractionEvent =
    | { type: "hoverCity"; city: CityIdentity }
    | { type: "leaveCity" }
    | { type: "clickCity"; city: CityIdentity };

type CityInteractionListener = (event: CityInteractionEvent) => void;

export type CityInteractionServiceOptions = {
    logHoverFeatures?: boolean;
};

export function attachCityInteractionService(
    map: MapLibreMap,
    listener: CityInteractionListener,
    options?: CityInteractionServiceOptions
): () => void {
    let lastHoverId: string | null = null;
    let lastMoveTs = 0;
    const logHoverFeatures = options?.logHoverFeatures ?? false;

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
        const city = pickCityIdentity(map, event.point, logHoverFeatures);
        if (city) {
            listener({ type: "clickCity", city });
        }
    };

    const publishHover = (point: PointLike): void => {
        const city = pickCityIdentity(map, point, logHoverFeatures);
        const nextId = city?.id ?? null;
        if (nextId === lastHoverId) {
            return;
        }
        lastHoverId = nextId;
        if (city) {
            listener({ type: "hoverCity", city });
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

function pickCityIdentity(map: MapLibreMap, point: PointLike, logHoverFeatures: boolean): CityIdentity | null {
    if (!map.isStyleLoaded()) {
        return null;
    }
    if (!map.getLayer(CITY_INTERACTIVE_LAYER_ID)) {
        warnMissingInteractiveLayer();
        return null;
    }
    const features = map.queryRenderedFeatures(point, { layers: [CITY_INTERACTIVE_LAYER_ID] });
    if (!features.length) {
        return null;
    }
    if (logHoverFeatures && process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        console.debug("[map-interaction] hover features", features);
    }
    for (const feature of features) {
        const identity = extractCityIdentity(feature);
        if (identity) {
            return identity;
        }
    }
    return null;
}

let hasWarnedMissingInteractiveLayer = false;

function warnMissingInteractiveLayer(): void {
    if (hasWarnedMissingInteractiveLayer) {
        return;
    }
    console.warn("[map-interaction] Interactive city layer is missing. Pointer events will be ignored.");
    hasWarnedMissingInteractiveLayer = true;
}
