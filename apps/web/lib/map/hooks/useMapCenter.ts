"use client";

/**
 * Hook exposing the current map center coordinates.
 *
 * Rounds to 2 decimal places (~1km precision) to stabilize downstream
 * dependencies and avoid excessive re-renders on small viewport changes.
 */

import { useEffect, useState } from "react";

import { mapViewportService } from "@/lib/map/mapViewportService";

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

export function useMapCenter(): { lat: number; lng: number } | null {
    const [center, setCenter] = useState<{ lat: number; lng: number } | null>(() => {
        const state = mapViewportService.getState();
        if (state === null) return null;
        return { lat: round2(state.center.lat), lng: round2(state.center.lng) };
    });

    useEffect(() => {
        return mapViewportService.subscribe((state) => {
            const rounded = { lat: round2(state.center.lat), lng: round2(state.center.lng) };
            setCenter((prev) => {
                if (prev !== null && prev.lat === rounded.lat && prev.lng === rounded.lng) {
                    return prev;
                }
                return rounded;
            });
        });
    }, []);

    return center;
}
