/**
 * Display Binder
 *
 * Watches displayModeService and applies choroplèthe expressions to MapLibre.
 * Responsible for fill-color, fill-opacity, line-color on commune polygons
 * based on the selected display mode (default | insecurity).
 *
 * ARCHITECTURE (Phase 3 - Task Performance):
 * - fill-color: Compact feature-state expression (replaces giant ~35k match expression)
 * - Viewport-only updates: feature-states applied only to rendered features (moveend + zoomend)
 * - Batched updates: RAF-based batching to avoid frame drops
 * - Mobile optimization: Adjusted fill-opacity for touch devices
 *
 * RULES (from spec):
 * - fill-color: feature-state based (insecurityLevelCode)
 * - line-color: data-driven + feature-state (highlight/active override)
 * - line-width: NOT modified (keep original for interaction)
 * - Events: moveend + zoomend ONLY (never move)
 */

import type { ExpressionSpecification, MapGeoJSONFeature, Map as MapLibreMap, MapMouseEvent } from "maplibre-gl";
import maplibregl from "maplibre-gl";

import { INSECURITY_COLORS } from "@/lib/config/insecurityPalette";
import { getCommuneByInsee } from "@/lib/data/communesIndexLite";
import { loadInsecurityMeta, loadInsecurityYear, type InsecurityMetricsRow } from "@/lib/data/insecurityMetrics";
import { buildLineWidthExpr, COMMUNE_COLORS, COMMUNE_LINE_WIDTH } from "@/lib/map/layers/highlightState";
import { GenericPopup, type PopupContent } from "@/lib/map/popupRenderer";
import { LAYER_IDS } from "@/lib/map/registry/layerRegistry";
import { getEntityStateService } from "@/lib/selection";

import { displayModeService, type DisplayMode } from "./displayModeService";

// ============================================================================
// Types
// ============================================================================

/**
 * SavedExpressions - Expressions we backup and restore.
 * Only save what we modify: fill-color, fill-opacity, line-color.
 * We intentionally DO NOT modify line-width (keeps interaction styling).
 */
type SavedExpressions = {
    fillColor: ExpressionSpecification | string | undefined;
    fillOpacity: ExpressionSpecification | number | undefined;
    lineColor: ExpressionSpecification | string | undefined;
    lineOpacity: ExpressionSpecification | number | undefined;
    lineWidth: ExpressionSpecification | number | undefined;
};

type DisplayBinderState = {
    map: MapLibreMap;
    saved: SavedExpressions | null;
    currentMode: DisplayMode;
    abortController: AbortController | null;
    unsubscribe: (() => void) | null;
    // Viewport update tracking
    insecurityLevelMap: Map<string, number> | null;
    appliedStates: Set<string>;
    moveEndHandler: (() => void) | null;
    zoomEndHandler: (() => void) | null;
    isMobile: boolean;
    // Highlight popup
    popup: GenericPopup | null;
    highlightUnsubscribe: (() => void) | null;
    highlightAbortController: AbortController | null;
    highlightMouseMoveHandler: ((e: MapMouseEvent) => void) | null;
    highlightRafId: number | null;
};

// ============================================================================
// Constants
// ============================================================================

const FILL_LAYER_ID = LAYER_IDS.communesFill;
const LINE_LAYER_ID = LAYER_IDS.communesLine;

/** Fill opacity for insecurity choroplèthe (desktop) */
const INSECURITY_FILL_OPACITY_DESKTOP = 0.75;

/** Fill opacity for insecurity choroplèthe (mobile - more visible) */
const INSECURITY_FILL_OPACITY_MOBILE = 1;

/** Line opacity for insecurity mode (show white outlines by default) */
const INSECURITY_LINE_OPACITY = 1;
const INSECURITY_LINE_WIDTH_BASE = 1;

/** Default fill color when no data */
const DEFAULT_FILL_COLOR = "#64748b"; // slate-500

/** RAF batch size (number of feature-states per animation frame) */
const BATCH_SIZE = 200;

/** Popup offset from cursor (pixels) */
const POPUP_OFFSET_X = 15;
const POPUP_OFFSET_Y = 10;

// ============================================================================
// Popup Helpers
// ============================================================================

/**
 * Get singular label for population category.
 */
