/**
 * Navitia (SNCF) Routing Provider
 * 
 * French public transit and routing API with generous free tier (150k req/month).
 * Supports multimodal routing and GeoJSON geometries.
 * 
 * @see https://doc.navitia.io/
 * @see https://numerique.sncf.com/startup/api/
 */

import pRetry from 'p-retry';
import type { Coordinates, MatrixParams, MatrixResult, RouteParams, RouteResult, RoutingProvider } from './interface.js';
import { QuotaExceededError, TimeoutError } from '../../shared/errors/index.js';

interface NavitiaSection {
  type: string;
  duration: number;
  length?: number;
  geojson?: {
    type: 'LineString';
    coordinates: [number, number][]; // [lng, lat] GeoJSON format
  };
}

interface NavitiaJourney {
  duration: number;
  distances?: {
    walking?: number;
    car?: number;
  };
  sections: NavitiaSection[];
}

interface NavitiaResponse {
  journeys?: NavitiaJourney[];
  error?: {
    id: string;
    message: string;
  };
}

export class NavitiaProvider implements RoutingProvider {
  private readonly apiKey: string;
  private readonly authHeader: string;
  private readonly baseUrl = 'https://api.navitia.io/v1';
  private readonly timeout = 15000;
  private readonly defaultCoverage = 'sandbox';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.authHeader = 'Basic ' + Buffer.from(apiKey + ':').toString('base64');
  }

  async calculateMatrix(params: MatrixParams): Promise<MatrixResult> {
    const durations: number[][] = [];
    const distances: number[][] = [];

    for (const origin of params.origins) {
      const durationRow: number[] = [];
      const distanceRow: number[] = [];

      for (const destination of params.destinations) {
        const result = await pRetry(
          () => this.callJourneysApi(origin, destination, params, false),
          {
            retries: 2,
            minTimeout: 1000,
            onFailedAttempt: (error) => {
              console.warn(
                `Navitia matrix attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`,
                error.message
              );
            }
          }
        );

        durationRow.push(result.duration);
        distanceRow.push(result.distance);
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
      () => this.callJourneysApi(params.origin, params.destination, matrixParams, true),
      {
        retries: 2,
        minTimeout: 1000,
        onFailedAttempt: (error) => {
          console.warn(
            `Navitia route attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`,
            error.message
          );
        }
      }
    );

    return {
      duration: result.duration,
      distance: result.distance,
      geometry: {
        type: 'LineString',
        coordinates: result.coordinates
      }
    };
  }

  getName(): string {
    return 'navitia';
  }

  private async getCoverageForCoordinates(lat: number, lng: number): Promise<string> {
    const url = `${this.baseUrl}/coverage/${lng};${lat}`;

    try {
      const response = await fetch(url, {
        headers: { 'Authorization': this.authHeader }
      });

      if (!response.ok) {
        console.warn(`Coverage detection failed for ${lat},${lng}, falling back to ${this.defaultCoverage}`);
        return this.defaultCoverage;
      }

      const data = await response.json() as {
        regions?: Array<{ id: string }>;
      };

      return data.regions?.[0]?.id || this.defaultCoverage;
    } catch (error) {
      console.warn(`Coverage detection error: ${error}. Using ${this.defaultCoverage}`);
      return this.defaultCoverage;
    }
  }

  /**
   * Call Navitia Journeys API for a single origin→destination pair.
   * When withGeometry=false, we still parse the journey but skip geometry extraction.
   */
  private async callJourneysApi(
    origin: Coordinates,
    destination: Coordinates,
    params: MatrixParams,
    withGeometry: boolean
  ): Promise<{ duration: number; distance: number; coordinates: [number, number][] }> {
    const coverage = await this.getCoverageForCoordinates(origin.lat, origin.lng);
    const url = `${this.baseUrl}/coverage/${coverage}/journeys`;

    const fromCoord = `${origin.lng};${origin.lat}`;
    const toCoord = `${destination.lng};${destination.lat}`;

    const queryParams = new URLSearchParams({
      from: fromCoord,
      to: toCoord,
      count: '1',
      ...this.buildTimeParams(params),
      ...this.buildModeParams(params.mode)
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${url}?${queryParams}`, {
        headers: { 'Authorization': this.authHeader },
        signal: controller.signal
      });

      if (response.status === 429) {
        throw new QuotaExceededError('Navitia API rate limit exceeded');
      }

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Navitia Journeys API error: ${response.status} - ${text}`);
      }

      const data = await response.json() as NavitiaResponse;

      if (data.error) {
        throw new Error(`Navitia error: ${data.error.id} - ${data.error.message}`);
      }

      const journey = data.journeys?.[0];
      if (!journey) {
        throw new Error('No journey found');
      }

      // Extract distance and optionally geometry from sections
      let totalDistance = 0;
      const coordinates: [number, number][] = [];

      for (const section of journey.sections) {
        if (section.length) {
          totalDistance += section.length;
        }
        if (withGeometry && section.geojson?.coordinates) {
          for (const coord of section.geojson.coordinates) {
            coordinates.push(coord);
          }
        }
      }

      if (totalDistance === 0) {
        totalDistance = this.estimateDistance(journey, origin, destination);
      }

      // Fallback geometry: straight line
      if (withGeometry && coordinates.length === 0) {
        coordinates.push([origin.lng, origin.lat], [destination.lng, destination.lat]);
      }

      return {
        duration: journey.duration,
        distance: Math.round(totalDistance),
        coordinates
      };
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new TimeoutError('Navitia Journeys API timeout');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private buildTimeParams(params: MatrixParams): Record<string, string> {
    const formatNavitiaDate = (isoDate: string): string => {
      return isoDate.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, '');
    };

    if (params.departureTime) {
      return {
        datetime: formatNavitiaDate(params.departureTime),
        datetime_represents: 'departure'
      };
    } else if (params.arrivalTime) {
      return {
        datetime: formatNavitiaDate(params.arrivalTime),
        datetime_represents: 'arrival'
      };
    }

    return { datetime_represents: 'departure' };
  }

  private buildModeParams(mode: string): Record<string, string> {
    switch (mode) {
      case 'car':
        return { first_section_mode: 'car', last_section_mode: 'car' };
      case 'truck':
        return { first_section_mode: 'car', last_section_mode: 'car' };
      case 'pedestrian':
        return { first_section_mode: 'walking', last_section_mode: 'walking' };
      default:
        return { first_section_mode: 'car', last_section_mode: 'car' };
    }
  }

  private estimateDistance(journey: NavitiaJourney, origin: Coordinates, destination: Coordinates): number {
    if (journey.distances?.car) return journey.distances.car;
    if (journey.distances?.walking) return journey.distances.walking;
    return this.calculateHaversineDistance(origin, destination);
  }

  private calculateHaversineDistance(coord1: Coordinates, coord2: Coordinates): number {
    const R = 6371e3;
    const φ1 = (coord1.lat * Math.PI) / 180;
    const φ2 = (coord2.lat * Math.PI) / 180;
    const Δφ = ((coord2.lat - coord1.lat) * Math.PI) / 180;
    const Δλ = ((coord2.lng - coord1.lng) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}
