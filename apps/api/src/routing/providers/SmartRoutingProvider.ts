/**
 * Smart Routing Provider
 * 
 * Intelligently selects the best provider based on travel mode:
 * - transit: Navitia (excellent French public transport coverage)
 * - car/truck/pedestrian: TomTom (optimized for road routing)
 * 
 * Falls back to a default provider if mode-specific provider unavailable.
 */

import type { RoutingProvider, MatrixParams, MatrixResult, RouteParams, RouteResult } from './interface.js';

export interface ProviderMap {
  transit?: RoutingProvider;
  car?: RoutingProvider;
  truck?: RoutingProvider;
  pedestrian?: RoutingProvider;
  default: RoutingProvider;
}

export class SmartRoutingProvider implements RoutingProvider {
  constructor(private providers: ProviderMap) {
    if (!providers.default) {
      throw new Error('SmartRoutingProvider requires a default provider');
    }
  }

  getName(): string {
    return 'smart';
  }

  private selectProvider(mode: string): RoutingProvider {
    // Try mode-specific provider first
    const modeProvider = this.providers[mode as keyof ProviderMap];
    if (modeProvider && typeof modeProvider !== 'string') {
      return modeProvider as RoutingProvider;
    }

    // Fallback to default
    return this.providers.default;
  }

  async calculateMatrix(params: MatrixParams): Promise<MatrixResult> {
    const provider = this.selectProvider(params.mode);
    return provider.calculateMatrix(params);
  }

  async calculateRoute(params: RouteParams): Promise<RouteResult> {
    const provider = this.selectProvider(params.mode);
    return provider.calculateRoute(params);
  }
}
