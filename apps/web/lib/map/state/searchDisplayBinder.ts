/**
 * Search Display Binder
 *
 * Watches SearchService and applies feature-state `score` + `isSearchResult`
 * on commune polygons/labels when DisplayMode is "search".
 *
 * Pattern identical to displayBinder.ts:
 * - RAF batching (200 features/frame)
 * - Viewport-only updates (moveend + zoomend)
 * - Subscribes to both displayModeService and searchService
 */

import type { ExpressionSpecification, MapGeoJSONFeature, Map as MapLibreMap } from "maplibre-gl";

import { COMMUNE_COLORS } from "@/lib/map/layers/highlightState";
import { LAYER_IDS } from "@/lib/map/registry/layerRegistry";
import { getSearchService } from "@/lib/search/searchService";
import type { SearchResult } from "@/lib/search/types";

import { displayModeService, type DisplayMode } from "./displayModeService";

// ============================================================================
// Constants
// ============================================================================

const FILL_LAYER_ID = LAYER_IDS.communesFill;
const LINE_LAYER_ID = LAYER_IDS.communesLine;

const BATCH_SIZE = 200;

const SEARCH_FILL_OPACITY_RESULT = 0.8;
const SEARCH_FILL_OPACITY_NON_RESULT = 0.08;

const BRAND_COLOR_INTENSE = "#1b4d3e";
const BRAND_COLOR_DILUTE = "#a7d5c8";

// ============================================================================
// Types
// ============================================================================

type SavedExpressions = {
    fillColor: ExpressionSpecification | string | undefined;
    fillOpacity: ExpressionSpecification | number | undefined;
    lineColor: ExpressionSpecification | string | undefined;
    lineOpacity: ExpressionSpecification | number | undefined;
};

type SearchBinderState = {
    map: MapLibreMap;
    saved: SavedExpressions | null;
    currentMode: DisplayMode;
    scoreMap: Map<string, number> | null;
    resultSet: Set<string> | null;
    appliedStates: Set<string>;
    unsubscribeMode: (() => void) | null;
    unsubscribeSearch: (() => void) | null;
    moveEndHandler: (() => void) | null;
    zoomEndHandler: (() => void) | null;
};

// ============================================================================
// Expression Builders
// ============================================================================

function buildSearchFillColorExpr(): ExpressionSpecification {
    return [
        "case",
        ["boolean", ["feature-state", "active"], false],
        COMMUNE_COLORS.fill.active,
        ["boolean", ["feature-state", "highlight"], false],
        COMMUNE_COLORS.fill.highlight,
        ["boolean", ["feature-state", "isSearchResult"], false],
        [
            "interpolate",
            ["linear"],
            ["feature-state", "score"],
            0, BRAND_COLOR_DILUTE,
            1, BRAND_COLOR_INTENSE
        ],
        "#e2e8f0"
    ] as ExpressionSpecification;
}

function buildSearchFillOpacityExpr(): ExpressionSpecification {
    return [
        "case",
        ["boolean", ["feature-state", "active"], false],
        0.24,
        ["boolean", ["feature-state", "highlight"], false],
        0.16,
        ["boolean", ["feature-state", "isSearchResult"], false],
        SEARCH_FILL_OPACITY_RESULT,
        SEARCH_FILL_OPACITY_NON_RESULT
    ] as ExpressionSpecification;
}

function buildSearchLineColorExpr(): ExpressionSpecification {
    return [
        "case",
        ["boolean", ["feature-state", "active"], false],
        COMMUNE_COLORS.line.active,
        ["boolean", ["feature-state", "highlight"], false],
        COMMUNE_COLORS.line.highlight,
        "#FFFFFF"
    ] as ExpressionSpecification;
}

// ============================================================================
// Data Mapping
// ============================================================================

function buildScoreMap(results: SearchResult[]): Map<string, number> {
    const map = new Map<string, number>();
    for (const r of results) {
        map.set(r.inseeCode, r.score);
    }
    return map;
}

function buildResultSet(results: SearchResult[]): Set<string> {
    const set = new Set<string>();
    for (const r of results) {
        set.add(r.inseeCode);
    }
    return set;
}

// ============================================================================
// Feature-State Application
// ============================================================================

function applyViewportFeatureStates(state: SearchBinderState): void {
    if (!state.scoreMap || !state.resultSet) {
        return;
    }

    const features = state.map.queryRenderedFeatures(undefined, {
        layers: [FILL_LAYER_ID]
    });

    const batch: Array<{ feature: MapGeoJSONFeature; score: number; isResult: boolean }> = [];
    for (const feature of features) {
        const insee = feature.properties?.["insee"] as string | undefined;
        if (!insee || !feature.id) continue;

        if (state.appliedStates.has(insee)) continue;

        const isResult = state.resultSet.has(insee);
        const score = state.scoreMap.get(insee) ?? 0;
        batch.push({ feature, score, isResult });
    }

    if (batch.length === 0) return;

    let index = 0;
    const applyChunk = (): void => {
        const chunk = batch.slice(index, index + BATCH_SIZE);
        for (const { feature, score, isResult } of chunk) {
            state.map.setFeatureState(
                { source: "communes", sourceLayer: "communes", id: feature.id },
                { isSearchResult: isResult, score }
            );
            const insee = feature.properties?.["insee"] as string | undefined;
            if (insee) {
                state.appliedStates.add(insee);
            }
        }
        index += BATCH_SIZE;
        if (index < batch.length) {
            requestAnimationFrame(applyChunk);
        }
    };

    requestAnimationFrame(applyChunk);
}