function getCategorySingularLabel(category: string): string {
    switch (category) {
        case "small": return "Petite commune";
        case "medium": return "Commune moyenne";
        case "large": return "Grande ville";
        default: return "Commune";
    }
}

/**
 * Convert rate per 100k to percentage for HTML display.
 */
function rateToPercentageHtml(ratePer100k: number | null): string {
    if (ratePer100k === null) return "N/A";
    return ((ratePer100k / 1000).toFixed(1)) + "%";
}

/**
 * Calculate absolute number of incidents from rate and population for HTML display.
 */
function calculateAbsoluteIncidentsHtml(
    ratePer100k: number | null,
    population: number | null
): string {
    if (ratePer100k === null || population === null) return "N/A";
    return Math.round((ratePer100k / 100000) * population).toString();
}

// ============================================================================
// Mobile Detection
// ============================================================================

function detectMobile(): boolean {
    return window.matchMedia("(pointer: coarse)").matches;
}

// ============================================================================
// Expression Builders
// ============================================================================

/**
 * Build fill-color expression for insecurity mode.
 * Compact feature-state expression (replaces giant match).
 *
 * Priority: active > highlight > insecurityLevelCode (0-4)
 */
function buildInsecurityFillColorExpr(): ExpressionSpecification {
    return [
        "case",
        ["boolean", ["feature-state", "active"], false],
        COMMUNE_COLORS.fill.active,
        ["boolean", ["feature-state", "highlight"], false],
        COMMUNE_COLORS.fill.highlight,
        [
            "match",
            ["feature-state", "insecurityLevelCode"],
            0, INSECURITY_COLORS[0],
            1, INSECURITY_COLORS[1],
            2, INSECURITY_COLORS[2],
            3, INSECURITY_COLORS[3],
            4, INSECURITY_COLORS[4],
            DEFAULT_FILL_COLOR
        ]
    ] as ExpressionSpecification;
}

/**
 * Build line-color expression for insecurity mode.
 * Case expression with feature-state (active > highlight > base).
 */
function buildInsecurityLineColorExpr(): ExpressionSpecification {
    return [
        "case",
        ["boolean", ["feature-state", "active"], false],
        COMMUNE_COLORS.line.active,
        ["boolean", ["feature-state", "highlight"], false],
        COMMUNE_COLORS.line.highlight,
        "#FFFFFF"
    ] as ExpressionSpecification;
}

/**
 * Build line-width expression for insecurity mode.
 * Keeps active/highlight widths and enables visible base outline.
 */
function buildInsecurityLineWidthExpr(): ExpressionSpecification {
    return buildLineWidthExpr(
        INSECURITY_LINE_WIDTH_BASE,
        COMMUNE_LINE_WIDTH.highlight,
        COMMUNE_LINE_WIDTH.active
    );
}

// ============================================================================
// Data Loading
// ============================================================================

/**
 * Load insecurity data and build Map<insee, level>.
 */
async function loadInsecurityData(signal?: AbortSignal): Promise<Map<string, number>> {
    const meta = await loadInsecurityMeta(signal);

    // Use most recent year
    const latestYear = Math.max(...meta.yearsAvailable);
    const yearData = await loadInsecurityYear(latestYear, signal);

    const result = new Map<string, number>();

    for (const [insee, row] of yearData) {
        // Use baked level field (0-4) directly from data
        if (row.levelCategory !== null && Number.isFinite(row.levelCategory)) {
            result.set(insee, row.levelCategory);
        }
    }

    return result;
}

// ============================================================================
// Viewport Feature-State Updates
// ============================================================================

/**
 * Apply feature-states to visible features in viewport.
 * Uses RAF batching to avoid frame drops.
 */
