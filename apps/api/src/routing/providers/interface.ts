/**
 * Routing Provider Interface
 * 
 * Abstraction layer for external routing APIs (TomTom, OSRM, etc.).
 * Implements the Adapter pattern to decouple business logic from provider-specific code.
 */

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface MatrixParams {
  origins: Coordinates[];
  destinations: Coordinates[];
  departureTime: string; // ISO 8601
  mode: 'car' | 'transit' | 'walk' | 'bike';
}

export interface MatrixResult {
  durations: number[][]; // Seconds (origins x destinations)
  distances: number[][]; // Meters (origins x destinations)
}

export interface RoutingProvider {
  /**
   * Calculate travel time matrix between multiple origins and destinations
   */
  calculateMatrix(params: MatrixParams): Promise<MatrixResult>;

  /**
   * Geocode an address to GPS coordinates
   */
  geocode(address: string): Promise<Coordinates>;

  /**
   * Get provider name for logging/monitoring
   */
  getName(): string;
}
