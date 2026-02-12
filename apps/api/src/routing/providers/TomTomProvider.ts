/**
 * TomTom Routing Provider
 * 
 * Production implementation using TomTom Routing API.
 * Includes timeout, retry logic, and quota error handling.
 */

import pRetry from 'p-retry';
import type { Coordinates, MatrixParams, MatrixResult, RoutingProvider } from './interface.js';
import { QuotaExceededError, TimeoutError } from '../../shared/errors/index.js';

export class TomTomProvider implements RoutingProvider {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.tomtom.com';
  private readonly timeout = 10000; // 10 seconds

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async calculateMatrix(params: MatrixParams): Promise<MatrixResult> {
    return pRetry(
      () => this.callMatrixApi(params),
      {
        retries: 2,
        minTimeout: 1000,
        onFailedAttempt: (error) => {
          console.warn(
            `TomTom Matrix API attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`,
            error.message
          );
        }
      }
    );
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

  private async callMatrixApi(params: MatrixParams): Promise<MatrixResult> {
    const url = `${this.baseUrl}/routing/matrix/2/sync/json?key=${this.apiKey}`;

    const body = {
      origins: params.origins.map(c => ({ point: { latitude: c.lat, longitude: c.lng } })),
      destinations: params.destinations.map(c => ({ point: { latitude: c.lat, longitude: c.lng } })),
      options: {
        departAt: params.departureTime,
        traffic: true,
        travelMode: this.mapModeToTomTom(params.mode)
      }
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      if (response.status === 403) {
        throw new QuotaExceededError('TomTom API quota exceeded');
      }

      if (!response.ok) {
        throw new Error(`TomTom Matrix API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as {
        data?: Array<{
          routeSummary?: {
            travelTimeInSeconds?: number;
            lengthInMeters?: number;
          };
        }>;
      };

      return this.transformTomTomResponse(data, params.origins.length, params.destinations.length);
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new TimeoutError('TomTom Matrix API timeout');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private transformTomTomResponse(
    data: { data?: Array<{ routeSummary?: { travelTimeInSeconds?: number; lengthInMeters?: number } }> },
    originsCount: number,
    destinationsCount: number
  ): MatrixResult {
    const durations: number[][] = [];
    const distances: number[][] = [];

    const results = data.data || [];

    for (let i = 0; i < originsCount; i++) {
      const durationRow: number[] = [];
      const distanceRow: number[] = [];

      for (let j = 0; j < destinationsCount; j++) {
        const index = i * destinationsCount + j;
        const result = results[index];
        const summary = result?.routeSummary;

        durationRow.push(summary?.travelTimeInSeconds || 0);
        distanceRow.push(summary?.lengthInMeters || 0);
      }

      durations.push(durationRow);
      distances.push(distanceRow);
    }

    return { durations, distances };
  }

  private mapModeToTomTom(mode: string): string {
    switch (mode) {
      case 'car':
        return 'car';
      case 'transit':
        return 'publicTransport';
      case 'walk':
        return 'pedestrian';
      case 'bike':
        return 'bicycle';
      default:
        return 'car';
    }
  }
}
