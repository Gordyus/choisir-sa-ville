/**
 * Cache Service Interface
 * 
 * Abstraction for caching travel time results.
 * Implementations: MockCacheService (in-memory), PostgresCacheService (production).
 */

export interface CacheService {
  /**
   * Get cached travel time duration
   * @returns Duration in seconds, or null if not found/expired
   */
  get(key: string): Promise<number | null>;

  /**
   * Store travel time duration in cache
   * @param key Cache key
   * @param durationSeconds Travel time in seconds
   * @param ttlDays Time-to-live in days
   */
  set(key: string, durationSeconds: number, ttlDays: number): Promise<void>;
}
