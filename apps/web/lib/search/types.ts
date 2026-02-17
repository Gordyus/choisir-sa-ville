/**
 * Search Types
 *
 * Core types for the guided multi-criteria search feature.
 * No dependencies — pure TypeScript definitions.
 */

// ============================================================================
// Search Phase
// ============================================================================

export type SearchPhase = "idle" | "form" | "computing" | "results";

// ============================================================================
// Search Criteria
// ============================================================================

export type Destination = {
    lat: number;
    lng: number;
    label: string;
};

export type LivingPreference = "urban" | "rural" | "any";

export type SearchCriteria = {
    destination: Destination | null;
    maxTravelMinutes: number;
    radiusKm: number;
    minSecurityLevel: number | null;
    livingPreference: LivingPreference;
};

// ============================================================================
// Search Result
// ============================================================================

export type SearchResult = {
    inseeCode: string;
    communeName: string;
    travelSeconds: number;
    securityLevel: number | null;
    population: number | null;
    score: number;
};

// ============================================================================
// Search Progress
// ============================================================================

export type SearchProgress = {
    totalBatches: number;
    completedBatches: number;
    totalCommunes: number;
    analyzedCommunes: number;
};

// ============================================================================
// Search Error
// ============================================================================

export type SearchError = {
    message: string;
    failedBatches: number;
    hasPartialResults: boolean;
};

// ============================================================================
// Search State
// ============================================================================

export type SearchState = {
    phase: SearchPhase;
    criteria: SearchCriteria;
    results: SearchResult[];
    progress: SearchProgress | null;
    error: SearchError | null;
};

// ============================================================================
// BAN Geocoding
// ============================================================================

export type BanSuggestion = {
    label: string;
    lat: number;
    lng: number;
    type: string;
    city: string;
    postcode: string;
};

// ============================================================================
// Defaults
// ============================================================================

export const DEFAULT_CRITERIA: SearchCriteria = {
    destination: null,
    maxTravelMinutes: 30,
    radiusKm: 10,
    minSecurityLevel: null,
    livingPreference: "any"
};

export const INITIAL_SEARCH_STATE: SearchState = {
    phase: "idle",
    criteria: { ...DEFAULT_CRITERIA },
    results: [],
    progress: null,
    error: null
};
