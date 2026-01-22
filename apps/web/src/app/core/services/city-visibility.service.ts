import { Injectable } from '@angular/core';
import {
    HYSTERESIS_MARGIN,
    MAJOR_CITIES_BONUS,
    OVERSCAN_FACTOR,
    STICKINESS_DURATION_MS,
    STICKINESS_SCORE_MULTIPLIER,
    ZOOM_TIERS
} from './city-visibility.config';
import type {
    BBox,
    City,
    CityWithScore,
    ComputeVisibleCitiesInput,
    ComputeVisibleCitiesResult,
    TierConfig,
    TierState,
    VisibilityState
} from './city-visibility.types';

/**
 * Pure service for computing city visibility based on zoom and viewport
 * No Leaflet dependencies - fully unit testable
 */
@Injectable({
    providedIn: 'root'
})
export class CityVisibilityService {
    /**
     * Compute which cities should be visible for the current viewport and zoom
     * Result is deterministic: same input => same output in same order
     */
    computeVisibleCities(input: ComputeVisibleCitiesInput): ComputeVisibleCitiesResult {
        const now = Date.now();

        // Step 1: Determine tier with hysteresis
        const tierResult = this.getTierForZoom(input.zoom, input.tierState);
        const tier = tierResult.tier;

        // Step 2: Build overscanned bbox
        const overscannedBbox = this.overscanBbox(input.viewport);

        // Step 3: Filter cities in overscanned bbox
        const citiesInBbox = input.cities.filter((city) =>
            this.isInBbox(city.lat, city.lon, overscannedBbox)
        );

        // Compute priority for all cities
        const citiesWithPriority = citiesInBbox.map((city) => ({
            ...city,
            score: this.computeScore(city)
        }));

        // Step 4: Grid-based distribution
        const gridSelected = this.selectCitiesByGrid(
            citiesWithPriority,
            input.projection,
            tier
        );

        // Step 5: Apply global budget
        let finalCities = gridSelected;
        if (finalCities.length > tier.targetMaxVisibleCities) {
            finalCities = this.sortByTieBreaker(finalCities).slice(
                0,
                tier.targetMaxVisibleCities
            );
        }

        // Step 6: Apply stickiness (optional but recommended)
        if (input.visibilityState && tier.id === input.visibilityState.tierId) {
            finalCities = this.applyStickiness(
                finalCities,
                input.visibilityState,
                citiesWithPriority,
                now,
                overscannedBbox
            );
        }

        // Step 7: Update visibility state
        const visibilityState: VisibilityState = {
            tierId: tier.id,
            visibleCityIds: new Set(finalCities.map((c) => c.id)),
            lastUpdateTime: now,
            previousVisibleCityIds: input.visibilityState?.visibleCityIds ?? new Set(),
            previousUpdateTime: input.visibilityState?.lastUpdateTime ?? now
        };

        // Step 8: Sort final result by tie-breaker for consistent order
        const sortedFinalCities = this.sortByTieBreaker(finalCities);

        return {
            visibleCities: sortedFinalCities,
            tierState: tierResult.state,
            visibilityState
        };
    }

    /**
     * Get tier for zoom level with hysteresis to prevent flickering
     */
    getTierForZoom(
        zoom: number,
        state: TierState
    ): { tier: TierConfig; state: TierState } {
        const currentTier = state.currentTierId
            ? ZOOM_TIERS.find((t) => t.id === state.currentTierId)
            : null;

        // If we have a current tier, check if we should stay in it (hysteresis)
        if (currentTier) {
            const stayInMin = currentTier.minZoom - HYSTERESIS_MARGIN;
            const stayInMax = currentTier.maxZoom + HYSTERESIS_MARGIN;

            if (zoom >= stayInMin && zoom <= stayInMax) {
                // Stay in current tier
                return {
                    tier: currentTier,
                    state
                };
            }
        }

        // Find new tier based on zoom
        const newTier = this.findTierForZoom(zoom);

        return {
            tier: newTier,
            state: {
                currentTierId: newTier.id,
                lastTransitionTime: Date.now()
            }
        };
    }

