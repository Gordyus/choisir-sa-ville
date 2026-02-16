/**
 * Time bucketing utilities
 * 
 * Rounds departure times to fixed slots (e.g., 30-minute intervals)
 * to improve cache hit rate.
 */

/**
 * Round ISO 8601 timestamp to nearest time bucket
 * @param isoTime ISO 8601 timestamp
 * @param bucketMinutes Bucket size in minutes (default: 30)
 * @returns Rounded ISO 8601 timestamp
 * 
 * @example
 * roundToTimeBucket('2026-03-15T08:17:00Z', 30) // '2026-03-15T08:00:00.000Z'
 * roundToTimeBucket('2026-03-15T08:43:00Z', 30) // '2026-03-15T08:30:00.000Z'
 */
export function roundToTimeBucket(isoTime: string, bucketMinutes: number = 30): string {
  const date = new Date(isoTime);
  const minutes = date.getMinutes();
  const roundedMinutes = Math.floor(minutes / bucketMinutes) * bucketMinutes;
  
  date.setMinutes(roundedMinutes, 0, 0);
  
  return date.toISOString();
}
