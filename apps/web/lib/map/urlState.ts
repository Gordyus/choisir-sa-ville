/**
 * URL State Utilities for Map View Synchronization
 *
 * Provides functions to parse and format map viewport state (center + zoom)
 * from/to URL query parameters.
 *
 * Format: ?view={lat},{lng},{zoom}
 * Example: ?view=48.8566,2.3522,12
 *
 * Precision:
 * - Latitude/Longitude: 4 decimal places (~11 meters precision)
 * - Zoom: 2 decimal places
 *
 * ARCHITECTURE:
 * - These utilities are stateless and pure
 * - Used by VectorMap component for URL synchronization
 * - Does NOT manage selection state (only viewport)
 */

// ============================================================================
// Types
// ============================================================================

export interface MapViewState {
    center: [number, number]; // [lng, lat]
    zoom: number;
}

// ============================================================================
// Constants
// ============================================================================

const LAT_MIN = -90;
const LAT_MAX = 90;
const LNG_MIN = -180;
const LNG_MAX = 180;
const ZOOM_MIN = 0;
const ZOOM_MAX = 22;

const LAT_LNG_PRECISION = 4;
const ZOOM_PRECISION = 2;

// ============================================================================
// Public API
// ============================================================================

/**
 * Parse map view state from URL search params
 *
 * Expected format: ?view={lat},{lng},{zoom}
 * Example: ?view=48.8566,2.3522,12
 *
 * @param searchParams - URLSearchParams or string from URL
 * @returns Parsed view state or null if invalid/missing
 */
export function parseViewFromURL(searchParams: URLSearchParams | string): MapViewState | null {
    const params = typeof searchParams === "string" ? new URLSearchParams(searchParams) : searchParams;
    const viewParam = params.get("view");

    if (!viewParam) {
        return null;
    }

    const parts = viewParam.split(",");
    if (parts.length !== 3) {
        return null;
    }

    const latStr = parts[0];
    const lngStr = parts[1];
    const zoomStr = parts[2];

    if (!latStr || !lngStr || !zoomStr) {
        return null;
    }

    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    const zoom = parseFloat(zoomStr);

    // Validate values
    if (!isValidLat(lat) || !isValidLng(lng) || !isValidZoom(zoom)) {
        return null;
    }

    return {
        center: [lng, lat], // MapLibre expects [lng, lat]
        zoom
    };
}

/**
 * Format map view state into URL query parameter
 *
 * Output format: view={lat},{lng},{zoom}
 * Example: view=48.8566,2.3522,12
 *
 * @param center - [lng, lat] tuple (MapLibre format)
 * @param zoom - Zoom level
 * @returns Query parameter string (without '?')
 */
export function formatViewForURL(center: [number, number], zoom: number): string {
    const [lng, lat] = center;
    const latRounded = roundTo(lat, LAT_LNG_PRECISION);
    const lngRounded = roundTo(lng, LAT_LNG_PRECISION);
    const zoomRounded = roundTo(zoom, ZOOM_PRECISION);

    return `view=${latRounded},${lngRounded},${zoomRounded}`;
}

// ============================================================================
// Validation Helpers
// ============================================================================

function isValidLat(lat: number): boolean {
    return !Number.isNaN(lat) && lat >= LAT_MIN && lat <= LAT_MAX;
}

function isValidLng(lng: number): boolean {
    return !Number.isNaN(lng) && lng >= LNG_MIN && lng <= LNG_MAX;
}

function isValidZoom(zoom: number): boolean {
    return !Number.isNaN(zoom) && zoom >= ZOOM_MIN && zoom <= ZOOM_MAX;
}

function roundTo(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
}
