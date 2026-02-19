/**
 * Search Service
 *
 * Observable singleton service for managing the guided multi-criteria search.
 * Follows the same pattern as selectionService.ts and displayModeService.ts.
 *
 * No React or MapLibre dependencies — pure TypeScript.
 */

import { loadCommunesIndexLite } from "@/lib/data/communesIndexLite";
import { getLatestInsecurityYear, loadInsecurityYear } from "@/lib/data/insecurityMetrics";
import { executeBatchRouting } from "@/lib/search/batchOrchestrator";
import { filterCommunesByGeo } from "@/lib/search/geoFilter";
import { scoreResults } from "@/lib/search/scoring";
import {
    INITIAL_SEARCH_STATE,
    type SearchCriteria,
    type SearchResult,
    type SearchState,
} from "@/lib/search/types";

// ============================================================================
// Types
// ============================================================================

type SearchStateListener = (state: SearchState) => void;

// ============================================================================
// Service Interface
// ============================================================================

export interface SearchService {
    /** Get current state snapshot */
    getState(): SearchState;

    /** Subscribe to state changes. Returns unsubscribe function. */
    subscribe(listener: SearchStateListener): () => void;

    /** Start a new search with the given criteria */
    startSearch(criteria: SearchCriteria): void;

    /** Cancel the current search */
    cancelSearch(): void;

    /** Reset to initial state */
    reset(): void;

    /** Get current results (convenience accessor) */
    getResults(): SearchResult[];
}

// ============================================================================
// Implementation
// ============================================================================

class SearchServiceImpl implements SearchService {
    private state: SearchState = { ...INITIAL_SEARCH_STATE };
    private listeners = new Set<SearchStateListener>();
    private abortController: AbortController | null = null;

    getState(): SearchState {
        return { ...this.state };
    }

    subscribe(listener: SearchStateListener): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    startSearch(criteria: SearchCriteria): void {
        // Cancel any in-progress search
        this.abortCurrent();

        if (criteria.destination === null) {
            return;
        }

        const controller = new AbortController();
        this.abortController = controller;

        this.setState({
            ...this.state,
            phase: "computing",
            criteria: { ...criteria },
            results: [],
            progress: null,
            error: null,
        });

        this.executeSearch(criteria, controller.signal).catch(() => {
            // Errors are handled inside executeSearch
        });
    }

    cancelSearch(): void {
        this.abortCurrent();
        this.setState({
            ...this.state,
            phase: "form",
            progress: null,
            error: null,
        });
    }

    reset(): void {
        this.abortCurrent();
        this.setState({ ...INITIAL_SEARCH_STATE });
    }

    getResults(): SearchResult[] {
        return [...this.state.results];
    }

    // ========================================================================
    // Private
    // ========================================================================

    private async executeSearch(
        criteria: SearchCriteria,
        signal: AbortSignal
    ): Promise<void> {
        try {
            // Destination is guaranteed non-null by startSearch guard
            const destination = criteria.destination!;

            // Step 1: Load data in parallel
            const [communesIndex, latestYear] = await Promise.all([
                loadCommunesIndexLite(signal),
                getLatestInsecurityYear(signal),
            ]);

            if (signal.aborted) return;

            const insecurityData = await loadInsecurityYear(latestYear, signal);

            if (signal.aborted) return;

            // Step 2: Pre-filter communes by geo + criteria
            const filteredCommunes = filterCommunesByGeo({
                communes: communesIndex,
                destination,
                radiusKm: criteria.radiusKm,
                minSecurityLevel: criteria.minSecurityLevel,
                livingPreference: criteria.livingPreference,
                insecurityData,
            });

            if (signal.aborted) return;

            if (filteredCommunes.length === 0) {
                this.setState({
                    ...this.state,
                    phase: "results",
                    results: [],
                    progress: null,
                    error: null,
                });
                return;
            }

            // Step 3: Batch routing (sequential per target to avoid API overload)
            const skipTravelFilter = criteria.travelTimeTargets.length === 0;
            const travelTimesPerTarget: Array<Map<string, number>> = [];

            if (!skipTravelFilter) {
                // Compute total batches across all targets for global progress
                const batchSize = 10;
                const batchesPerTarget = Math.ceil(filteredCommunes.length / batchSize);
                const totalBatchesGlobal = batchesPerTarget * criteria.travelTimeTargets.length;
                let completedBatchesGlobal = 0;

                for (const target of criteria.travelTimeTargets) {
                    if (signal.aborted) return;

                    const targetTravelTimes = await executeBatchRouting({
                        communes: filteredCommunes,
                        destination: target.destination,
                        mode: target.mode,
                        signal,
                        onProgress: (progress) => {
                            if (!signal.aborted) {
                                this.setState({
                                    ...this.state,
                                    progress: {
                                        totalBatches: totalBatchesGlobal,
                                        completedBatches: completedBatchesGlobal + progress.completedBatches,
                                        totalCommunes: progress.totalCommunes,
                                        analyzedCommunes: progress.analyzedCommunes,
                                    },
                                });
                            }
                        },
                    });

                    completedBatchesGlobal += batchesPerTarget;
                    travelTimesPerTarget.push(targetTravelTimes);
                }
            }

            if (signal.aborted) return;

            // Step 4: Score and rank results
            const results = scoreResults({
                travelTimesPerTarget,
                communes: filteredCommunes,
                insecurityData,
                criteria,
                skipTravelFilter,
            });

            this.setState({
                ...this.state,
                phase: "results",
                results,
                progress: null,
                error: null,
            });
        } catch (error: unknown) {
            if (signal.aborted) return;

            const message =
                error instanceof Error ? error.message : "An unexpected error occurred";

            this.setState({
                ...this.state,
                phase: "results",
                error: {
                    message,
                    failedBatches: 0,
                    hasPartialResults: this.state.results.length > 0,
                },
                progress: null,
            });
        }
    }

    private abortCurrent(): void {
        if (this.abortController !== null) {
            this.abortController.abort();
            this.abortController = null;
        }
    }

    private setState(next: SearchState): void {
        this.state = next;
        this.notify();
    }

    private notify(): void {
        for (const listener of this.listeners) {
            try {
                listener(this.getState());
            } catch (error) {
                if (process.env.NODE_ENV === "development") {
                    console.error("[SearchService] Listener threw error", error);
                }
            }
        }
    }
}

// ============================================================================
// Factory & Singleton
// ============================================================================

let globalInstance: SearchService | null = null;

/**
 * Create a new SearchService instance.
 */
export function createSearchService(): SearchService {
    return new SearchServiceImpl();
}

/**
 * Get the global SearchService singleton.
 * Creates the instance on first access.
 */
export function getSearchService(): SearchService {
    if (globalInstance === null) {
        globalInstance = createSearchService();
    }
    return globalInstance;
}

/**
 * Reset the global SearchService (useful for testing).
 */
export function resetSearchService(): void {
    if (globalInstance !== null) {
        globalInstance.reset();
    }
    globalInstance = null;
}
