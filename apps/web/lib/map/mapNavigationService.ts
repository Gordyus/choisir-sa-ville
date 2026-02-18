/**
 * Map Navigation Service
 *
 * Observable singleton for programmatic map navigation (flyTo).
 * Follows the same pattern as selectionService / displayModeService.
 *
 * No React or MapLibre dependencies — pure TypeScript.
 */

// ============================================================================
// Types
// ============================================================================

export type FlyToRequest = {
    center: [number, number]; // [lng, lat]
    zoom: number;
};

type NavigationListener = (request: FlyToRequest) => void;

// ============================================================================
// Service
// ============================================================================

class MapNavigationServiceImpl {
    private listeners = new Set<NavigationListener>();

    flyTo(request: FlyToRequest): void {
        for (const listener of this.listeners) {
            listener(request);
        }
    }

    subscribe(listener: NavigationListener): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }
}

export const mapNavigationService = new MapNavigationServiceImpl();

// ============================================================================
// Helpers
// ============================================================================

/**
 * Compute an approximate zoom level for a given radius in km.
 * Based on the Web Mercator formula: zoom ≈ log2(40075 * cos(lat) / (radiusKm * 2)) - 1
 * Simplified for typical French latitudes (~46°).
 */
export function zoomForRadiusKm(radiusKm: number): number {
    // At lat ~46°, 1 tile at zoom 0 ≈ 40075 * cos(46°) ≈ 27830 km
    // zoom = log2(27830 / (radiusKm * 2)) - 1 (fudge for padding)
    const zoom = Math.log2(27830 / (radiusKm * 2)) - 1;
    return Math.min(Math.max(zoom, 5), 15);
}
