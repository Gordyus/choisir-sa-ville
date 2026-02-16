/**
 * Valhalla Routing Provider
 *
 * Self-hosted routing engine with native time-dependent routing support.
 * Uses historical traffic data (2016 speed profiles per week) for realistic travel times.
 *
 * Key features:
 * - Time-dependent routing: Accounts for rush hour traffic patterns
 * - Matrix API: Native sources-to-targets endpoint (N×M in 1 request)
 * - Free unlimited: No external API quota limits
 * - GeoJSON geometry: MapLibre-ready LineString output
 *
 * @see https://valhalla.github.io/valhalla/
 * @see https://valhalla.github.io/valhalla/mjolnir/historical_traffic/
 */

import pRetry from 'p-retry';
import type { MatrixParams, MatrixResult, RouteParams, RouteResult, RoutingProvider } from './interface.js';
import { TimeoutError } from '../../shared/errors/index.js';

interface ValhallaLocation {
  lat: number;
  lon: number;
}

interface ValhallaDateTime {
  type: 1 | 2; // 1 = depart at, 2 = arrive by
  value: string; // Local time format: YYYY-MM-DDThh:mm (NO timezone suffix)
}

interface ValhallaMatrixRequest {
  sources: ValhallaLocation[];
  targets: ValhallaLocation[];
  costing: string;
  date_time?: ValhallaDateTime;
}

interface ValhallaMatrixResponse {
  sources_to_targets: Array<Array<{
    time: number; // Seconds
    distance: number; // Kilometers
  }>>;
}

interface ValhallaRouteRequest {
  locations: ValhallaLocation[];
  costing: string;
  directions_options?: {
    units: 'kilometers' | 'miles';
  };
  date_time?: ValhallaDateTime;
}

interface ValhallaRouteResponse {
  trip: {
    summary: {
      time: number; // Seconds
      length: number; // Kilometers
    };
    legs: Array<{
      shape: string; // Encoded polyline (6-digit precision)
    }>;
  };
}

export class ValhallaProvider implements RoutingProvider {
  private readonly baseUrl: string;
  private readonly timeout = 15000; // 15s timeout (self-hosted may be slower than cloud APIs)

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async calculateMatrix(params: MatrixParams): Promise<MatrixResult> {
    const request: ValhallaMatrixRequest = {
      sources: params.origins.map(o => ({ lat: o.lat, lon: o.lng })),
      targets: params.destinations.map(d => ({ lat: d.lat, lon: d.lng })),
      costing: this.mapModeToCost(params.mode)
    };

    // Add time constraints if specified (convert to Valhalla local time format)
    if (params.arrivalTime) {
      request.date_time = {
        type: 2, // arrive by
        value: this.formatDateTime(params.arrivalTime)
      };
    } else if (params.departureTime) {
      request.date_time = {
        type: 1, // depart at
        value: this.formatDateTime(params.departureTime)
      };
    }

    const result = await pRetry(
      () => this.callMatrixAPI(request),
      {
        retries: 2,
        minTimeout: 1000,
        onFailedAttempt: (error) => {
          console.warn(
            `Valhalla Matrix API attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`,
            error.message
          );
        }
      }
    );

    // Convert Valhalla response to MatrixResult format
    const durations: number[][] = [];
    const distances: number[][] = [];

    for (let i = 0; i < params.origins.length; i++) {
      const durationRow: number[] = [];
      const distanceRow: number[] = [];

      for (let j = 0; j < params.destinations.length; j++) {
        const cell = result.sources_to_targets[i]?.[j];

        if (!cell) {
          throw new Error(`Missing matrix cell at [${i}][${j}]`);
        }

        durationRow.push(cell.time); // Already in seconds
        distanceRow.push(cell.distance * 1000); // km → meters
      }

      durations.push(durationRow);
      distances.push(distanceRow);
    }

    return { durations, distances };
  }

