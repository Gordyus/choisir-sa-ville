"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import maplibregl, { Map as MapLibreMap, NavigationControl } from "maplibre-gl";
import { useEffect, useRef } from "react";

import { loadAppConfig } from "@/lib/config/appConfig";
import {
    ensureCityHighlightLayer,
    removeCityHighlightLayer,
    setHoveredCity,
    type CityHighlightHandle
} from "@/lib/map/cityHighlightLayers";
import { ensureCommuneInteractiveLayers, listCommuneInteractiveLayerIds } from "@/lib/map/cityInteractiveLayer";
import { debugLogSymbolLabelHints, type CityIdentity } from "@/lib/map/interactiveLayers";
import { attachCityInteractionService } from "@/lib/map/mapInteractionService";
import { loadVectorMapStyle } from "@/lib/map/mapStyle";
import { cn } from "@/lib/utils";

const INITIAL_CENTER: [number, number] = [2.2137, 46.2276];
const INITIAL_ZOOM = 5;

interface VectorMapProps {
    className?: string;
    onCityClick?: (city: CityIdentity) => void;
}

export default function VectorMap({ className, onCityClick }: VectorMapProps): JSX.Element {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<MapLibreMap | null>(null);
    const detachInteractionsRef = useRef<(() => void) | null>(null);
    const detachDebugRef = useRef<(() => void) | null>(null);
    const selectedCityRef = useRef<string | null>(null);
    const highlightHandleRef = useRef<CityHighlightHandle | null>(null);
    const interactiveLayerIdsRef = useRef<string[]>([]);

    useEffect(() => {
        let disposed = false;
        const controller = new AbortController();

        async function initMap(): Promise<void> {
            if (!containerRef.current || mapRef.current) {
                return;
            }

            try {
                const appConfig = await loadAppConfig(controller.signal);
                const style = await loadVectorMapStyle(appConfig.mapTiles, controller.signal);
                if (appConfig.debug.enabled && appConfig.debug.logStyleHints) {
                    debugLogSymbolLabelHints(style);
                }
                if (disposed || !containerRef.current) {
                    return;
                }

                const map = new maplibregl.Map({
                    container: containerRef.current,
                    style,
                    center: INITIAL_CENTER,
                    zoom: INITIAL_ZOOM,
                    attributionControl: false,
                    hash: false
                });

                mapRef.current = map;
                if (process.env.NODE_ENV === "development")
                    (window as any).__MAP__ = map
                if (appConfig.debug.enabled) {
                    (map as unknown as { showTileBoundaries?: boolean }).showTileBoundaries =
                        appConfig.debug.showTileBoundaries;
                    (map as unknown as { showCollisionBoxes?: boolean }).showCollisionBoxes =
                        appConfig.debug.showCollisionBoxes;
                }
                map.addControl(new NavigationControl({ visualizePitch: true }), "top-right");
                map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

                map.once("load", () => {
                    if (appConfig.debug.enabled && appConfig.debug.logStyleHints) {
                        logStyleLayerCatalog(map);
                    }

                    const interactiveLayerHandle = ensureCommuneInteractiveLayers(map);
                    interactiveLayerIdsRef.current = interactiveLayerHandle?.layerIds ?? [];
                    if (!interactiveLayerHandle || interactiveLayerIdsRef.current.length === 0) {
                        console.warn(
                            "[vector-map] Commune interactive layers unavailable; pointer interactions will be disabled."
                        );
                    }
                    const highlightHandle = ensureCityHighlightLayer(map, {
                        logStyleHints: appConfig.debug.enabled && appConfig.debug.logStyleHints
                    });
                    highlightHandleRef.current = highlightHandle;
                    if (!highlightHandle) {
                        console.warn("[vector-map] City highlight layer unavailable; hover highlight disabled.");
                    }
                    detachInteractionsRef.current = attachCityInteractionService(map, (event) => {
                        const handle = highlightHandleRef.current;
                        switch (event.type) {
                            case "hoverCity":
                                if (handle) {
                                    setHoveredCity(map, handle, event.city.id, {
                                        labelLayerId: event.labelLayerId
                                    });
                                }
                                break;
                            case "leaveCity":
                                if (handle) {
                                    setHoveredCity(map, handle, null);
                                }
                                break;
                            case "clickCity":
                                selectedCityRef.current = event.city.id;
                                onCityClick?.(event.city);
                                break;
                        }
                    }, {
                        logHoverFeatures: appConfig.debug.enabled && appConfig.debug.logHoverFeatures,
                        interactiveLayerIds: interactiveLayerIdsRef.current
                    });

                    if (appConfig.debug.enabled && appConfig.debug.logHoverFeatures) {
                        detachDebugRef.current = attachInteractiveLayerDebug(map);
                    }
                });
            } catch (error) {
                if (!(error instanceof DOMException && error.name === "AbortError")) {
                    console.error("[vector-map] Failed to initialize MapLibre map", error);
                }
            }
        }

        void initMap();

        return () => {
            disposed = true;
            controller.abort();
            detachInteractionsRef.current?.();
            detachInteractionsRef.current = null;
            detachDebugRef.current?.();
            detachDebugRef.current = null;
            highlightHandleRef.current = null;
            if (mapRef.current) {
                removeCityHighlightLayer(mapRef.current);
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, []);

    return <div ref={containerRef} className={cn("h-full w-full", className)} />;
}

function logStyleLayerCatalog(map: MapLibreMap): void {
    const style = map.getStyle();
    const layers = style?.layers ?? [];

    console.log("[map-debug] style layers", {
        count: layers.length,
        ids: layers.map((layer) => layer.id)
    });

    const symbolTextLayers = layers
        .filter((layer) => layer.type === "symbol")
        .map((layer) => {
            const layout = (layer as { layout?: Record<string, unknown> }).layout;
            const sourceLayer = (layer as { "source-layer"?: string })["source-layer"];
            return {
                id: layer.id,
                source: (layer as { source?: unknown }).source,
                sourceLayer: sourceLayer ?? null,
                hasTextField: typeof layout?.["text-field"] !== "undefined"
            };
        })
        .filter((layer) => layer.hasTextField);


    console.log("[map-debug] symbol text layers", symbolTextLayers);
}

function attachInteractiveLayerDebug(map: MapLibreMap): () => void {
    const logSnapshot = (reason: string): void => {
        if (!map.isStyleLoaded()) {
            return;
        }
        const interactiveLayerIds = listCommuneInteractiveLayerIds(map);
        const canvas = map.getCanvas();
        const bbox: [[number, number], [number, number]] = [
            [0, 0],
            [canvas.width, canvas.height]
        ];

        const features = interactiveLayerIds.length
            ? map.queryRenderedFeatures(bbox, { layers: interactiveLayerIds })
            : [];
        const sample = features.slice(0, 8).map((feature) => ({
            layerId: feature.layer?.id ?? "<unknown>",
            properties: feature.properties ?? {}
        }));

        console.log("[map-debug] commune interactive snapshot", {
            reason,
            zoom: map.getZoom(),
            interactiveLayerCount: interactiveLayerIds.length,
            featureCount: features.length,
            sample
        });
    };

    const handleZoomEnd = (): void => logSnapshot("zoomend");
    logSnapshot("load");
    map.on("zoomend", handleZoomEnd);

    return () => {
        map.off("zoomend", handleZoomEnd);
    };
}
