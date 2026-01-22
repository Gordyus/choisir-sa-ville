import { Injectable } from '@angular/core';
import type L from 'leaflet';
import { CityVisibilityService } from './city-visibility.service';
import type {
    BBox,
    City,
    ProjectionFn,
    TierState,
    VisibilityState
} from './city-visibility.types';

/**
 * Leaflet integration for city visibility system
 * Handles map events and city marker updates
 */
@Injectable({
    providedIn: 'root'
})
export class CityVisibilityLeafletService {
    private tierState: TierState = {
        currentTierId: null,
        lastTransitionTime: 0
    };

    private visibilityState: VisibilityState | null = null;

    constructor(private readonly cityVisibility: CityVisibilityService) { }

    /**
     * Update visible cities based on current map state
     * Call this on moveend and zoomend events
     */
    updateVisibleCities(
        map: L.Map,
        allCities: City[],
        onUpdate: (visibleCities: City[]) => void
    ): void {
        // Extract map state
        const zoom = map.getZoom();
        const bounds = map.getBounds();
        const viewport: BBox = {
            west: bounds.getWest(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            north: bounds.getNorth()
        };

        // Create projection function
        const projection: ProjectionFn = (lat: number, lon: number) => {
            const point = map.latLngToContainerPoint([lat, lon]);
            return { x: point.x, y: point.y };
        };

        // Compute visible cities
        const result = this.cityVisibility.computeVisibleCities({
            cities: allCities,
            zoom,
            viewport,
            projection,
            tierState: this.tierState,
            visibilityState: this.visibilityState
        });

        // Update state
        this.tierState = result.tierState;
        this.visibilityState = result.visibilityState;

        // Notify caller
        onUpdate(result.visibleCities);
    }

    /**
     * Reset visibility state (e.g., when city data changes)
     */
    reset(): void {
        this.tierState = {
            currentTierId: null,
            lastTransitionTime: 0
        };
        this.visibilityState = null;
    }

    /**
     * Get current tier state (for debugging/testing)
     */
    getCurrentTierState(): TierState {
        return { ...this.tierState };
    }

    /**
     * Get current visibility state (for debugging/testing)
     */
    getCurrentVisibilityState(): VisibilityState | null {
        return this.visibilityState
            ? {
                ...this.visibilityState,
                visibleCityIds: new Set(this.visibilityState.visibleCityIds),
                previousVisibleCityIds: new Set(this.visibilityState.previousVisibleCityIds)
            }
            : null;
    }
}
