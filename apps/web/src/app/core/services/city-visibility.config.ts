import type { TierConfig } from './city-visibility.types';

/**
 * City markers display mode
 * 
 * DECISION: We rely on OpenStreetMap's basemap labels for city names at low/medium zoom.
 * Our custom city markers caused instability (pan-dependent visibility, wrong cities shown).
 * 
 * Modes:
 * - "none": No custom city markers (rely 100% on OSM basemap labels)
 * - "resultsOnly": Only show markers for search results and selected zones (RECOMMENDED)
 * - "all": Show all city markers with dynamic visibility (DEPRECATED - causes instability)
 */
export type CityMarkersMode = 'none' | 'resultsOnly' | 'all';

/**
 * Feature flag: City markers display mode
 * 
 * DEFAULT: "resultsOnly"
 * - Low/medium zoom: Use OSM basemap labels (stable, correct)
 * - Custom markers: Only for results/selection (adds product value)
 * 
 * Setting to "all" will re-enable the dynamic viewport-based city visibility,
 * but this is NOT recommended due to instability issues.
 */
export const CITY_MARKERS_MODE: CityMarkersMode = 'resultsOnly';

/**
 * Minimum zoom level for custom city markers (when mode is "all")
 * Below this zoom, always rely on OSM basemap labels
 * 
 * Recommended: 12 (very zoomed in, city detail level)
 */
export const MIN_ZOOM_FOR_CUSTOM_CITY_MARKERS = 12;

/**
 * Major cities bonus mapping (DEPRECATED - only used when mode is "all")
 * Maps city names (case-insensitive) to priority bonuses
 * POC: Small hardcoded whitelist to ensure major cities are always visible
 */
export const MAJOR_CITIES_BONUS: Record<string, number> = {
    'paris': 5,
    'marseille': 4,
    'lyon': 4,
    'toulouse': 3,
    'nice': 3,
    'nantes': 3,
    'montpellier': 3,
    'strasbourg': 3,
    'bordeaux': 3,
    'lille': 3
};

/**
 * Zoom tier configuration for progressive city visibility
 * 
 * Each tier defines:
 * - Zoom range (minZoom to maxZoom)
 * - Target maximum visible cities
 * - Grid cell size in pixels for distribution
 * - Maximum cities per grid cell
 */
export const ZOOM_TIERS: TierConfig[] = [
    {
        id: 'T0',
        minZoom: 0,
        maxZoom: 6,
        targetMaxVisibleCities: 1,
        gridCellSizePx: 220,
        maxCitiesPerCell: 2  // Increased from 1 to reduce bucket eviction at low zoom
    },
    {
        id: 'T1',
        minZoom: 6,
        maxZoom: 8,
        targetMaxVisibleCities: 1,
        gridCellSizePx: 180,
        maxCitiesPerCell: 1
    },
    {
        id: 'T2',
        minZoom: 8,
        maxZoom: 10,
        targetMaxVisibleCities: 1,
        gridCellSizePx: 140,
        maxCitiesPerCell: 1
    },
    {
        id: 'T3',
        minZoom: 10,
        maxZoom: 24,
        targetMaxVisibleCities: 1,
        gridCellSizePx: 110,
        maxCitiesPerCell: 2
    }
];

/**
 * Hysteresis margin to prevent tier flickering
 * Tier changes only when zoom crosses min/max ± margin
 */
export const HYSTERESIS_MARGIN = 0.3;

/**
 * Overscan factor to reduce flicker on small pans
 * Enlarges viewport bbox by this factor
 */
export const OVERSCAN_FACTOR = 1.2;

/**
 * Stickiness duration in milliseconds
 * Keep previous visible cities for this duration if still in viewport
 */
export const STICKINESS_DURATION_MS = 450;

/**
 * Stickiness score multiplier
 * New city must have score > oldScore * multiplier to replace
 */
export const STICKINESS_SCORE_MULTIPLIER = 1.15;
