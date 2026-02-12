/**
 * Geohash utilities
 * 
 * Snaps coordinates to geohash grid for cache key generation.
 * Reduces combinatorial explosion by grouping nearby points.
 */

import geohash from 'ngeohash';
import type { Coordinates } from '../providers/interface.js';

/**
 * Snap coordinates to geohash with specified precision
 * @param coords GPS coordinates
 * @param precision Geohash precision (1-9). Default: 6 (~1km)
 * @returns Geohash string
 */
export function snapToGeohash(coords: Coordinates, precision: number = 6): string {
  return geohash.encode(coords.lat, coords.lng, precision);
}
