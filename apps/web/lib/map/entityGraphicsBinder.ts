/**
 * Entity Graphics Binder
 *
 * Binds entity state (highlight, active) to map graphics (labels + polygons).
 * This is the ONLY module that calls setFeatureState for highlight/active.
 *
 * Subscribes to EntityStateService and applies feature-state to:
 * - Label targets (dynamic, provided by LabelHasDataEvaluator)
 * - Polygon targets (deterministic, constructed from EntityRef + source config)
 */

import type { Map as MapLibreMap } from "maplibre-gl";

import { getArmInseeCodeById } from "@/lib/data/infraZonesIndexLite";
import { getEntityStateService, type EntityRef } from "@/lib/selection";

import { SOURCE_IDS, SOURCE_LAYERS } from "./registry/layerRegistry";

// ============================================================================
// Types
// ============================================================================

export type FeatureStateTarget = {
    source: string;
    sourceLayer?: string;
    id: string | number;
};

export type GetLabelTargetForEntity = (entity: EntityRef | null) => FeatureStateTarget | null;

export type EntityGraphicsBinderOptions = {
    getLabelTargetForEntity: GetLabelTargetForEntity;
};

type FeatureStateHandles = {
    highlightLabelTarget: FeatureStateTarget | null;
    highlightPolygonTarget: FeatureStateTarget | null;
    activeLabelTarget: FeatureStateTarget | null;
    activePolygonTarget: FeatureStateTarget | null;
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Attach the entity graphics binder to a MapLibre map.
 * Returns a cleanup function to call on unmount.
 */
export function attachEntityGraphicsBinder(
    map: MapLibreMap,
    options: EntityGraphicsBinderOptions
): () => void {
    const entityStateService = getEntityStateService();
    const { getLabelTargetForEntity } = options;

    const handles: FeatureStateHandles = {
        highlightLabelTarget: null,
        highlightPolygonTarget: null,
        activeLabelTarget: null,
        activePolygonTarget: null
    };

    let disposed = false;

    const syncState = (): void => {
        if (disposed) {
            return;
        }

        const state = entityStateService.getState();

        // Sync highlight state
        void syncEntityTargets(
            map,
            handles,
            "highlight",
            state.highlighted,
            getLabelTargetForEntity
        );

        // Sync active state
        void syncEntityTargets(
            map,
            handles,
            "active",
            state.active,
            getLabelTargetForEntity
        );
    };

    const unsubscribe = entityStateService.subscribe(syncState);

    // Initial sync
    syncState();

    return () => {
        disposed = true;
        unsubscribe();

        // Clear all feature states on cleanup
        clearFeatureState(map, handles.highlightLabelTarget, "highlight");
        clearFeatureState(map, handles.highlightPolygonTarget, "highlight");
        clearFeatureState(map, handles.activeLabelTarget, "active");
        clearFeatureState(map, handles.activePolygonTarget, "active");
    };
}

// ============================================================================
// Internal Sync Logic
// ============================================================================

async function syncEntityTargets(
    map: MapLibreMap,
    handles: FeatureStateHandles,
    stateKey: "highlight" | "active",
    entity: EntityRef | null,
    getLabelTargetForEntity: GetLabelTargetForEntity
): Promise<void> {
    const labelHandleKey = stateKey === "highlight" ? "highlightLabelTarget" : "activeLabelTarget";
    const polygonHandleKey = stateKey === "highlight" ? "highlightPolygonTarget" : "activePolygonTarget";

    // Get label target (synchronous, from evaluator cache)
    const labelTarget = getLabelTargetForEntity(entity);

    // Get polygon target (may be async for ARM resolution)
    const polygonTarget = await resolvePolygonTarget(entity);

    // Update label target
    updateTargetState(map, handles, labelHandleKey, labelTarget, stateKey);

    // Update polygon target
    updateTargetState(map, handles, polygonHandleKey, polygonTarget, stateKey);
}

function updateTargetState(
    map: MapLibreMap,
    handles: FeatureStateHandles,
    handleKey: keyof FeatureStateHandles,
    nextTarget: FeatureStateTarget | null,
    stateKey: "highlight" | "active"
): void {
    const current = handles[handleKey];

    // Skip if same target
    if (targetsEqual(current, nextTarget)) {
        return;
    }

    // Clear previous target
    if (current) {
        clearFeatureState(map, current, stateKey);
        handles[handleKey] = null;
    }

    // Apply new target
    if (nextTarget) {
        applyFeatureState(map, nextTarget, stateKey, true);
        handles[handleKey] = nextTarget;
    }
}

// ============================================================================
// Polygon Target Resolution
// ============================================================================

async function resolvePolygonTarget(entity: EntityRef | null): Promise<FeatureStateTarget | null> {
    if (!entity) {
        return null;
    }

    if (entity.kind === "commune") {
        return {
            source: SOURCE_IDS.communes,
            sourceLayer: SOURCE_LAYERS.communes,
            id: entity.inseeCode
        };
    }

    if (entity.kind === "infraZone") {
        // For infraZone, we need to resolve the ARM inseeCode
        const armInseeCode = await getArmInseeCodeById(entity.id);
        if (!armInseeCode) {
            return null;
        }
        return {
            source: SOURCE_IDS.arrMunicipal,
            sourceLayer: SOURCE_LAYERS.arrMunicipal,
            id: armInseeCode
        };
    }

    if (entity.kind === "transactionAddress") {
        // Transaction addresses use GeoJSON source (no sourceLayer)
        // The feature id in GeoJSON source is the addressId string
        return {
            source: SOURCE_IDS.transactionAddresses,
            id: entity.id
        };
    }

    return null;
}

// ============================================================================
// Feature State Helpers
// ============================================================================

function applyFeatureState(
    map: MapLibreMap,
    target: FeatureStateTarget,
    stateKey: "highlight" | "active",
    value: boolean
): void {
    try {
        map.setFeatureState(
            {
                source: target.source,
                sourceLayer: target.sourceLayer,
                id: target.id
            },
            { [stateKey]: value }
        );
    } catch {
        // Ignore errors - feature may not be in tile pyramid
    }
}

function clearFeatureState(
    map: MapLibreMap,
    target: FeatureStateTarget | null,
    stateKey: "highlight" | "active"
): void {
    if (!target) {
        return;
    }
    applyFeatureState(map, target, stateKey, false);
}

function targetsEqual(a: FeatureStateTarget | null, b: FeatureStateTarget | null): boolean {
    if (a === b) {
        return true;
    }
    if (!a || !b) {
        return false;
    }
    return a.id === b.id && a.source === b.source && a.sourceLayer === b.sourceLayer;
}
