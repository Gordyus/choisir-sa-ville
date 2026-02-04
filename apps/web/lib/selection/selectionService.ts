/**
 * Entity State Service
 *
 * Headless, UI-agnostic service for managing entity state (highlight, active).
 * No dependencies on MapLibre, React, or any UI framework.
 *
 * Renamed from SelectionService to reflect its broader role as the source
 * of truth for entity visual state, not just user selection.
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

export interface EntityStateService {
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

class EntityStateServiceImpl implements EntityStateService {
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
                    console.error("[EntityStateService] Listener threw error", error);
                }
            }
        }
    }
}

// ============================================================================
// Factory & Singleton
// ============================================================================

let globalInstance: EntityStateService | null = null;

/**
 * Create a new entity state service instance.
 */
export function createEntityStateService(): EntityStateService {
    return new EntityStateServiceImpl();
}

/**
 * Get the global entity state service instance (singleton).
 * Creates the instance on first access.
 */
export function getEntityStateService(): EntityStateService {
    if (!globalInstance) {
        globalInstance = createEntityStateService();
    }
    return globalInstance;
}

/**
 * Reset the global entity state service (useful for testing).
 */
export function resetEntityStateService(): void {
    if (globalInstance) {
        globalInstance.clearAll();
    }
    globalInstance = null;
}