    /**
     * Find tier that contains the given zoom level
     */
    private findTierForZoom(zoom: number): TierConfig {
        for (const tier of ZOOM_TIERS) {
            if (zoom >= tier.minZoom && zoom <= tier.maxZoom) {
                return tier;
            }
        }
        // Fallback to first or last tier
        return zoom < ZOOM_TIERS[0].minZoom
            ? ZOOM_TIERS[0]
            : ZOOM_TIERS[ZOOM_TIERS.length - 1];
    }

    /**
     * Compute robust score for a city
     * Score = base + majorCityBonus
     * base = log10(population) if population > 0, else 0
     * majorCityBonus = bonus from MAJOR_CITIES_BONUS map if city name matches
     * 
     * This ensures major cities like Paris rank above small communes
     * even if population data is missing
     */
    computeScore(city: City): number {
        const base = (city.population && city.population > 0) ? Math.log10(city.population) : 0;

        const cityNameLower = city.name.trim().toLowerCase();
        const bonus = MAJOR_CITIES_BONUS[cityNameLower] ?? 0;

        return base + bonus;
    }

    /**
     * Compute priority for a city (deprecated, use computeScore)
     * If population exists and > 0: log10(population)
     * Otherwise: 1
     */
    computePriority(city: City): number {
        if (city.population && city.population > 0) {
            return Math.log10(city.population);
        }
        return 1;
    }

    /**
     * Overscan the viewport bbox to reduce flicker on small pans
     */
    private overscanBbox(bbox: BBox): BBox {
        const widthDelta = ((bbox.east - bbox.west) * (OVERSCAN_FACTOR - 1)) / 2;
        const heightDelta = ((bbox.north - bbox.south) * (OVERSCAN_FACTOR - 1)) / 2;

        return {
            west: bbox.west - widthDelta,
            south: bbox.south - heightDelta,
            east: bbox.east + widthDelta,
            north: bbox.north + heightDelta
        };
    }

    /**
     * Check if a point is inside a bbox
     */
    private isInBbox(lat: number, lon: number, bbox: BBox): boolean {
        return lat >= bbox.south && lat <= bbox.north && lon >= bbox.west && lon <= bbox.east;
    }

    /**
     * Select cities using grid-based distribution
     * Projects cities to screen space, groups by grid cells,
     * and keeps top N per cell
     */
    private selectCitiesByGrid(
        cities: CityWithScore[],
        projection: (lat: number, lon: number) => { x: number; y: number },
        tier: TierConfig
    ): CityWithScore[] {
        const cellSize = tier.gridCellSizePx;
        const cellMap = new Map<string, CityWithScore[]>();

        // Group cities by grid cell
        for (const city of cities) {
            const screenPos = projection(city.lat, city.lon);
            const cellX = Math.floor(screenPos.x / cellSize);
            const cellY = Math.floor(screenPos.y / cellSize);
            const cellKey = `${cellX},${cellY}`;

            if (!cellMap.has(cellKey)) {
                cellMap.set(cellKey, []);
            }
            cellMap.get(cellKey)!.push(city);
        }

        // Select top cities from each cell
        const selected: CityWithScore[] = [];
        for (const cellCities of cellMap.values()) {
            const sorted = this.sortByTieBreaker(cellCities);
            const toKeep = sorted.slice(0, tier.maxCitiesPerCell);
            selected.push(...toKeep);
        }

        return selected;
    }

