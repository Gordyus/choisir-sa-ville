/**
 * Search Module — Barrel Export
 *
 * Public API for the guided multi-criteria search feature.
 */

// Types
export type {
    BanSuggestion,
    Destination,
    LivingPreference,
    SearchCriteria,
    SearchError,
    SearchPhase,
    SearchProgress,
    SearchResult,
    SearchState,
} from "./types";

export { DEFAULT_CRITERIA, INITIAL_SEARCH_STATE } from "./types";

// BAN Geocoding
export { searchAddress } from "./banGeocode";

// Geo Filter
export { filterCommunesByGeo } from "./geoFilter";

// Batch Orchestrator
export { executeBatchRouting } from "./batchOrchestrator";

// Scoring
export { scoreResults } from "./scoring";

// Search Service
export type { SearchService } from "./searchService";
export {
    createSearchService,
    getSearchService,
    resetSearchService,
} from "./searchService";

// React Hooks
export {
    useSearchPhase,
    useSearchProgress,
    useSearchResults,
    useSearchState,
} from "./hooks";
