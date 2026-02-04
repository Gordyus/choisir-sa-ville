"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import maplibregl, { Map as MapLibreMap, NavigationControl } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

import { MapDebugOverlay } from "@/components/map-debug-overlay";
import { loadAppConfig, type AppConfig } from "@/lib/config/appConfig";
import {
    ensureCityHighlightLayer,
    removeCityHighlightLayer,
    setHoveredCity,
    setSelectedCity,
    type CityHighlightHandle
} from "@/lib/map/cityHighlightLayers";
import { debugLogSymbolLabelHints } from "@/lib/map/interactiveLayers";
import { attachMapInteractionService } from "@/lib/map/mapInteractionService";
import type { MapSelection } from "@/lib/map/mapSelection";
import { loadMapStyle } from "@/lib/map/style/stylePipeline";
import { cn } from "@/lib/utils";

const INITIAL_CENTER: [number, number] = [2.2137, 46.2276];
const INITIAL_ZOOM = 5;

interface VectorMapProps {
    className?: string;
    onSelect?: (selection: MapSelection) => void;
}

export default function VectorMap({ className, onSelect }: VectorMapProps): JSX.Element {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<MapLibreMap | null>(null);
    const detachInteractionsRef = useRef<(() => void) | null>(null);
    const highlightHandleRef = useRef<CityHighlightHandle | null>(null);
    const debugZoomCleanupRef = useRef<(() => void) | null>(null);
    const [debugZoom, setDebugZoom] = useState<number | null>(null);
    const [debugOverlayEnabled, setDebugOverlayEnabled] = useState(false);

    useEffect(() => {
        let disposed = false;
        const controller = new AbortController();

        async function initMap(): Promise<void> {
            if (!containerRef.current || mapRef.current) {
                return;
            }

            try {
                const appConfig = await loadAppConfig(controller.signal);
                const style = await loadMapStyle(appConfig.mapTiles, controller.signal);
                if (appConfig.debug.enabled && appConfig.debug.logStyleHints) {
                    debugLogSymbolLabelHints(style);
                }
                if (disposed || !containerRef.current) {
                    return;
                }

                setDebugOverlayEnabled(appConfig.debug.enabled ?? false);

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
                    (window as any).map = map
                if (appConfig.debug.enabled) {
                    (map as unknown as { showTileBoundaries?: boolean }).showTileBoundaries =
                        appConfig.debug.showTileBoundaries;
                    (map as unknown as { showCollisionBoxes?: boolean }).showCollisionBoxes =
                        appConfig.debug.showCollisionBoxes;
                }
                map.addControl(new NavigationControl({ visualizePitch: true }), "top-right");
                map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

                const handleZoomChange = (): void => {
                    setDebugZoom(Number(map.getZoom().toFixed(2)));
                };
                handleZoomChange();
                map.on("zoomend", handleZoomChange);
                debugZoomCleanupRef.current = () => {
                    map.off("zoomend", handleZoomChange);
                };

                map.once("load", () => {
                    void setupInteractions(map, appConfig);
                });
            } catch (error) {
                if (!(error instanceof DOMException && error.name === "AbortError")) {
                    console.error("[vector-map] Failed to initialize MapLibre map", error);
                }
            }
        }

        function setupInteractions(map: MapLibreMap, appConfig: AppConfig): void {
            const debug = appConfig.debug.enabled ?? false;
            if (debug && appConfig.debug.logStyleHints) {
                logStyleLayerCatalog(map);
            }

            const highlightHandle = ensureCityHighlightLayer(map);
            highlightHandleRef.current = highlightHandle;
            if (!highlightHandle) {
                console.warn("[vector-map] City highlight layer unavailable; hover highlight disabled.");
            }

            detachInteractionsRef.current = attachMapInteractionService(map, (event) => {
                const handle = highlightHandleRef.current;
                switch (event.type) {
                    case "hover":
                        if (handle) {
                            setHoveredCity(map, handle, event.featureStateTarget);
                        }
                        break;
                    case "hoverLeave":
                        if (handle) {
                            setHoveredCity(map, handle, null);
                        }
                        break;
                    case "select":
                        if (handle) {
                            setSelectedCity(map, handle, event.featureStateTarget);
                        }
                        onSelect?.(event.selection);
                        break;
                    case "selectClear":
                        if (handle) {
                            setSelectedCity(map, handle, null);
                        }
                        break;
                }
            }, { debug });
        }

        void initMap();

        return () => {
            disposed = true;
            controller.abort();
            detachInteractionsRef.current?.();
            detachInteractionsRef.current = null;
            debugZoomCleanupRef.current?.();
            debugZoomCleanupRef.current = null;
            setDebugZoom(null);
            setDebugOverlayEnabled(false);
            highlightHandleRef.current = null;
            if (mapRef.current) {
                removeCityHighlightLayer(mapRef.current);
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, []);

    return (
        <div className={cn("relative h-full w-full", className)}>
            <div ref={containerRef} className="h-full w-full" />
            {debugOverlayEnabled && <MapDebugOverlay zoom={debugZoom} />}
        </div>
    );
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
