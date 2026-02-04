"use client";

/**
 * React Hooks for Selection Service
 *
 * Provides React integration for the SelectionService.
 */

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

import { getSelectionService } from "./selectionService";
import { entityRefEquals, type EntityRef, type SelectionState } from "./types";

// ============================================================================
// useSelectionState Hook
// ============================================================================

/**
 * Subscribe to the entire selection state.
 * Re-renders when any selection changes.
 */
export function useSelectionState(): SelectionState {
    const service = getSelectionService();
    const serverSnapshotCache = useRef<SelectionState | null>(null);
    const snapshotRef = useRef<SelectionState | null>(null);

    const readSnapshot = useCallback(() => {
        const next = service.getState();
        if (!snapshotRef.current || !selectionStatesEqual(snapshotRef.current, next)) {
            snapshotRef.current = next;
        }
        return snapshotRef.current;
    }, [service]);

    const subscribe = useCallback(
        (callback: () => void) => service.subscribe(callback),
        [service]
    );

    const getSnapshot = readSnapshot;
    const getServerSnapshot = useCallback(() => {
        if (serverSnapshotCache.current === null) {
            serverSnapshotCache.current = readSnapshot();
        }
        return serverSnapshotCache.current;
    }, [readSnapshot]);

    useEffect(() => {
        serverSnapshotCache.current = null;
        snapshotRef.current = null;
    }, [service]);

    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
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
 * Get the currently active entity.
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

function selectionStatesEqual(a: SelectionState | null, b: SelectionState | null): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    return entityRefsEqual(a.highlighted, b.highlighted) && entityRefsEqual(a.active, b.active);
}

function entityRefsEqual(a: EntityRef | null, b: EntityRef | null): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    return entityRefEquals(a, b);
}