function clearSearchFeatureStates(state: SearchBinderState): void {
    const features = state.map.querySourceFeatures("communes");
    for (const feature of features) {
        if (feature.id) {
            state.map.removeFeatureState(
                { source: "communes", sourceLayer: "communes", id: feature.id },
                "isSearchResult"
            );
            state.map.removeFeatureState(
                { source: "communes", sourceLayer: "communes", id: feature.id },
                "score"
            );
        }
    }
    state.appliedStates.clear();
}

// ============================================================================
// Paint Property Management
// ============================================================================

function saveCurrentExpressions(map: MapLibreMap): SavedExpressions {
    return {
        fillColor: map.getPaintProperty(FILL_LAYER_ID, "fill-color") as
            | ExpressionSpecification | string | undefined,
        fillOpacity: map.getPaintProperty(FILL_LAYER_ID, "fill-opacity") as
            | ExpressionSpecification | number | undefined,
        lineColor: map.getPaintProperty(LINE_LAYER_ID, "line-color") as
            | ExpressionSpecification | string | undefined,
        lineOpacity: map.getPaintProperty(LINE_LAYER_ID, "line-opacity") as
            | ExpressionSpecification | number | undefined,
    };
}

function applySearchExpressions(state: SearchBinderState): void {
    state.map.setPaintProperty(FILL_LAYER_ID, "fill-color", buildSearchFillColorExpr());
    state.map.setPaintProperty(FILL_LAYER_ID, "fill-opacity", buildSearchFillOpacityExpr());
    state.map.setPaintProperty(LINE_LAYER_ID, "line-color", buildSearchLineColorExpr());
    state.map.setPaintProperty(LINE_LAYER_ID, "line-opacity", 1);
}

function restoreOriginalExpressions(map: MapLibreMap, saved: SavedExpressions): void {
    if (saved.fillColor !== undefined) {
        map.setPaintProperty(FILL_LAYER_ID, "fill-color", saved.fillColor);
    }
    if (saved.fillOpacity !== undefined) {
        map.setPaintProperty(FILL_LAYER_ID, "fill-opacity", saved.fillOpacity);
    }
    if (saved.lineColor !== undefined) {
        map.setPaintProperty(LINE_LAYER_ID, "line-color", saved.lineColor);
    }
    if (saved.lineOpacity !== undefined) {
        map.setPaintProperty(LINE_LAYER_ID, "line-opacity", saved.lineOpacity);
    }
}

// ============================================================================
// Viewport Handlers
// ============================================================================

function installViewportHandlers(state: SearchBinderState): void {
    removeViewportHandlers(state);

    const handler = (): void => {
        applyViewportFeatureStates(state);
    };

    state.moveEndHandler = handler;
    state.zoomEndHandler = handler;

    state.map.on("moveend", state.moveEndHandler);
    state.map.on("zoomend", state.zoomEndHandler);

    applyViewportFeatureStates(state);
}

function removeViewportHandlers(state: SearchBinderState): void {
    if (state.moveEndHandler) {
        state.map.off("moveend", state.moveEndHandler);
        state.moveEndHandler = null;
    }
    if (state.zoomEndHandler) {
        state.map.off("zoomend", state.zoomEndHandler);
        state.zoomEndHandler = null;
    }
}

// ============================================================================
// Mode Handler
// ============================================================================

function handleModeChange(state: SearchBinderState, mode: DisplayMode): void {
    state.currentMode = mode;

    if (mode !== "search") {
        removeViewportHandlers(state);
        clearSearchFeatureStates(state);
        state.scoreMap = null;
        state.resultSet = null;

        if (state.saved) {
            restoreOriginalExpressions(state.map, state.saved);
        }
        return;
    }

    // Mode = search: apply current results
    const searchService = getSearchService();
    const searchState = searchService.getState();
    applySearchResults(state, searchState.results);
}

function applySearchResults(state: SearchBinderState, results: SearchResult[]): void {
    state.scoreMap = buildScoreMap(results);
    state.resultSet = buildResultSet(results);
    state.appliedStates.clear();

    if (results.length > 0) {
        applySearchExpressions(state);
        installViewportHandlers(state);
    }
}

// ============================================================================
// Public API
// ============================================================================

export function attachSearchDisplayBinder(map: MapLibreMap): () => void {
    const state: SearchBinderState = {
        map,
        saved: null,
        currentMode: displayModeService.getMode(),
        scoreMap: null,
        resultSet: null,
        appliedStates: new Set(),
        unsubscribeMode: null,
        unsubscribeSearch: null,
        moveEndHandler: null,
        zoomEndHandler: null,
    };

    state.saved = saveCurrentExpressions(map);

    // Subscribe to display mode changes
    state.unsubscribeMode = displayModeService.subscribe((mode) => {
        handleModeChange(state, mode);
    });

    // Subscribe to search results changes
    const searchService = getSearchService();
    state.unsubscribeSearch = searchService.subscribe((searchState) => {
        if (state.currentMode !== "search") return;

        if (searchState.phase === "results" || searchState.phase === "computing") {
            state.appliedStates.clear();
            applySearchResults(state, searchState.results);
        }
    });

    // Apply if already in search mode
    if (state.currentMode === "search") {
        handleModeChange(state, "search");
    }

    return () => {
        removeViewportHandlers(state);
        clearSearchFeatureStates(state);

        if (state.unsubscribeMode) {
            state.unsubscribeMode();
            state.unsubscribeMode = null;
        }
        if (state.unsubscribeSearch) {
            state.unsubscribeSearch();
            state.unsubscribeSearch = null;
        }
        if (state.saved) {
            restoreOriginalExpressions(state.map, state.saved);
            state.saved = null;
        }
    };
}
