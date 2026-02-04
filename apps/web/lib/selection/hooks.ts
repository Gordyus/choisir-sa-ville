"use client";

/**
 * React Hooks for Selection Service
 *
 * Provides React integration for the SelectionService.
 */

import { useCallback, useSyncExternalStore } from "react";

import { entityRefEquals, type EntityRef, type SelectionState } from "./types";
import { getSelectionService } from "./selectionService";

// ============================================================================
// useSelectionState Hook
// ============================================================================

/**
 * Subscribe to the entire selection state.
 * Re-renders when any selection changes.
 */
export function useSelectionState(): SelectionState {
    const service = getSelectionService();

    const subscribe = useCallback(
        (callback: () => void) => service.subscribe(callback),
        [service]
    );

    const getSnapshot = useCallback(() => service.getState(), [service]);

    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// ============================================================================
// useHighlightedEntity Hook
// ============================================================================

/**
 * Get the currently highlighted entity.
 */
export function useHighlightedEntity(): EntityRef | null {
    const state = useSelectionState();
    return state.highlighted;
}

// ============================================================================
// useActiveEntity Hook
// ============================================================================

/**
 * Get the currently active (selected) entity.
 */
export function useActiveEntity(): EntityRef | null {
    const state = useSelectionState();
    return state.active;
}

// ============================================================================
// useIsHighlighted Hook
// ============================================================================

/**
 * Check if a specific entity is highlighted.
 */
export function useIsHighlighted(ref: EntityRef | null): boolean {
    const state = useSelectionState();
    if (!ref || !state.highlighted) return false;
    return entityRefEquals(ref, state.highlighted);
}

// ============================================================================
// useIsActive Hook
// ============================================================================

/**
 * Check if a specific entity is active.
 */
export function useIsActive(ref: EntityRef | null): boolean {
    const state = useSelectionState();
    if (!ref || !state.active) return false;
    return entityRefEquals(ref, state.active);
}

// ============================================================================
// useSelectionActions Hook
// ============================================================================

export interface SelectionActions {
    setHighlighted: (ref: EntityRef | null) => void;
    setActive: (ref: EntityRef | null) => void;
    clearAll: () => void;
    activateHighlighted: () => void;
}

/**
 * Get selection action handlers.
 */
export function useSelectionActions(): SelectionActions {
    const service = getSelectionService();

    return {
        setHighlighted: useCallback(
            (ref: EntityRef | null) => service.setHighlighted(ref),
            [service]
        ),
        setActive: useCallback(
            (ref: EntityRef | null) => service.setActive(ref),
            [service]
        ),
        clearAll: useCallback(() => service.clearAll(), [service]),
        activateHighlighted: useCallback(() => {
            const state = service.getState();
            if (state.highlighted) {
                service.setActive(state.highlighted);
            }
        }, [service])
    };
}

// ============================================================================
// useSelection Hook (Combined)
// ============================================================================

export interface SelectionHook extends SelectionActions {
    highlighted: EntityRef | null;
    active: EntityRef | null;
}

/**
 * Combined hook for selection state and actions.
 */
export function useSelection(): SelectionHook {
    const state = useSelectionState();
    const actions = useSelectionActions();

    return {
        highlighted: state.highlighted,
        active: state.active,
        ...actions
    };
}
