/**
 * Routing Provider Interface
 * 
 * Abstraction layer for external routing APIs (TomTom, Navitia, etc.).
 * Implements the Adapter pattern to decouple business logic from provider-specific code.
 * 
 * Two distinct operations:
 * - calculateMatrix: Bulk time/distance calculations (no geometry, fast, cacheable)
 * - calculateRoute: Single route with geometry for map display (on-demand)
 */

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface MatrixParams {
  origins: Coordinates[];
  destinations: Coordinates[];
  departureTime?: string; // ISO 8601, mutually exclusive with arrivalTime
  arrivalTime?: string;   // ISO 8601, mutually exclusive with departureTime
  mode: 'car' | 'truck' | 'pedestrian';
}

export interface MatrixResult {
  durations: number[][]; // Seconds (origins x destinations)
  distances: number[][]; // Meters (origins x destinations)
}

export interface RouteParams {
  origin: Coordinates;
  destination: Coordinates;
  departureTime?: string;
  arrivalTime?: string;
  mode: 'car' | 'truck' | 'pedestrian';
}

export interface RouteResult {
  duration: number;  // Seconds
  distance: number;  // Meters
  geometry: {
    type: 'LineString';
    coordinates: [number, number][]; // [lng, lat] GeoJSON format (MapLibre-ready)
  };
}

export interface RoutingProvider {
  /**
   * Calculate travel time/distance matrix (no geometry, optimized for bulk)
   */
  calculateMatrix(params: MatrixParams): Promise<MatrixResult>;

  /**
   * Calculate a single route with full geometry for map display
   */
  calculateRoute(params: RouteParams): Promise<RouteResult>;

  /**
   * Get provider name for logging/monitoring
   */
  getName(): string;
}