    /**
     * Apply stickiness: keep previous visible cities if still in viewport
     * and not replaced by significantly better cities
     */
    private applyStickiness(
        newCities: CityWithScore[],
        prevState: VisibilityState,
        allCitiesInBbox: CityWithScore[],
        now: number,
        bbox: BBox
    ): CityWithScore[] {
        const timeSinceLastUpdate = now - prevState.lastUpdateTime;
        if (timeSinceLastUpdate > STICKINESS_DURATION_MS) {
            // Stickiness expired
            return newCities;
        }

        const newCityIds = new Set(newCities.map((c) => c.id));
        const prevCityIds = prevState.previousVisibleCityIds;

        // Find cities that were visible before but not selected now
        const droppedCities = allCitiesInBbox.filter(
            (c) => prevCityIds.has(c.id) && !newCityIds.has(c.id)
        );

        if (droppedCities.length === 0) {
            return newCities;
        }

        // Try to keep dropped cities if their score is competitive
        const result = [...newCities];
        const cityScoreMap = new Map(allCitiesInBbox.map((c) => [c.id, c.score]));

        for (const dropped of droppedCities) {
            // Check if still in viewport
            if (!this.isInBbox(dropped.lat, dropped.lon, bbox)) {
                continue;
            }

            // Find if there's a new city in result with lower score
            const droppedScore = dropped.score;
            let replaced = false;

            for (let i = 0; i < result.length; i++) {
                const candidate = result[i];
                const candidateScore = cityScoreMap.get(candidate.id) ?? 0;

                // New city must be significantly better to replace old one
                if (candidateScore < droppedScore * STICKINESS_SCORE_MULTIPLIER) {
                    result[i] = dropped;
                    replaced = true;
                    break;
                }
            }

            if (!replaced && result.length < allCitiesInBbox.length) {
                // Add back if we have room
                result.push(dropped);
            }
        }

        return result;
    }

    /**
     * Sort cities by tie-breaker rules
     * 1) score DESC
     * 2) population DESC (undefined = -1)
     * 3) name ASC
     * 4) id ASC
     */
    private sortByTieBreaker<T extends City & { score: number }>(cities: T[]): T[] {
        return [...cities].sort((a, b) => {
            // 1. Score DESC
            if (a.score !== b.score) {
                return b.score - a.score;
            }

            // 2. Population DESC (undefined = -1)
            const popA = a.population ?? -1;
            const popB = b.population ?? -1;
            if (popA !== popB) {
                return popB - popA;
            }

            // 3. Name ASC
            const nameCompare = a.name.localeCompare(b.name);
            if (nameCompare !== 0) {
                return nameCompare;
            }

            // 4. ID ASC
            return a.id.localeCompare(b.id);
        });
    }

    /**
     * Debug helper (dev-only)
     * Given a city name, logs:
     * - computed score
     * - bucket key at given zoom level
     * - top 10 candidates in that bucket with scores
     */
    debugCityVisibility(
        cityName: string,
        allCities: City[],
        zoom: number,
        projection: (lat: number, lon: number) => { x: number; y: number }
    ): void {
        // Find matching city
        const cityNameLower = cityName.toLowerCase().trim();
        const targetCity = allCities.find(
            (c) => c.name.toLowerCase().trim() === cityNameLower
        );

        if (!targetCity) {
            console.log(`[CityVisibility Debug] City not found: ${cityName}`);
            return;
        }

        const score = this.computeScore(targetCity);
        const tier = this.findTierForZoom(zoom);
        const screenPos = projection(targetCity.lat, targetCity.lon);
        const cellSize = tier.gridCellSizePx;
        const cellX = Math.floor(screenPos.x / cellSize);
        const cellY = Math.floor(screenPos.y / cellSize);
        const bucketKey = `${cellX},${cellY}`;

        // Find all cities in the same bucket
        const citiesInBucket = allCities
            .filter((city) => {
                const pos = projection(city.lat, city.lon);
                const x = Math.floor(pos.x / cellSize);
                const y = Math.floor(pos.y / cellSize);
                return x === cellX && y === cellY;
            })
            .map((city) => ({
                ...city,
                score: this.computeScore(city)
            }))
            .sort((a, b) => b.score - a.score);

        console.log(`[CityVisibility Debug] ${cityName}:`);
        console.log(`  Score: ${score}`);
        console.log(`  Tier: ${tier.id} (maxCitiesPerCell: ${tier.maxCitiesPerCell})`);
        console.log(`  Bucket Key: ${bucketKey}`);
        console.log(`  Cities in bucket (top 10):`);
        citiesInBucket.slice(0, 10).forEach((city, idx) => {
            const marker = city.id === targetCity.id ? ' <-- TARGET' : '';
            console.log(`    ${idx + 1}. ${city.name} (score: ${city.score.toFixed(2)}, pop: ${city.population ?? 'N/A'})${marker}`);
        });
    }
}
