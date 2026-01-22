/**
 * City visibility system types for progressive map rendering
 */

/** City data structure */
export interface City {
    id: string;
    name: string;
    lat: number;
    lon: number;
    population?: number;
}

/** City with computed score/priority */
export interface CityWithScore extends City {
    score: number;
}

/** Geographic bounding box */
export interface BBox {
    west: number;
    south: number;
    east: number;
    north: number;
}

/** Screen-space projection function */
export type ProjectionFn = (lat: number, lon: number) => { x: number; y: number };

/** Zoom tier configuration */
export interface TierConfig {
    id: string;
    minZoom: number;
    maxZoom: number;
    targetMaxVisibleCities: number;
    gridCellSizePx: number;
    maxCitiesPerCell: number;
}

/** Hysteresis state for tier transitions */
export interface TierState {
    currentTierId: string | null;
    lastTransitionTime: number;
}

/** Visibility state tracking */
export interface VisibilityState {
    tierId: string;
    visibleCityIds: Set<string>;
    lastUpdateTime: number;
    previousVisibleCityIds: Set<string>;
    previousUpdateTime: number;
}

/** Input for visibility computation */
export interface ComputeVisibleCitiesInput {
    cities: City[];
    zoom: number;
    viewport: BBox;
    projection: ProjectionFn;
    tierState: TierState;
    visibilityState: VisibilityState | null;
}

/** Result of visibility computation */
export interface ComputeVisibleCitiesResult {
    visibleCities: City[];
    tierState: TierState;
    visibilityState: VisibilityState;
}

/** Cell key for grid-based distribution */
export interface CellKey {
    x: number;
    y: number;
}

/** City with computed priority (deprecated, use CityWithScore) */
export type CityWithPriority = CityWithScore;
