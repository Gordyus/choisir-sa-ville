/**
 * TomTom Routing Provider
 * 
 * Production implementation using TomTom Calculate Route API.
 * Includes timeout, retry logic, and quota error handling.
 * @see https://docs.tomtom.com/routing-api/documentation/tomtom-maps/calculate-route
 */

import pRetry from 'p-retry';
import type { Coordinates, MatrixParams, MatrixResult, RouteParams, RouteResult, RoutingProvider } from './interface.js';
import { QuotaExceededError, TimeoutError } from '../../shared/errors/index.js';

interface TomTomRouteSummary {
  lengthInMeters: number;
  travelTimeInSeconds: number;
  trafficDelayInSeconds: number;
}

interface TomTomPoint {
  latitude: number;
  longitude: number;
}

interface TomTomLeg {
  points?: TomTomPoint[];
}

interface TomTomRouteResponse {
  routes?: Array<{
    summary?: TomTomRouteSummary;
    legs?: TomTomLeg[];
  }>;
}

export class TomTomProvider implements RoutingProvider {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.tomtom.com';
  private readonly timeout = 10000;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async calculateMatrix(params: MatrixParams): Promise<MatrixResult> {
    const durations: number[][] = [];
    const distances: number[][] = [];

    for (const origin of params.origins) {
      const durationRow: number[] = [];
      const distanceRow: number[] = [];

      for (const destination of params.destinations) {
        const result = await pRetry(
          () => this.callCalculateRoute(origin, destination, params, false),
          {
            retries: 2,
            minTimeout: 1000,
            onFailedAttempt: (error) => {
              console.warn(
                `TomTom Calculate Route attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`,
                error.message
              );
            }
          }
        );

        durationRow.push(result.travelTimeInSeconds);
        distanceRow.push(result.lengthInMeters);
      }

      durations.push(durationRow);
      distances.push(distanceRow);
    }

    return { durations, distances };
  }

  async calculateRoute(params: RouteParams): Promise<RouteResult> {
    const matrixParams = {
      origins: [params.origin],
      destinations: [params.destination],
      mode: params.mode,
      ...(params.departureTime !== undefined ? { departureTime: params.departureTime } : {}),
      ...(params.arrivalTime !== undefined ? { arrivalTime: params.arrivalTime } : {})
    } satisfies MatrixParams;

    const result = await pRetry(
      () => this.callCalculateRoute(params.origin, params.destination, matrixParams, true),
      {
        retries: 2,
        minTimeout: 1000,
        onFailedAttempt: (error) => {
          console.warn(
            `TomTom Route attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`,
            error.message
          );
        }
      }
    );

    const coordinates: [number, number][] = result.points.map(p => [p.lng, p.lat]);

    return {
      duration: result.travelTimeInSeconds,
      distance: result.lengthInMeters,
      geometry: {
        type: 'LineString',
        coordinates
      }
    };
  }

  getName(): string {
    return 'tomtom';
  }

  /**
   * Call TomTom Calculate Route API for a single origin→destination pair.
   * When withGeometry=false, skips polyline fetching for faster response.
   */
  private async callCalculateRoute(
    origin: Coordinates,
    destination: Coordinates,
    params: MatrixParams,
    withGeometry: boolean
  ): Promise<{ travelTimeInSeconds: number; lengthInMeters: number; points: Coordinates[] }> {
    const locations = `${origin.lat},${origin.lng}:${destination.lat},${destination.lng}`;
    const travelMode = this.mapModeToTomTom(params.mode);

    const queryParams = new URLSearchParams({
      key: this.apiKey,
      travelMode,
      traffic: 'true'
    });

    if (withGeometry) {
      queryParams.set('routeRepresentation', 'polyline');
    }

    if (params.departureTime) {
      queryParams.set('departAt', params.departureTime);
    } else if (params.arrivalTime) {
      queryParams.set('arriveAt', params.arrivalTime);
    }

    const url = `${this.baseUrl}/routing/1/calculateRoute/${locations}/json?${queryParams}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, { signal: controller.signal });

      if (response.status === 403) {
        throw new QuotaExceededError('TomTom API quota exceeded');
      }

      if (!response.ok) {
        throw new Error(`TomTom Calculate Route error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as TomTomRouteResponse;
      const route = data.routes?.[0];
      const summary = route?.summary;

      if (!summary) {
        throw new Error('No route found');
      }

      const points: Coordinates[] = [];
      if (withGeometry && route.legs) {
        for (const leg of route.legs) {
          if (leg.points) {
            for (const point of leg.points) {
              points.push({ lat: point.latitude, lng: point.longitude });
            }
          }
        }
      }

      return {
        travelTimeInSeconds: summary.travelTimeInSeconds,
        lengthInMeters: summary.lengthInMeters,
        points
      };
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new TimeoutError('TomTom Calculate Route timeout');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private mapModeToTomTom(mode: string): string {
    switch (mode) {
      case 'car': return 'car';
      case 'truck': return 'truck';
      case 'pedestrian': return 'pedestrian';
      default: return 'car';
    }
  }
}
