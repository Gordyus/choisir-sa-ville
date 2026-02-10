/**
 * Computes WebMercator tile coordinates (z, x, y) for a given lat/lng and zoom level.
 * Used to partition transaction bundles into tile-based JSON files.
 */
export function latLngToTile(lat: number, lng: number, zoom: number): { z: number; x: number; y: number } {
    const n = 2 ** zoom;
    const x = Math.floor(((lng + 180) / 360) * n);
    const latRad = (lat * Math.PI) / 180;
    const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
    return { z: zoom, x, y };
}

/** Bundle zoom level — z15 gives good locality for click-triggered loads. */
export const BUNDLE_ZOOM = 15;
