/**
 * Selection Domain Types
 *
 * Core types for the entity selection system.
 * This module is UI-agnostic and has no dependencies on MapLibre or React.
 */

// ============================================================================
// Entity Reference
// ============================================================================

/**
 * Canonical reference to an entity.
 * Used throughout the application to identify communes and infra-zones.
 */
export type EntityRef =
    | { kind: "commune"; inseeCode: string }
    | { kind: "infraZone"; id: string }
    | { kind: "transactionAddress"; id: string; bundleZ: number; bundleX: number; bundleY: number };

/**
 * Check if two entity references are equal.
 */
export function entityRefEquals(a: EntityRef | null, b: EntityRef | null): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    if (a.kind !== b.kind) return false;
    if (a.kind === "commune" && b.kind === "commune") {
        return a.inseeCode === b.inseeCode;
    }
    if (a.kind === "infraZone" && b.kind === "infraZone") {
        return a.id === b.id;
    }
    if (a.kind === "transactionAddress" && b.kind === "transactionAddress") {
        return a.id === b.id;
    }
    return false;
}

/**
 * Get a stable string key for an entity reference.
 */
export function entityRefKey(ref: EntityRef): string {
    if (ref.kind === "commune") return `commune:${ref.inseeCode}`;
    if (ref.kind === "infraZone") return `infraZone:${ref.id}`;
    return `transactionAddress:${ref.id}`;
}

// ============================================================================
// Selection State
// ============================================================================

/**
 * Visual state of an entity (UI-agnostic).
 * - normal: default state
 * - highlight: emphasized (focus, search result)
 * - active: currently selected
 */
export type EntityVisualState = "normal" | "highlight" | "active";

/**
 * Current selection state snapshot.
 */
export type SelectionState = {
    /** Currently highlighted entity (focus, etc.) - at most one */
    highlighted: EntityRef | null;
    /** Currently active entity (selected) - at most one */
    active: EntityRef | null;
};

// ============================================================================
// Selection Events
// ============================================================================

/**
 * Events emitted by the selection service.
 */
export type SelectionEvent =
    | { type: "highlight"; entity: EntityRef | null; previous: EntityRef | null }
    | { type: "active"; entity: EntityRef | null; previous: EntityRef | null };

/**
 * Listener for selection state changes.
 */
export type SelectionListener = (event: SelectionEvent) => void;

// ============================================================================
// Entity Data Types
// ============================================================================

/**
 * Commune data as returned by the data provider.
 */
export type CommuneData = {
    inseeCode: string;
    name: string;
    departmentCode: string;
    regionCode: string;
    lat: number;
    lon: number;
    population: number | null;
};

/**
 * Infra-zone data as returned by the data provider.
 */
export type InfraZoneData = {
    id: string;
    type: string;
    code: string;
    parentCommuneCode: string;
    name: string;
    lat: number;
    lon: number;
    population: number | null;
};

/**
 * Transaction line as returned by the data provider.
 */
export type TransactionLine = {
    date: string;
    priceEur: number;
    typeLocal: "Maison" | "Appartement";
    surfaceM2: number | null;
    isVefa: boolean;
};

/**
 * Transaction address history as returned by the data provider.
 */
export type TransactionAddressData = {
    id: string;
    label: string;
    lat: number;
    lng: number;
    transactions: TransactionLine[];
};

/**
 * Union type for entity data with discriminant.
 */
export type EntityData =
    | { kind: "commune"; data: CommuneData }
    | { kind: "infraZone"; data: InfraZoneData }
    | { kind: "transactionAddress"; data: TransactionAddressData };
