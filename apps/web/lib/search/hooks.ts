"use client";

/**
 * React Hooks for Search Service
 *
 * Provides React integration via useSyncExternalStore.
 */

import { useCallback, useRef, useSyncExternalStore } from "react";

import { getSearchService } from "@/lib/search/searchService";
import type {
    SearchPhase,
    SearchProgress,
    SearchResult,
    SearchState,
} from "@/lib/search/types";
import { INITIAL_SEARCH_STATE } from "@/lib/search/types";

// ============================================================================
// useSearchState
// ============================================================================

/**
 * Subscribe to the full search state.
 * Re-renders on any state change.
 */
export function useSearchState(): SearchState {
    const service = getSearchService();
    const snapshotRef = useRef<SearchState | null>(null);
    const serverSnapshotRef = useRef<SearchState | null>(null);

    const subscribe = useCallback(
        (callback: () => void) => service.subscribe(callback),
        [service]
    );

    const getSnapshot = useCallback(() => {
        const next = service.getState();
        if (snapshotRef.current === null || !searchStatesEqual(snapshotRef.current, next)) {
            snapshotRef.current = next;
        }
        return snapshotRef.current;
    }, [service]);

    const getServerSnapshot = useCallback(() => {
        if (serverSnapshotRef.current === null) {
            serverSnapshotRef.current = { ...INITIAL_SEARCH_STATE };
        }
        return serverSnapshotRef.current;
    }, []);

    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// ============================================================================
// useSearchPhase
// ============================================================================

/**
 * Get the current search phase.
 */
export function useSearchPhase(): SearchPhase {
    const state = useSearchState();
    return state.phase;
}

// ============================================================================
// useSearchResults
// ============================================================================

/**
 * Get the current search results.
 */
export function useSearchResults(): SearchResult[] {
    const state = useSearchState();
    return state.results;
}

// ============================================================================
// useSearchProgress
// ============================================================================

/**
 * Get the current search progress (null when not computing).
 */
export function useSearchProgress(): SearchProgress | null {
    const state = useSearchState();
    return state.progress;
}

// ============================================================================
// Equality Check
// ============================================================================

function searchStatesEqual(a: SearchState, b: SearchState): boolean {
    return (
        a.phase === b.phase &&
        a.results === b.results &&
        a.progress === b.progress &&
        a.error === b.error &&
        a.criteria === b.criteria
    );
}
