/**
 * Navitia (SNCF) Routing Provider
 * 
 * French public transit and routing API with generous free tier (150k req/month).
 * Supports multimodal routing, native matrix calculations, and GeoJSON geometries.
 * 
 * @see https://doc.navitia.io/
 * @see https://numerique.sncf.com/startup/api/
 */

import pRetry from 'p-retry';
import type { Coordinates, MatrixParams, MatrixResult, RouteGeometry, RoutingProvider } from './interface.js';
import { QuotaExceededError, TimeoutError } from '../../shared/errors/index.js';

interface NavitiaCoordinates {
  lon: number;
  lat: number;
}

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
  private readonly baseUrl = 'https://api.navitia.io/v1';
  private readonly timeout = 15000; // 15 seconds (Navitia can be slower than TomTom)
  
  // Navitia uses regional coverage zones
  // 'fr' = France nationwide, 'fr-idf' = Île-de-France, etc.
  private readonly defaultCoverage = 'fr';

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
          () => this.callJourneysApi(origin, destination, params),
          {
            retries: 2,
            minTimeout: 1000,
            onFailedAttempt: (error) => {
              console.warn(
                `Navitia Journeys API attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`,
                error.message
              );
            }
          }
        );

        durationRow.push(result.duration);
        distanceRow.push(result.distance);
        routeRow.push({ points: result.points });
      }

      durations.push(durationRow);
      distances.push(distanceRow);
      routes.push(routeRow);
    }

    return { durations, distances, routes };
  }

  async geocode(address: string): Promise<Coordinates> {
    const url = `${this.baseUrl}/coverage/${this.defaultCoverage}/places`;
    
    const params = new URLSearchParams({
      q: address,
      type: 'address',
      count: '1'
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${url}?${params}`, {
        headers: {
          'Authorization': this.apiKey
        },
        signal: controller.signal
      });

      if (response.status === 429) {
        throw new QuotaExceededError('Navitia API rate limit exceeded');
      }

      if (!response.ok) {
        throw new Error(`Navitia Geocoding error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as {
        places?: Array<{
          embedded_type?: string;
          address?: {
            coord?: NavitiaCoordinates;
          };
        }>;
      };

      const place = data.places?.[0];
      const coord = place?.address?.coord;

      if (!coord) {
        throw new Error('No geocoding results found');
      }

      return {
        lat: coord.lat,
        lng: coord.lon
      };
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new TimeoutError('Navitia Geocoding timeout');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  getName(): string {
    return 'navitia';
  }

  /**
   * Call Navitia Journeys API for a single origin→destination pair.
   * 
   * Navitia returns journeys with sections that include GeoJSON LineStrings.
   * We extract all section geometries and merge them into a single route.
   */
  private async callJourneysApi(
    origin: Coordinates,
    destination: Coordinates,
    params: MatrixParams
  ): Promise<{ duration: number; distance: number; points: Coordinates[] }> {
    const url = `${this.baseUrl}/coverage/${this.defaultCoverage}/journeys`;

    // Navitia uses format: lon;lat (opposite of lat,lng)
    const fromCoord = `${origin.lng};${origin.lat}`;
    const toCoord = `${destination.lng};${destination.lat}`;

    const queryParams = new URLSearchParams({
      from: fromCoord,
      to: toCoord,
      count: '1', // Only want the best journey
      ...this.buildTimeParams(params),
      ...this.buildModeParams(params.mode)
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${url}?${queryParams}`, {
        headers: {
          'Authorization': this.apiKey
        },
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

      // Extract geometry from all sections
      const points: Coordinates[] = [];
      let totalDistance = 0;

      for (const section of journey.sections) {
        if (section.geojson?.coordinates) {
          // GeoJSON uses [lng, lat] format
          for (const [lng, lat] of section.geojson.coordinates) {
            points.push({ lat, lng });
          }
        }

        // Accumulate distance (Navitia sometimes provides it per section)
        if (section.length) {
          totalDistance += section.length;
        }
      }

      // Fallback: estimate distance from journey data or use Haversine
      if (totalDistance === 0) {
        totalDistance = this.estimateDistance(journey, origin, destination);
      }

      return {
        duration: journey.duration,
        distance: Math.round(totalDistance),
        points: points.length > 0 ? points : [origin, destination] // Fallback to straight line
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
    // Navitia datetime format: YYYYMMDDTHHmmss (no separators, no timezone)
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

    // Default: departure now
    return {
      datetime_represents: 'departure'
    };
  }

  private buildModeParams(mode: string): Record<string, string> {
    // Navitia modes:
    // - car, bike, bss (bike sharing), walking, ridesharing
    // - physical_mode:Bus, physical_mode:Metro, etc.
    
    switch (mode) {
      case 'car':
        return {
          first_section_mode: 'car',
          last_section_mode: 'car'
        };
      case 'truck':
        // Navitia doesn't have truck mode, fallback to car
        return {
          first_section_mode: 'car',
          last_section_mode: 'car'
        };
      case 'pedestrian':
        return {
          first_section_mode: 'walking',
          last_section_mode: 'walking'
        };
      default:
        return {
          first_section_mode: 'car',
          last_section_mode: 'car'
        };
    }
  }

  /**
   * Estimate distance from journey metadata or Haversine formula.
   */
  private estimateDistance(journey: NavitiaJourney, origin: Coordinates, destination: Coordinates): number {
    // Try to get distance from journey metadata
    if (journey.distances?.car) {
      return journey.distances.car;
    }
    if (journey.distances?.walking) {
      return journey.distances.walking;
    }

    // Fallback: Haversine distance
    return this.calculateHaversineDistance(origin, destination);
  }

  private calculateHaversineDistance(coord1: Coordinates, coord2: Coordinates): number {
    const R = 6371e3; // Earth radius in meters
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
