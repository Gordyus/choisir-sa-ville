/**
 * Routing Service
 * 
 * Orchestrates routing provider calls with caching strategy.
 * Applies geohash snapping, time bucketing, and error margins.
 */

import type { RoutingProvider, MatrixParams, MatrixResult, RouteGeometry } from './providers/interface.js';
import type { CacheService } from './cache/interface.js';
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

    // For now, bypass cache and call provider directly
    // Route geometry is too large to cache, and we need it for map display
    // TODO: Implement smart caching (duration/distance only, fetch geometry on demand)
    const result = await this.routingProvider.calculateMatrix(params);

    // Apply margin to durations
    const durationsWithMargin = result.durations.map(row =>
      row.map(duration => applyErrorMargin(duration, this.config.marginPercent))
    );

    return {
      durations: durationsWithMargin,
      distances: result.distances,
      routes: result.routes,
      fromCache: false
    };
  }
}
