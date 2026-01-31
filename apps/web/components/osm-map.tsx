"use client";

import type { LatLngBounds, Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import { useCallback, useEffect, useRef } from "react";

import { loadAppConfig } from "@/lib/config/appConfig";
import { loadCommunesIndexLite, type CommunesIndexLite } from "@/lib/map/communesIndexLite";
import { loadInfraZonesIndexLite, type InfraZonesIndexLite } from "@/lib/map/infraZonesIndexLite";
import { createLeafletMarkerLayer, type MarkerLayerHandle } from "@/lib/map/leafletMarkerLayer";
import { selectMarkers, type Bounds, type MarkerSelectionResult } from "@/lib/map/markerSelection";
import { cn } from "@/lib/utils";

type PendingRequest = {
    timer: ReturnType<typeof setTimeout> | null;
    controller: AbortController | null;
    lastSignature: string | null;
};

type DatasetBundle = {
    communes: CommunesIndexLite;
    infra: InfraZonesIndexLite;
};

interface DebugSnapshot {
    zoom: number;
    communesCount: number;
    infraCount: number;
}

interface OsmMapProps {
    className?: string;
    onDebugChange?: ((snapshot: DebugSnapshot) => void) | undefined;
}

export default function OsmMap({ className, onDebugChange }: OsmMapProps): JSX.Element {
    const mapElRef = useRef<HTMLDivElement | null>(null);
    const mapInstanceRef = useRef<LeafletMap | null>(null);
    const markerLayerRef = useRef<MarkerLayerHandle | null>(null);
    const pendingRef = useRef<PendingRequest>({ timer: null, controller: null, lastSignature: null });
    const lastDebugRef = useRef<DebugSnapshot | null>(null);
    const previousSelectionRef = useRef<MarkerSelectionResult | null>(null);

    const runViewportUpdate = useCallback(async (signature: string, controller: AbortController): Promise<void> => {
        try {
            const map = mapInstanceRef.current;
            if (!map) return;

            const [dataset, appConfig] = await Promise.all([
                loadDatasetBundle(controller.signal),
                loadAppConfig(controller.signal)
            ]);
            if (controller.signal.aborted) return;

            const bounds = map.getBounds();
            const selection = selectMarkers({
                communes: dataset.communes,
                infra: dataset.infra,
                zoom: map.getZoom(),
                zoomRules: appConfig.mapMarkers.zoomRules,
                worldGrid: appConfig.mapMarkers.worldGrid,
                hysteresis: appConfig.mapMarkers.hysteresis,
                previous: previousSelectionRef.current,
                bounds: toBounds(bounds),
                project: (lat, lng) => {
                    const point = map.latLngToContainerPoint([lat, lng]);
                    return { x: point.x, y: point.y };
                },
                mapSize: (() => {
                    const size = map.getSize();
                    return { width: size.x, height: size.y };
                })()
            });
            if (controller.signal.aborted) return;

            if (!markerLayerRef.current) {
                markerLayerRef.current = createLeafletMarkerLayer(map);
            }
            markerLayerRef.current.updateMarkers(selection);
            pendingRef.current.lastSignature = signature;
            previousSelectionRef.current = selection;

            if (onDebugChange) {
                const nextDebug: DebugSnapshot = {
                    zoom: map.getZoom(),
                    communesCount: selection.communes.length,
                    infraCount: selection.infra.length
                };
                const prev = lastDebugRef.current;
                if (
                    !prev ||
                    prev.zoom !== nextDebug.zoom ||
                    prev.communesCount !== nextDebug.communesCount ||
                    prev.infraCount !== nextDebug.infraCount
                ) {
                    lastDebugRef.current = nextDebug;
                    onDebugChange(nextDebug);
                }
            }
        } catch (error) {
            if (!(error instanceof DOMException && error.name === "AbortError")) {
                console.error("[map] Failed to update markers", error);
            }
        }
    }, []);

    useEffect(() => {
        let isMounted = true;

        async function bootstrapMap(): Promise<void> {
            if (!mapElRef.current || mapInstanceRef.current || !isMounted) {
                return;
            }

            const leafletModule = await import("leaflet");
            const L = leafletModule.default ?? leafletModule;

            const container = mapElRef.current as HTMLDivElement & { _leaflet_id?: unknown };
            if (container._leaflet_id) {
                delete container._leaflet_id;
            }

            const franceCenter: [number, number] = [46.7111, 1.7191];
            const map = L.map(mapElRef.current, {
                zoomControl: true,
                preferCanvas: true
            }).setView(franceCenter, 6);

            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                attribution:
                    "Données © <a href=\"https://www.openstreetmap.org/\" target=\"_blank\" rel=\"noreferrer\">OpenStreetMap</a>",
                maxZoom: 18,
                minZoom: 4
            }).addTo(map);

            mapInstanceRef.current = map;

            const scheduleViewportSync = (): void => {
                if (!mapInstanceRef.current) {
                    return;
                }

                const signature = buildViewportSignature(mapInstanceRef.current);
                if (signature === pendingRef.current.lastSignature) {
                    return;
                }

                if (pendingRef.current.timer) {
                    clearTimeout(pendingRef.current.timer);
                    pendingRef.current.timer = null;
                }

                if (pendingRef.current.controller) {
                    pendingRef.current.controller.abort();
                    pendingRef.current.controller = null;
                }

                const controller = new AbortController();
                pendingRef.current.controller = controller;

                pendingRef.current.timer = setTimeout(() => {
                    pendingRef.current.timer = null;
                    void runViewportUpdate(signature, controller).finally(() => {
                        if (pendingRef.current.controller === controller) {
                            pendingRef.current.controller = null;
                        }
                    });
                }, 220);
            };

            map.on("moveend", scheduleViewportSync);
            map.on("zoomend", scheduleViewportSync);
            map.whenReady(() => scheduleViewportSync());
        }

        bootstrapMap();

        return () => {
            isMounted = false;
            if (pendingRef.current.timer) {
                clearTimeout(pendingRef.current.timer);
            }
            pendingRef.current.controller?.abort();
            pendingRef.current.timer = null;
            pendingRef.current.controller = null;
            pendingRef.current.lastSignature = null;
            lastDebugRef.current = null;

            markerLayerRef.current?.destroy();
            markerLayerRef.current = null;

            if (mapInstanceRef.current) {
                mapInstanceRef.current.off();
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }

            const container = mapElRef.current as (HTMLDivElement & { _leaflet_id?: unknown }) | null;
            if (container?._leaflet_id) {
                delete container._leaflet_id;
            }
        };
    }, [runViewportUpdate]);

    return <div ref={mapElRef} className={cn("h-full w-full", className)} />;

    function toBounds(bounds: LatLngBounds): Bounds {
        return {
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            west: bounds.getWest()
        };
    }

    function buildViewportSignature(map: LeafletMap): string {
        return `${map.getZoom()}|${map.getBounds().toBBoxString()}`;
    }
}

async function loadDatasetBundle(signal?: AbortSignal): Promise<DatasetBundle> {
    const [communes, infra] = await Promise.all([
        loadCommunesIndexLite(signal),
        loadInfraZonesIndexLite(signal)
    ]);
    return { communes, infra };
}
