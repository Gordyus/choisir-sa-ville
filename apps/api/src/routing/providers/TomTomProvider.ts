/**
 * TomTom Routing Provider
 * 
 * Production implementation using TomTom Calculate Route API.
 * Includes timeout, retry logic, and quota error handling.
 * @see https://docs.tomtom.com/routing-api/documentation/tomtom-maps/calculate-route
 */

import pRetry from 'p-retry';
import type { Coordinates, MatrixParams, MatrixResult, RouteGeometry, RoutingProvider } from './interface.js';
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
  private readonly timeout = 10000; // 10 seconds

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async calculateMatrix(params: MatrixParams): Promise<MatrixResult> {
    const durations: number[][] = [];
    const distances: number[][] = [];
    const routes: RouteGeometry[][] = [];

    for (const origin of params.origins) {
      const durationRow: number[] = [];
      const distanceRow: number[] = [];
      const routeRow: RouteGeometry[] = [];

      for (const destination of params.destinations) {
        const result = await pRetry(
          () => this.callCalculateRoute(origin, destination, params),
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
        routeRow.push({ points: result.points });
      }

      durations.push(durationRow);
      distances.push(distanceRow);
      routes.push(routeRow);
    }

    return { durations, distances, routes };
  }

  async geocode(address: string): Promise<Coordinates> {
    const url = `${this.baseUrl}/search/2/geocode/${encodeURIComponent(address)}.json?key=${this.apiKey}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, { signal: controller.signal });

      if (response.status === 403) {
        throw new QuotaExceededError('TomTom API quota exceeded');
      }

      if (!response.ok) {
        throw new Error(`TomTom Geocoding API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as {
        results?: Array<{
          position?: { lat?: number; lon?: number };
        }>;
      };

      const result = data.results?.[0];
      const position = result?.position;

      if (!position?.lat || !position?.lon) {
        throw new Error('No geocoding results found');
      }

      return {
        lat: position.lat,
        lng: position.lon
      };
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new TimeoutError('TomTom Geocoding API timeout');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  getName(): string {
    return 'tomtom';
  }

  /**
   * Call TomTom Calculate Route API for a single origin→destination pair.
   * Uses GET with polyline to get route geometry for map display.
   */
  private async callCalculateRoute(
    origin: Coordinates,
    destination: Coordinates,
    params: MatrixParams
  ): Promise<{ travelTimeInSeconds: number; lengthInMeters: number; points: Coordinates[] }> {
    const locations = `${origin.lat},${origin.lng}:${destination.lat},${destination.lng}`;
    const travelMode = this.mapModeToTomTom(params.mode);

    const queryParams = new URLSearchParams({
      key: this.apiKey,
      travelMode,
      traffic: 'true',
      routeRepresentation: 'polyline'
    });

    // Add departAt or arriveAt (mutually exclusive)
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

      // Extract polyline points from all legs
      const points: Coordinates[] = [];
      if (route.legs) {
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
      case 'car':
        return 'car';
      case 'truck':
        return 'truck';
      case 'pedestrian':
        return 'pedestrian';
      default:
        return 'car';
    }
  }
}
