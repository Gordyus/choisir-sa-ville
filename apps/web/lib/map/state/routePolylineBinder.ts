/**
 * Route Polyline Binder
 *
 * Watches EntityStateService active state changes and fetches a route
 * geometry from the API to display on the map.
 *
 * Active only when displayMode === "search".
 * Uses AbortController per request to cancel stale fetches.
 */

import { getCommuneByInsee } from "@/lib/data/communesIndexLite";
import type { RouteGeometry } from "@/lib/map/layers/routePolyline";
import { getSearchService } from "@/lib/search/searchService";
import { getEntityStateService } from "@/lib/selection/selectionService";

import { displayModeService, type DisplayMode } from "./displayModeService";

// ============================================================================
// Constants
// ============================================================================

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// ============================================================================
// Public API
// ============================================================================

export function attachRoutePolylineBinder(
    updateRoute: (geometry: RouteGeometry | null) => void
): () => void {
    let currentAbort: AbortController | null = null;
    let currentMode: DisplayMode = displayModeService.getMode();

    const entityStateService = getEntityStateService();

    function cancelPending(): void {
        if (currentAbort) {
            currentAbort.abort();
            currentAbort = null;
        }
    }

    async function fetchRoute(inseeCode: string): Promise<void> {
        cancelPending();

        const controller = new AbortController();
        currentAbort = controller;

        try {
            const commune = await getCommuneByInsee(inseeCode, controller.signal);
            if (!commune || controller.signal.aborted) return;

            const searchState = getSearchService().getState();
            const firstTarget = searchState.criteria.travelTimeTargets[0];
            if (!firstTarget) {
                updateRoute(null);
                return;
            }

            const destination = firstTarget.destination;
            const mode = firstTarget.mode;

            const response = await fetch(`${API_BASE}/api/routing/route`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    origin: { lat: commune.lat, lng: commune.lon },
                    destination: { lat: destination.lat, lng: destination.lng },
                    departureTime: new Date().toISOString(),
                    mode,
                }),
                signal: controller.signal,
            });

            if (controller.signal.aborted) return;

            if (!response.ok) {
                console.error("[routePolylineBinder] Route fetch failed:", response.status);
                updateRoute(null);
                return;
            }

            const data = (await response.json()) as { geometry: RouteGeometry };
            if (controller.signal.aborted) return;

            updateRoute(data.geometry);
        } catch (error: unknown) {
            if (error instanceof DOMException && error.name === "AbortError") return;
            console.error("[routePolylineBinder] Error fetching route:", error);
            updateRoute(null);
        }
    }

    function handleActiveChange(): void {
        if (currentMode !== "search") {
            cancelPending();
            updateRoute(null);
            return;
        }

        const state = entityStateService.getState();
        const active = state.active;

        if (active && active.kind === "commune") {
            void fetchRoute(active.inseeCode);
        } else {
            cancelPending();
            updateRoute(null);
        }
    }

    // Subscribe to entity state changes (active only)
    const unsubscribeEntity = entityStateService.subscribe((event) => {
        if (event.type === "active") {
            handleActiveChange();
        }
    });

    // Subscribe to display mode changes
    const unsubscribeMode = displayModeService.subscribe((mode) => {
        currentMode = mode;
        if (mode !== "search") {
            cancelPending();
            updateRoute(null);
        } else {
            // Re-check active state when entering search mode
            handleActiveChange();
        }
    });

    // Check initial state
    if (currentMode === "search") {
        handleActiveChange();
    }

    // Cleanup
    return () => {
        cancelPending();
        unsubscribeEntity();
        unsubscribeMode();
        updateRoute(null);
    };
}
