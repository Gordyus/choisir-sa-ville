/**
 * Base Labels - Helpers to identify and target OpenMapTiles label layers.
 * Used for hitbox creation and styling.
 */

import type { LegacyFilterSpecification } from "maplibre-gl";

import { DEFAULT_PLACE_CLASSES } from "@/lib/map/registry/layerRegistry";

// ============================================================================
// Place Class Management
// ============================================================================

let currentPlaceClasses: string[] = [...DEFAULT_PLACE_CLASSES];
let placeClassSet = new Set(currentPlaceClasses);

/**
 * Set the list of place classes to target (city, town, village, etc.)
 */
export function setPlaceClasses(classes?: readonly string[]): void {
    if (!classes || !classes.length) {
        currentPlaceClasses = [...DEFAULT_PLACE_CLASSES];
    } else {
        const normalized = classes
            .map((c) => (typeof c === "string" ? c.trim().toLowerCase() : ""))
            .filter((c) => c.length > 0);
        currentPlaceClasses = normalized.length
            ? Array.from(new Set(normalized))
            : [...DEFAULT_PLACE_CLASSES];
    }
    placeClassSet = new Set(currentPlaceClasses);
}

/**
 * Get the current list of place classes
 */
export function getPlaceClasses(): readonly string[] {
    return currentPlaceClasses;
}

/**
 * Check if a place class is in the current list
 */
export function isPlaceClass(value: string): boolean {
    return placeClassSet.has(value.toLowerCase());
}

/**
 * Build a filter expression that includes the current place classes
 */
export function buildPlaceClassIncludeFilter(): LegacyFilterSpecification {
    return ["in", "class", ...currentPlaceClasses] as LegacyFilterSpecification;
}

/**
 * Build a filter expression that excludes the current place classes
 */
export function buildPlaceClassExcludeFilter(): LegacyFilterSpecification {
    return ["!in", "class", ...currentPlaceClasses] as LegacyFilterSpecification;
}
