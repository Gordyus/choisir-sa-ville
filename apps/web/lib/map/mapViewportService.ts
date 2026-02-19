/**
 * Map Viewport Service
 *
 * Observable singleton exposing the current map viewport state (center + zoom).
 * Follows the same pattern as mapNavigationService.
 *
 * No React or MapLibre dependencies — pure TypeScript.
 */

// ============================================================================
// Types
// ============================================================================

export type MapViewState = {
    center: { lat: number; lng: number };
    zoom: number;
};

type ViewportListener = (state: MapViewState) => void;

// ============================================================================
// Service
// ============================================================================

class MapViewportServiceImpl {
    private state: MapViewState | null = null;
    private listeners = new Set<ViewportListener>();

    update(state: MapViewState): void {
        this.state = state;
        for (const listener of this.listeners) {
            listener(state);
        }
    }

    getState(): MapViewState | null {
        return this.state;
    }

    subscribe(listener: ViewportListener): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }
}

export const mapViewportService = new MapViewportServiceImpl();
