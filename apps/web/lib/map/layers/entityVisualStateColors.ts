/**
 * Centralized visual state colors for all map entities.
 * Used by both label layers (text-color) and point layers (circle-color).
 * Ensures visual consistency across all interactive entities.
 */

export const ENTITY_STATE_COLORS = {
    /** Default state - entity without data */
    noData: "#6b7280",
    /** Entity has data in our dataset */
    hasData: "#111827",
    /** Hovered / focused entity */
    highlight: "#2563eb",
    /** Selected / active entity */
    active: "#f59e0b"
} as const;