function applyViewportFeatureStates(state: DisplayBinderState): void {
    if (!state.insecurityLevelMap) {
        return;
    }

    // Query rendered features (viewport-only)
    const features = state.map.queryRenderedFeatures(undefined, {
        layers: [FILL_LAYER_ID]
    });

    // Build batch of updates (skip already applied)
    const batch: Array<{ feature: MapGeoJSONFeature; level: number }> = [];
    for (const feature of features) {
        const insee = feature.properties?.["insee"] as string | undefined;
        if (!insee || !feature.id) continue;

        // Skip if already applied
        if (state.appliedStates.has(insee)) continue;

        const level = state.insecurityLevelMap.get(insee);
        if (level !== undefined) {
            batch.push({ feature, level });
        }
    }

    if (batch.length === 0) {
        return;
    }

    // Apply in RAF chunks
    let index = 0;
    const applyChunk = (): void => {
        const chunk = batch.slice(index, index + BATCH_SIZE);
        for (const { feature, level } of chunk) {
            state.map.setFeatureState(
                { source: "communes", sourceLayer: "communes", id: feature.id },
                { insecurityLevelCode: level }
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

/**
 * Clear all feature-states for insecurity.
 */
function clearInsecurityFeatureStates(state: DisplayBinderState): void {
    // Query all features that might have feature-state
    const features = state.map.querySourceFeatures("communes");

    for (const feature of features) {
        if (feature.id) {
            state.map.removeFeatureState(
                { source: "communes", sourceLayer: "communes", id: feature.id },
                "insecurityLevelCode"
            );
        }
    }

    state.appliedStates.clear();
}

// ============================================================================
// Paint Property Management
// ============================================================================

/**
 * Save current expressions from the map layers.
 */
function saveCurrentExpressions(map: MapLibreMap): SavedExpressions {
    return {
        fillColor: map.getPaintProperty(FILL_LAYER_ID, "fill-color") as
            | ExpressionSpecification
            | string
            | undefined,
        fillOpacity: map.getPaintProperty(FILL_LAYER_ID, "fill-opacity") as
            | ExpressionSpecification
            | number
            | undefined,
        lineColor: map.getPaintProperty(LINE_LAYER_ID, "line-color") as
            | ExpressionSpecification
            | string
            | undefined,
        lineOpacity: map.getPaintProperty(LINE_LAYER_ID, "line-opacity") as
            | ExpressionSpecification
            | number
            | undefined,
        lineWidth: map.getPaintProperty(LINE_LAYER_ID, "line-width") as
            | ExpressionSpecification
            | number
            | undefined,
    };
}

/**
 * Apply insecurity mode expressions to the map.
 */
function applyInsecurityExpressions(state: DisplayBinderState): void {
    const fillColorExpr = buildInsecurityFillColorExpr();
    const lineColorExpr = buildInsecurityLineColorExpr();
    const lineWidthExpr = buildInsecurityLineWidthExpr();

    // Determine fill-opacity based on mobile detection
    const fillOpacity = state.isMobile
        ? INSECURITY_FILL_OPACITY_MOBILE
        : INSECURITY_FILL_OPACITY_DESKTOP;

    state.map.setPaintProperty(FILL_LAYER_ID, "fill-color", fillColorExpr);
    state.map.setPaintProperty(FILL_LAYER_ID, "fill-opacity", fillOpacity);
    state.map.setPaintProperty(LINE_LAYER_ID, "line-color", lineColorExpr);
    state.map.setPaintProperty(LINE_LAYER_ID, "line-opacity", INSECURITY_LINE_OPACITY);
    state.map.setPaintProperty(LINE_LAYER_ID, "line-width", lineWidthExpr);
}

/**
 * Restore original expressions.
 */
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
    if (saved.lineWidth !== undefined) {
        map.setPaintProperty(LINE_LAYER_ID, "line-width", saved.lineWidth);
    }
}

// ============================================================================
// Viewport Event Handlers
// ============================================================================

/**
 * Install viewport update handlers (moveend + zoomend ONLY).
 */
function installViewportHandlers(state: DisplayBinderState): void {
    // Remove existing handlers
    removeViewportHandlers(state);

    // Create handlers
    const handleViewportUpdate = (): void => {
        applyViewportFeatureStates(state);
    };

    state.moveEndHandler = handleViewportUpdate;
    state.zoomEndHandler = handleViewportUpdate;

    // Attach to map
    state.map.on("moveend", state.moveEndHandler);
    state.map.on("zoomend", state.zoomEndHandler);

    // Apply initial viewport states
    applyViewportFeatureStates(state);
}

/**
 * Remove viewport update handlers.
 */
function removeViewportHandlers(state: DisplayBinderState): void {
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
// Highlight Popup Management
// ============================================================================

/**
 * Build popup content for insecurity metrics.
 */
function buildInsecurityPopupContent(row: InsecurityMetricsRow | undefined, year?: number): PopupContent {
    let html = '<div class="bg-white border rounded-md px-1 py-1.5 text-sm text-brand shadow-md space-y-1">';

    if (row) {
        html += `<div class="font-medium">${getCategorySingularLabel(row.populationCategory || "")}</div>`;
        html += `<div>Violences physiques : ${rateToPercentageHtml(row.violencesPersonnesPer100k)} hbts touchés</div>`;
        html += `<div>Atteintes aux biens : ${rateToPercentageHtml(row.securiteBiensPer100k)} hbts touchés</div>`;
        html += `<div>${calculateAbsoluteIncidentsHtml(row.tranquillitePer100k, row.population)} incidents à l'ordre publique</div>`;
        if (year) {
            html += `<div class="text-xs text-gray-600 mt-1">Année ${year}</div>`;
        }
    } else {
        html += '<div>Aucune donnée disponible</div>';
    }

    html += '</div>';
    return { html };
}

/**
 * Remove highlight popup if it exists.
 */
function removeHighlightPopup(state: DisplayBinderState): void {
    // Cancel pending RAF
    if (state.highlightRafId !== null) {
        cancelAnimationFrame(state.highlightRafId);
        state.highlightRafId = null;
    }

    // Remove mousemove listener
    if (state.highlightMouseMoveHandler) {
        state.map.off("mousemove", state.highlightMouseMoveHandler);
        state.highlightMouseMoveHandler = null;
    }

    if (state.popup) {
        state.popup.close();
    }

    if (state.highlightAbortController) {
        state.highlightAbortController.abort();
        state.highlightAbortController = null;
    }
}

/**
 * Create or update highlight popup for a commune in insecurity mode.
 */
async function updateHighlightPopup(state: DisplayBinderState, inseeCode: string): Promise<void> {
    // Remove existing popup
    removeHighlightPopup(state);

    // Create abort controller for this request
    state.highlightAbortController = new AbortController();
    const { signal } = state.highlightAbortController;

    try {
        // Fetch commune data
        const commune = await getCommuneByInsee(inseeCode, signal);

        // Check if aborted during fetch
        if (signal.aborted) {
            return;
        }

        // Validate commune data
        if (!commune) {
            return;
        }

        // Get insecurity row for detailed metrics
        const meta = await loadInsecurityMeta(signal);
        const latestYear = Math.max(...meta.yearsAvailable);
        const yearData = await loadInsecurityYear(latestYear, signal);
        const row = yearData.get(inseeCode);

        // Check if aborted during fetch
        if (signal.aborted) {
            return;
        }

        // Build content with year
        const content = buildInsecurityPopupContent(row, latestYear);

        // Show popup at commune centroid (will be repositioned on mousemove)
        if (!state.popup) {
            return;
        }

        state.popup.show([commune.lon, commune.lat], content);

        // Install mousemove handler to follow cursor
        const handleMouseMove = (e: MapMouseEvent): void => {
            if (!state.popup?.isOpen()) {
                return;
            }

            // Cancel any pending update
            if (state.highlightRafId !== null) {
                cancelAnimationFrame(state.highlightRafId);
            }

            // Schedule position update in RAF
            state.highlightRafId = requestAnimationFrame(() => {
                if (!state.popup) {
                    return;
                }

                // Apply offset to mouse position
                const offsetPoint = new maplibregl.Point(
                    e.point.x + POPUP_OFFSET_X,
                    e.point.y + POPUP_OFFSET_Y
                );

                // Convert screen coordinates to map coordinates
                const lngLat = state.map.unproject(offsetPoint);

                // Update position with same content
                state.popup.show(lngLat, content);

                state.highlightRafId = null;
            });
        };

        state.highlightMouseMoveHandler = handleMouseMove;
        state.map.on("mousemove", handleMouseMove);
    } catch (error) {
        // Ignore abort errors
        if (error instanceof DOMException && error.name === "AbortError") {
            return;
        }
        console.error("[displayBinder] Failed to create highlight popup:", error);
    }
}

/**
 * Install highlight popup subscription for insecurity mode.
 */
function installHighlightPopupSubscription(state: DisplayBinderState): void {
    // Remove existing subscription
    removeHighlightPopupSubscription(state);

    const entityStateService = getEntityStateService();

    // Subscribe to highlight changes
    state.highlightUnsubscribe = entityStateService.subscribe((event) => {
        if (event.type !== "highlight") {
            return;
        }

        // Clear popup if highlight cleared or not a commune
        if (!event.entity || event.entity.kind !== "commune") {
            removeHighlightPopup(state);
            return;
        }

        // Update popup for highlighted commune
        void updateHighlightPopup(state, event.entity.inseeCode);
    });
}

/**
 * Remove highlight popup subscription.
 */
function removeHighlightPopupSubscription(state: DisplayBinderState): void {
    if (state.highlightUnsubscribe) {
        state.highlightUnsubscribe();
        state.highlightUnsubscribe = null;
    }

    removeHighlightPopup(state);
}

// ============================================================================
// Mode Handlers
// ============================================================================

/**
 * Handle mode change.
 */
async function handleModeChange(state: DisplayBinderState, mode: DisplayMode): Promise<void> {
    // Abort any pending load
    if (state.abortController) {
        state.abortController.abort();
        state.abortController = null;
    }

    state.currentMode = mode;

    if (mode === "default" || mode === "search") {
        // Clean up insecurity mode (search mode is handled by searchDisplayBinder)
        removeViewportHandlers(state);
        removeHighlightPopupSubscription(state);
        clearInsecurityFeatureStates(state);
        state.insecurityLevelMap = null;

        // Restore original expressions (searchDisplayBinder will apply its own if needed)
        if (state.saved) {
            restoreOriginalExpressions(state.map, state.saved);
        }
        return;
    }

    if (mode === "insecurity") {
        // Create abort controller for this load
        state.abortController = new AbortController();
        const { signal } = state.abortController;

        try {
            // Load data
            const levelMap = await loadInsecurityData(signal);

            // Check if still in insecurity mode after async load
            if (state.currentMode !== "insecurity") {
                return;
            }

            state.insecurityLevelMap = levelMap;

            // Apply expressions
            applyInsecurityExpressions(state);

            // Install viewport handlers
            installViewportHandlers(state);

            // Install highlight popup subscription
            installHighlightPopupSubscription(state);
        } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") {
                // Aborted, ignore
                return;
            }
            console.error("[displayBinder] Failed to load insecurity data:", error);
        }
    }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Attach the display binder to a MapLibre map.
 * Returns a cleanup function to call on unmount.
 */
export function attachDisplayBinder(map: MapLibreMap): () => void {
    const state: DisplayBinderState = {
        map,
        saved: null,
        currentMode: displayModeService.getMode(),
        abortController: null,
        unsubscribe: null,
        insecurityLevelMap: null,
        appliedStates: new Set(),
        moveEndHandler: null,
        zoomEndHandler: null,
        isMobile: detectMobile(),
        popup: new GenericPopup(map, { openDelay: 500 }),
        highlightUnsubscribe: null,
        highlightAbortController: null,
        highlightMouseMoveHandler: null,
        highlightRafId: null,
    };

    // Save current expressions (will restore on detach or mode=default)
    state.saved = saveCurrentExpressions(map);

    // Subscribe to mode changes
    state.unsubscribe = displayModeService.subscribe((mode) => {
        void handleModeChange(state, mode);
    });

    // Apply current mode (if not default)
    if (state.currentMode !== "default") {
        void handleModeChange(state, state.currentMode);
    }

    // Return cleanup function
    return () => {
        // Abort any pending load
        if (state.abortController) {
            state.abortController.abort();
            state.abortController = null;
        }

        // Remove viewport handlers
        removeViewportHandlers(state);

        // Remove highlight popup subscription
        removeHighlightPopupSubscription(state);

        // Clear feature-states
        clearInsecurityFeatureStates(state);

        // Unsubscribe from mode changes
        if (state.unsubscribe) {
            state.unsubscribe();
            state.unsubscribe = null;
        }

        // Restore original expressions
        if (state.saved) {
            restoreOriginalExpressions(state.map, state.saved);
            state.saved = null;
        }
    };
}
