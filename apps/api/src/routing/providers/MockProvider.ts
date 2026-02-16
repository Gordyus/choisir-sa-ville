/**
 * Mock Routing Provider
 * 
 * Simple implementation for testing and development.
 * Uses Haversine formula for distance calculation and assumes 80 km/h average speed.
 */

import type { Coordinates, MatrixParams, MatrixResult, RouteParams, RouteResult, RoutingProvider } from './interface.js';

export class MockProvider implements RoutingProvider {
  async calculateMatrix(params: MatrixParams): Promise<MatrixResult> {
    const { origins, destinations } = params;

    const durations: number[][] = [];
    const distances: number[][] = [];

    for (const origin of origins) {
      const durationRow: number[] = [];
      const distanceRow: number[] = [];

      for (const destination of destinations) {
        const distanceMeters = this.calculateHaversineDistance(origin, destination);
        const distanceKm = distanceMeters / 1000;
        
        // Assume 80 km/h average speed
        const durationHours = distanceKm / 80;
        const durationSeconds = Math.round(durationHours * 3600);

        durationRow.push(durationSeconds);
        distanceRow.push(Math.round(distanceMeters));
      }

      durations.push(durationRow);
      distances.push(distanceRow);
    }

    return { durations, distances };
  }

  async calculateRoute(params: RouteParams): Promise<RouteResult> {
    const { origin, destination } = params;
    const distanceMeters = this.calculateHaversineDistance(origin, destination);
    const durationSeconds = Math.round((distanceMeters / 1000 / 80) * 3600);

    return {
      duration: durationSeconds,
      distance: Math.round(distanceMeters),
      geometry: {
        type: 'LineString',
        coordinates: [
          [origin.lng, origin.lat],
          [origin.lng + (destination.lng - origin.lng) * 0.33, origin.lat + (destination.lat - origin.lat) * 0.33],
          [origin.lng + (destination.lng - origin.lng) * 0.66, origin.lat + (destination.lat - origin.lat) * 0.66],
          [destination.lng, destination.lat]
        ]
      }
    };
  }

  getName(): string {
    return 'mock';
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
