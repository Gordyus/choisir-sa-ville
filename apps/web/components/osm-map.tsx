"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";

import { cn } from "@/lib/utils";

type PendingRequest = {
  timer: ReturnType<typeof setTimeout> | null;
  controller: AbortController | null;
  lastSignature: string | null;
};

interface OsmMapProps {
  className?: string;
}

export default function OsmMap({ className }: OsmMapProps): JSX.Element {
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const pendingRef = useRef<PendingRequest>({ timer: null, controller: null, lastSignature: null });

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
        preferCanvas: false
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

        if (pendingRef.current.timer) {
          clearTimeout(pendingRef.current.timer);
          pendingRef.current.timer = null;
        }

        if (pendingRef.current.controller) {
          pendingRef.current.controller.abort();
          pendingRef.current.controller = null;
        }

        const signature = mapInstanceRef.current.getBounds().toBBoxString();
        const controller = new AbortController();
        pendingRef.current.controller = controller;

        pendingRef.current.timer = setTimeout(() => {
          pendingRef.current.timer = null;
          pendingRef.current.controller = null;

          if (signature === pendingRef.current.lastSignature) {
            return;
          }

          pendingRef.current.lastSignature = signature;

          // Placeholder: future API call goes here with controller.signal
          console.debug("Viewport ready", { signature, signal: controller.signal });
        }, 350);
      };

      map.on("moveend", scheduleViewportSync);
      map.on("zoomend", scheduleViewportSync);
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
  }, []);

  return <div ref={mapElRef} className={cn("h-full w-full", className)} />;
}