  async calculateRoute(params: RouteParams): Promise<RouteResult> {
    const request: ValhallaRouteRequest = {
      locations: [
        { lat: params.origin.lat, lon: params.origin.lng },
        { lat: params.destination.lat, lon: params.destination.lng }
      ],
      costing: this.mapModeToCost(params.mode),
      directions_options: {
        units: 'kilometers'
      }
    };

    // Add time constraints if specified (convert to Valhalla local time format)
    if (params.arrivalTime) {
      request.date_time = {
        type: 2, // arrive by
        value: this.formatDateTime(params.arrivalTime)
      };
    } else if (params.departureTime) {
      request.date_time = {
        type: 1, // depart at
        value: this.formatDateTime(params.departureTime)
      };
    }

    const result = await pRetry(
      () => this.callRouteAPI(request),
      {
        retries: 2,
        minTimeout: 1000,
        onFailedAttempt: (error) => {
          console.warn(
            `Valhalla Route API attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`,
            error.message
          );
        }
      }
    );

    // Decode encoded polyline shapes from all legs into GeoJSON coordinates
    const coordinates: [number, number][] = [];

    for (const leg of result.trip.legs) {
      const decoded = this.decodePolyline(leg.shape);
      for (const point of decoded) {
        coordinates.push(point);
      }
    }

    return {
      duration: result.trip.summary.time, // Already in seconds
      distance: result.trip.summary.length * 1000, // km → meters
      geometry: {
        type: 'LineString',
        coordinates
      }
    };
  }

  getName(): string {
    return 'valhalla';
  }

  /**
   * Call Valhalla Sources-to-Targets API for matrix calculation.
   * Native batch endpoint (N×M in 1 request).
   */
  private async callMatrixAPI(request: ValhallaMatrixRequest): Promise<ValhallaMatrixResponse> {
    const url = `${this.baseUrl}/sources_to_targets`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Valhalla Matrix API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json() as ValhallaMatrixResponse;

      if (!data.sources_to_targets || data.sources_to_targets.length === 0) {
        throw new Error('Valhalla returned empty matrix');
      }

      return data;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new TimeoutError('Valhalla Matrix API timeout');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Call Valhalla Route API for single route with geometry.
   */
  private async callRouteAPI(request: ValhallaRouteRequest): Promise<ValhallaRouteResponse> {
    const url = `${this.baseUrl}/route`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Valhalla Route API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json() as ValhallaRouteResponse;

      if (!data.trip || !data.trip.summary) {
        throw new Error('Valhalla returned invalid route response');
      }

      return data;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new TimeoutError('Valhalla Route API timeout');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Map generic transport mode to Valhalla costing model.
   * @see https://valhalla.github.io/valhalla/api/turn-by-turn/api-reference/#costing-models
   */
  private mapModeToCost(mode: string): string {
    const mapping: Record<string, string> = {
      car: 'auto',
      truck: 'truck',
      pedestrian: 'pedestrian',
      transit: 'multimodal' // Fallback, but Navitia is better for French transit
    };
    return mapping[mode] || 'auto';
  }

  /**
   * Convert ISO 8601 datetime to Valhalla local time format.
   * Valhalla expects "YYYY-MM-DDThh:mm" without timezone suffix.
   * @see https://valhalla.github.io/valhalla/api/turn-by-turn/api-reference/
   */
  private formatDateTime(isoString: string): string {
    // Extract "YYYY-MM-DDThh:mm" prefix: "2026-03-17T08:30:00Z" → "2026-03-17T08:30"
    const match = isoString.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
    if (!match?.[1]) {
      throw new Error(`Invalid ISO 8601 datetime: ${isoString}`);
    }
    return match[1];
  }

  /**
   * Decode an encoded polyline string into [lng, lat] GeoJSON coordinates.
   * Valhalla uses 6-digit precision (1e6) instead of Google's 5-digit (1e5).
   * @see https://valhalla.github.io/valhalla/decoding/
   */
  private decodePolyline(encoded: string): [number, number][] {
    const coordinates: [number, number][] = [];
    let index = 0;
    let lat = 0;
    let lng = 0;
    const precision = 1e6; // Valhalla uses 6-digit precision

    while (index < encoded.length) {
      // Decode latitude
      let shift = 0;
      let result = 0;
      let byte: number;

      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);

      lat += (result & 1) !== 0 ? ~(result >> 1) : result >> 1;

      // Decode longitude
      shift = 0;
      result = 0;

      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);

      lng += (result & 1) !== 0 ? ~(result >> 1) : result >> 1;

      coordinates.push([lng / precision, lat / precision]); // GeoJSON [lng, lat] order
    }

    return coordinates;
  }
}
