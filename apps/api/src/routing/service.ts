/**
 * Routing Service
 * 
 * Orchestrates routing provider calls with caching strategy and error margins.
 * Split into two operations:
 * - calculateMatrix: Bulk durations/distances (cacheable, no geometry)
 * - calculateRoute: Single route with geometry (on-demand, for map display)
 */

import type { RoutingProvider, MatrixParams, MatrixResult, RouteParams, RouteResult } from './providers/interface.js';
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
    if (params.origins.length === 0 || params.destinations.length === 0) {
      throw new Error('At least one origin and one destination required');
    }

    // TODO: Re-enable cache now that matrix has no geometry (small payload)
    const result = await this.routingProvider.calculateMatrix(params);

    const durationsWithMargin = result.durations.map(row =>
      row.map(duration => applyErrorMargin(duration, this.config.marginPercent))
    );

    return {
      durations: durationsWithMargin,
      distances: result.distances,
      fromCache: false
    };
  }

  async calculateRoute(params: RouteParams): Promise<RouteResult> {
    const result = await this.routingProvider.calculateRoute(params);

    return {
      duration: applyErrorMargin(result.duration, this.config.marginPercent),
      distance: result.distance,
      geometry: result.geometry
    };
  }
}
