import type { Map as LeafletMap } from "leaflet";

import type { MarkerCandidate, MarkerSelectionResult } from "./markerSelection";

export type MarkerLayerHandle = {
    updateMarkers: (selection: MarkerSelectionResult) => void;
    destroy: () => void;
};

export function createLeafletMarkerLayer(map: LeafletMap): MarkerLayerHandle {
    const leafletModulePromise = import("leaflet").then((m) => (m as any).default ?? m);

    let communeLayer: any = null;
    let infraLayer: any = null;

    void leafletModulePromise.then((L) => {
        communeLayer = L.layerGroup().addTo(map);
        infraLayer = L.layerGroup().addTo(map);
    });

    function clearLayers(): void {
        communeLayer?.clearLayers?.();
        infraLayer?.clearLayers?.();
    }

    function addMarkers(L: any, layer: any, markers: MarkerCandidate[], style: { color: string; radius: number }): void {
        for (const marker of markers) {
            const circle = L.circleMarker([marker.lat, marker.lng], {
                radius: style.radius,
                color: style.color,
                weight: 2,
                fillColor: style.color,
                fillOpacity: 0.35
            });
            circle.bindTooltip(marker.label, {
                permanent: true,
                direction: "top",
                offset: [0, -6],
                opacity: 0.9
            });
            circle.addTo(layer);
        }
    }

    return {
        updateMarkers: (selection) => {
            void leafletModulePromise.then((L) => {
                if (!communeLayer || !infraLayer) return;
                clearLayers();
                addMarkers(L, communeLayer, selection.communes, { color: "#0ea5e9", radius: 5 });
                addMarkers(L, infraLayer, selection.infra, { color: "#f97316", radius: 4 });
            });
        },
        destroy: () => {
            clearLayers();
            communeLayer?.remove?.();
            infraLayer?.remove?.();
            communeLayer = null;
            infraLayer = null;
        }
    };
}

