/**
 * Error margin utilities
 * 
 * Applies configurable margin to travel time estimates to account for:
 * - Geohash snapping approximation (~1km)
 * - Traffic variability within time bucket
 * - Better UX: announce realistic max time vs optimistic min
 */

/**
 * Apply percentage margin to travel time
 * @param durationSeconds Travel time in seconds
 * @param marginPercent Margin percentage (default: 10)
 * @returns Travel time with margin applied (rounded)
 * 
 * @example
 * applyErrorMargin(1800, 10) // 1980 (1800 * 1.10)
 * applyErrorMargin(3600, 15) // 4140 (3600 * 1.15)
 */
export function applyErrorMargin(durationSeconds: number, marginPercent: number = 10): number {
  return Math.round(durationSeconds * (1 + marginPercent / 100));
}
