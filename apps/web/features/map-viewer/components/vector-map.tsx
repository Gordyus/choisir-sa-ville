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
 * - URL synchronization: viewport (center + zoom) synced with ?view= query param
 */

import "maplibre-gl/dist/maplibre-gl.css";

import maplibregl, { Map as MapLibreMap, NavigationControl } from "maplibre-gl";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { MapDebugOverlay } from "@/features/map-viewer/components/map-debug-overlay";
import { MapLayerMenu } from "@/features/map-viewer/components/map-layer-menu";
import { loadAppConfig, type AppConfig } from "@/lib/config/appConfig";
import { attachEntityGraphicsBinder } from "@/lib/map/entityGraphicsBinder";
import { getArrMunicipalLabelsVectorLayerId } from "@/lib/map/layers/arrMunicipalLabelsVector";
import { getCommuneLabelsVectorLayerId } from "@/lib/map/layers/communeLabelsVector";
import { attachMapInteractionService } from "@/lib/map/mapInteractionService";
import { attachDisplayBinder } from "@/lib/map/state/displayBinder";
import { loadMapStyle } from "@/lib/map/style/stylePipeline";
import { addTransactionLayer } from "@/lib/map/transactionLayer";
import { formatViewForURL, parseViewFromURL } from "@/lib/map/urlState";
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
    const searchParams = useSearchParams();
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<MapLibreMap | null>(null);
    const detachInteractionsRef = useRef<(() => void) | null>(null);
    const detachBinderRef = useRef<(() => void) | null>(null);
    const detachDisplayBinderRef = useRef<(() => void) | null>(null);
    const detachTransactionLayerRef = useRef<(() => void) | null>(null);
    const debugZoomCleanupRef = useRef<(() => void) | null>(null);
    const urlSyncCleanupRef = useRef<(() => void) | null>(null);
    const initializedRef = useRef(false);
    const [debugZoom, setDebugZoom] = useState<number | null>(null);
    const [debugOverlayEnabled, setDebugOverlayEnabled] = useState(false);

    // Parse URL state once at component mount to avoid re-parsing on URL changes
    const initialViewState = useRef(parseViewFromURL(searchParams));

    useEffect(() => {
        let disposed = false;
        const controller = new AbortController();

        async function initMap(): Promise<void> {
            // Only initialize once - do not reinitialize on URL changes
            if (!containerRef.current || mapRef.current || initializedRef.current) {
                return;
            }

            initializedRef.current = true;

            try {
                const appConfig = await loadAppConfig(controller.signal);
                const style = await loadMapStyle(appConfig.mapTiles, controller.signal);

                if (disposed || !containerRef.current) {
                    return;
                }

                setDebugOverlayEnabled(appConfig.debug.enabled ?? false);

                // Use initial view state parsed at component mount
                const initialCenter = initialViewState.current?.center ?? INITIAL_CENTER;
                const initialZoom = initialViewState.current?.zoom ?? INITIAL_ZOOM;

                const map = new maplibregl.Map({
                    container: containerRef.current,
                    style,
                    center: initialCenter,
                    zoom: initialZoom,
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

                // URL synchronization - update URL on viewport changes
                const handleViewChange = (): void => {
                    const center = map.getCenter();
                    const zoom = map.getZoom();
                    const viewParam = formatViewForURL([center.lng, center.lat], zoom);
                    const newUrl = `${window.location.pathname}?${viewParam}`;
                    window.history.replaceState(null, "", newUrl);
                };
                map.on("moveend", handleViewChange);
                map.on("zoomend", handleViewChange);
                urlSyncCleanupRef.current = () => {
                    map.off("moveend", handleViewChange);
                    map.off("zoomend", handleViewChange);
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

            const communeLabelsLayerId = getCommuneLabelsVectorLayerId();

            // Attach interaction service - handles user interactions and EntityStateService updates
            const interactionResult = attachMapInteractionService(map, {
                debug,
                labelLayerId: communeLabelsLayerId,
                additionalLabelLayerIds: [getArrMunicipalLabelsVectorLayerId()]
            });
            detachInteractionsRef.current = interactionResult.cleanup;

            // Attach graphics binder - handles setFeatureState for highlight/active on labels and polygons
            detachBinderRef.current = attachEntityGraphicsBinder(map, {
                getLabelTargetForEntity: interactionResult.getLabelTargetForEntity
            });

            // Attach display binder - handles choropleth mode switching
            detachDisplayBinderRef.current = attachDisplayBinder(map);

            // Add transaction addresses layer (async, non-blocking)
            void addTransactionLayer(map, controller.signal).then((cleanup) => {
                if (!disposed) {
                    detachTransactionLayerRef.current = cleanup;
                } else {
                    cleanup();
                }
            });
        }

        void initMap();

        return () => {
            disposed = true;
            controller.abort();
            urlSyncCleanupRef.current?.();
            urlSyncCleanupRef.current = null;
            detachTransactionLayerRef.current?.();
            detachTransactionLayerRef.current = null;
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
