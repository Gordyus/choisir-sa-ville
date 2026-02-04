/**
 * Selection Service
 *
 * Headless, UI-agnostic service for managing entity selection state.
 * No dependencies on MapLibre, React, or any UI framework.
 */

import {
    entityRefEquals,
    type EntityRef,
    type SelectionEvent,
    type SelectionListener,
    type SelectionState
} from "./types";

// ============================================================================
// Service Interface
// ============================================================================

export interface SelectionService {
    /** Get current state snapshot */
    getState(): SelectionState;

    /** Set highlighted entity (null to clear) */
    setHighlighted(entity: EntityRef | null): void;

    /** Set active entity (null to clear) */
    setActive(entity: EntityRef | null): void;

    /** Clear all selection state */
    clearAll(): void;

    /** Subscribe to state changes */
    subscribe(listener: SelectionListener): () => void;

    /** Check if an entity matches the current active selection */
    isActive(entity: EntityRef): boolean;

    /** Check if an entity matches the current highlighted selection */
    isHighlighted(entity: EntityRef): boolean;
}

// ============================================================================
// Implementation
// ============================================================================

class SelectionServiceImpl implements SelectionService {
    private state: SelectionState = {
        highlighted: null,
        active: null
    };

    private listeners = new Set<SelectionListener>();

    getState(): SelectionState {
        return { ...this.state };
    }

    setHighlighted(entity: EntityRef | null): void {
        const previous = this.state.highlighted;
        if (entityRefEquals(previous, entity)) {
            return;
        }
        this.state.highlighted = entity;
        this.emit({ type: "highlight", entity, previous });
    }

    setActive(entity: EntityRef | null): void {
        const previous = this.state.active;
        if (entityRefEquals(previous, entity)) {
            return;
        }
        this.state.active = entity;
        this.emit({ type: "active", entity, previous });
    }

    clearAll(): void {
        const hadHighlight = this.state.highlighted !== null;
        const hadActive = this.state.active !== null;

        if (hadHighlight) {
            const previous = this.state.highlighted;
            this.state.highlighted = null;
            this.emit({ type: "highlight", entity: null, previous });
        }

        if (hadActive) {
            const previous = this.state.active;
            this.state.active = null;
            this.emit({ type: "active", entity: null, previous });
        }
    }

    subscribe(listener: SelectionListener): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    isActive(entity: EntityRef): boolean {
        return entityRefEquals(this.state.active, entity);
    }

    isHighlighted(entity: EntityRef): boolean {
        return entityRefEquals(this.state.highlighted, entity);
    }

    private emit(event: SelectionEvent): void {
        for (const listener of this.listeners) {
            try {
                listener(event);
            } catch (error) {
                if (process.env.NODE_ENV === "development") {
                    console.error("[SelectionService] Listener threw error", error);
                }
            }
        }
    }
}

// ============================================================================
// Factory & Singleton
// ============================================================================

let globalInstance: SelectionService | null = null;

/**
 * Create a new selection service instance.
 */
export function createSelectionService(): SelectionService {
    return new SelectionServiceImpl();
}

/**
 * Get the global selection service instance (singleton).
 * Creates the instance on first access.
 */
export function getSelectionService(): SelectionService {
    if (!globalInstance) {
        globalInstance = createSelectionService();
    }
    return globalInstance;
}

/**
 * Reset the global selection service (useful for testing).
 */
export function resetSelectionService(): void {
    if (globalInstance) {
        globalInstance.clearAll();
    }
    globalInstance = null;
}
