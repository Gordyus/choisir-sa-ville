/**
 * Selection Module - Public Exports
 */

export {
    entityRefEquals,
    entityRefKey,
    type CommuneData,
    type EntityData,
    type EntityRef,
    type EntityVisualState,
    type InfraZoneData,
    type SelectionEvent,
    type SelectionListener,
    type SelectionState
} from "./types";

export {
    createSelectionService,
    getSelectionService,
    resetSelectionService,
    type SelectionService
} from "./selectionService";

// React Hooks
export {
    useActiveEntity, useHighlightedEntity, useIsActive, useIsHighlighted, useSelection, useSelectionActions, useSelectionState, type SelectionActions,
    type SelectionHook
} from "./hooks";

