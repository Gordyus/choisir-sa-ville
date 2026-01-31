"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import maplibregl, { Map as MapLibreMap, NavigationControl } from "maplibre-gl";
import { useEffect, useRef } from "react";

import { loadAppConfig } from "@/lib/config/appConfig";
import { loadVectorMapStyle } from "@/lib/map/mapStyle";
import { cn } from "@/lib/utils";

const INITIAL_CENTER: [number, number] = [2.2137, 46.2276];
const INITIAL_ZOOM = 5;

interface VectorMapProps {
    className?: string;
}

export default function VectorMap({ className }: VectorMapProps): JSX.Element {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<MapLibreMap | null>(null);

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
                map.addControl(new NavigationControl({ visualizePitch: true }), "top-right");
                map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

                const handleViewportSettled = (): void => {
                    /* placeholder: hook for future marker/overlay sync */
                };

                map.on("moveend", handleViewportSettled);
                map.on("zoomend", handleViewportSettled);
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
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, []);

    return <div ref={containerRef} className={cn("h-full w-full", className)} />;
}
