/**
 * Routing Service
 * 
 * Orchestrates routing provider calls with caching strategy.
 * Applies geohash snapping, time bucketing, and error margins.
 */

import type { RoutingProvider, MatrixParams, MatrixResult } from './providers/interface.js';
import type { CacheService } from './cache/interface.js';
import { snapToGeohash } from './utils/geohash.js';
import { roundToTimeBucket } from './utils/timeBucket.js';
import { applyErrorMargin } from './utils/errorMargin.js';

export interface RoutingServiceConfig {
  geohashPrecision: number;
  timeBucketMinutes: number;
  marginPercent: number;
  cacheTtlDays: number;
}

export interface MatrixResultWithCache extends MatrixResult {
  fromCache: boolean;
}

export class RoutingService {
  constructor(
    private routingProvider: RoutingProvider,
    private cacheService: CacheService,
    private config: RoutingServiceConfig
  ) {}

  async calculateMatrix(params: MatrixParams): Promise<MatrixResultWithCache> {
    // For MVP: simple single origin/destination handling
    // Future: batch processing for multiple origins
    
    if (params.origins.length === 0 || params.destinations.length === 0) {
      throw new Error('At least one origin and one destination required');
    }

    const durations: number[][] = [];
    const distances: number[][] = [];
    let cacheHits = 0;
    let cacheMisses = 0;

    for (const origin of params.origins) {
      const durationRow: number[] = [];
      const distanceRow: number[] = [];

      for (const destination of params.destinations) {
        // 1. Snap to geohash
        const geohashOrigin = snapToGeohash(origin, this.config.geohashPrecision);
        const geohashDest = snapToGeohash(destination, this.config.geohashPrecision);

        // 2. Time bucketing
        const timeBucket = roundToTimeBucket(params.departureTime, this.config.timeBucketMinutes);

        // 3. Cache key
        const cacheKey = `${geohashOrigin}_${geohashDest}_${timeBucket}_${params.mode}`;

        // 4. Check cache
        const cached = await this.cacheService.get(cacheKey);

        if (cached !== null) {
          // Cache hit
          durationRow.push(cached);
          distanceRow.push(0); // Distance not cached
          cacheHits++;
        } else {
          // Cache miss - call provider
          const result = await this.routingProvider.calculateMatrix({
            origins: [origin],
            destinations: [destination],
            departureTime: params.departureTime,
            mode: params.mode
          });

          const rawDuration = result.durations[0]?.[0] || 0;
          const distance = result.distances[0]?.[0] || 0;

          // 5. Apply margin
          const durationWithMargin = applyErrorMargin(rawDuration, this.config.marginPercent);

          // 6. Store in cache
          await this.cacheService.set(cacheKey, durationWithMargin, this.config.cacheTtlDays);

          durationRow.push(durationWithMargin);
          distanceRow.push(distance);
          cacheMisses++;
        }
      }

      durations.push(durationRow);
      distances.push(distanceRow);
    }

    const fromCache = cacheMisses === 0 && cacheHits > 0;

    return {
      durations,
      distances,
      fromCache
    };
  }
}
