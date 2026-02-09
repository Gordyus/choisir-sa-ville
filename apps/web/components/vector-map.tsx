"use client";

/**
 * Vector Map Component
 *
 * Displays the interactive map with city labels.
 * Does NOT manage selection state - delegates to EntityStateService.
 *
 * ARCHITECTURE:
 * - Map interactions -> mapInteractionService -> EntityStateService
 * - Entity graphics binding -> entityGraphicsBinder -> setFeatureState
 * - This component only handles map rendering and cleanup
 * - No onSelect prop - consumers use useSelection() hook
 */

import "maplibre-gl/dist/maplibre-gl.css";

import maplibregl, { Map as MapLibreMap, NavigationControl } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

import { MapDebugOverlay } from "@/components/map-debug-overlay";
import { MapLayerMenu } from "@/components/map-layer-menu";
import { loadAppConfig, type AppConfig } from "@/lib/config/appConfig";
import { attachEntityGraphicsBinder } from "@/lib/map/entityGraphicsBinder";
import { getCommuneLabelsVectorLayerId } from "@/lib/map/layers/communeLabelsVector";
import { attachMapInteractionService } from "@/lib/map/mapInteractionService";
import { attachDisplayBinder } from "@/lib/map/state/displayBinder";
import { loadMapStyle } from "@/lib/map/style/stylePipeline";
import { cn } from "@/lib/utils";

// ============================================================================
// Constants
// ============================================================================

const INITIAL_CENTER: [number, number] = [2.2137, 46.2276];
const INITIAL_ZOOM = 5;

// ============================================================================
// Types
// ============================================================================

interface VectorMapProps {
    className?: string;
}

// ============================================================================
// Component
// ============================================================================

export default function VectorMap({ className }: VectorMapProps): JSX.Element {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<MapLibreMap | null>(null);
    const detachInteractionsRef = useRef<(() => void) | null>(null);
    const detachBinderRef = useRef<(() => void) | null>(null);
    const detachDisplayBinderRef = useRef<(() => void) | null>(null);
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

                // Debug access in development
                if (process.env.NODE_ENV === "development") {
                    (window as unknown as { map?: MapLibreMap }).map = map;
                }

                // Apply debug settings
                if (appConfig.debug.enabled) {
                    (map as unknown as { showTileBoundaries?: boolean }).showTileBoundaries =
                        appConfig.debug.showTileBoundaries;
                    (map as unknown as { showCollisionBoxes?: boolean }).showCollisionBoxes =
                        appConfig.debug.showCollisionBoxes;
                }

                // Add controls
                map.addControl(new NavigationControl({ visualizePitch: true }), "top-right");
                map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

                // Debug zoom tracking
                const handleZoomChange = (): void => {
                    setDebugZoom(Number(map.getZoom().toFixed(2)));
                };
                handleZoomChange();
                map.on("zoomend", handleZoomChange);
                debugZoomCleanupRef.current = () => {
                    map.off("zoomend", handleZoomChange);
                };

                // Setup interactions once map is loaded
                map.once("load", () => {
                    setupInteractions(map, appConfig);
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

            // Attach interaction service - handles user interactions and EntityStateService updates
            // Use our custom commune labels layer instead of OSM labels
            const interactionResult = attachMapInteractionService(map, {
                debug,
                labelLayerId: getCommuneLabelsVectorLayerId()
            });
            detachInteractionsRef.current = interactionResult.cleanup;

            // Attach graphics binder - handles setFeatureState for highlight/active on labels and polygons
            detachBinderRef.current = attachEntityGraphicsBinder(map, {
                getLabelTargetForEntity: interactionResult.getLabelTargetForEntity
            });

            // Attach display binder - handles choropleth mode switching
            detachDisplayBinderRef.current = attachDisplayBinder(map);
        }

        void initMap();

        return () => {
            disposed = true;
            controller.abort();
            detachDisplayBinderRef.current?.();
            detachDisplayBinderRef.current = null;
            detachBinderRef.current?.();
            detachBinderRef.current = null;
            detachInteractionsRef.current?.();
            detachInteractionsRef.current = null;
            debugZoomCleanupRef.current?.();
            debugZoomCleanupRef.current = null;
            setDebugZoom(null);
            setDebugOverlayEnabled(false);
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, []);

    return (
        <div className={cn("relative h-full w-full", className)}>
            <div ref={containerRef} className="h-full w-full" />
            <MapLayerMenu />
            {debugOverlayEnabled && <MapDebugOverlay zoom={debugZoom} />}
        </div>
    );
}

// ============================================================================
// Debug Helpers
// ============================================================================

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
