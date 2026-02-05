/**
 * Display Binder
 *
 * Watches displayModeService and applies choroplèthe expressions to MapLibre.
 * Responsible for fill-color, fill-opacity, line-color on commune polygons
 * based on the selected display mode (default | insecurity).
 *
 * RULES (from spec):
 * - fill-color: data-driven (insecurity level) - NO feature-state (keeps choroplèthe stable)
 * - line-color: data-driven + feature-state (highlight/active override)
 * - line-width: NOT modified (keep original for interaction)
 *
 * Architecture:
 * - Subscribes to displayModeService
 * - Saves original expressions on attach
 * - Restores original expressions when switching to "default" or detach
 * - Async loads insecurity data when switching to "insecurity" mode
 */

import type { ExpressionSpecification, Map as MapLibreMap } from "maplibre-gl";

import { INSECURITY_PALETTE, type InsecurityLevel } from "@/lib/config/insecurityPalette";
import {
  computeInsecurityLevel,
  loadInsecurityMeta,
  loadInsecurityYear,
} from "@/lib/data/insecurityMetrics";
import { COMMUNE_COLORS } from "@/lib/map/layers/highlightState";
import { LAYER_IDS } from "@/lib/map/registry/layerRegistry";

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
};

type DisplayBinderState = {
  map: MapLibreMap;
  saved: SavedExpressions | null;
  currentMode: DisplayMode;
  abortController: AbortController | null;
  unsubscribe: (() => void) | null;
};

// ============================================================================
// Constants
// ============================================================================

const FILL_LAYER_ID = LAYER_IDS.communesFill;
const LINE_LAYER_ID = LAYER_IDS.communesLine;

/** Fill opacity for insecurity choroplèthe */
const INSECURITY_FILL_OPACITY = 0.35;

/** Default fill color when no data */
const DEFAULT_FILL_COLOR = "#64748b"; // slate-500

// ============================================================================
// Expression Builders
// ============================================================================

/**
 * Build fill-color expression for insecurity mode.
 * Pure match expression (NO feature-state) - fill stays stable on hover/click.
 *
 * Format: ["match", ["get", "insee"], "01001", "#22c55e", "01002", "#ef4444", ..., default]
 */
function buildInsecurityFillColorExpr(
  communeInsecurityMap: Map<string, InsecurityLevel>
): ExpressionSpecification {
  const matchExpr: unknown[] = ["match", ["get", "insee"]];

  for (const [insee, level] of communeInsecurityMap) {
    matchExpr.push(insee);
    matchExpr.push(INSECURITY_PALETTE[level]);
  }

  // Fallback color for communes without data
  matchExpr.push(DEFAULT_FILL_COLOR);

  return matchExpr as ExpressionSpecification;
}

/**
 * Build line-color expression for insecurity mode.
 * Case expression with feature-state (active > highlight > data-driven match).
 *
 * Priority:
 * 1. active: COMMUNE_COLORS.line.active
 * 2. highlight: COMMUNE_COLORS.line.highlight
 * 3. match by insecurity level (darker colors)
 */
function buildInsecurityLineColorExpr(
  communeInsecurityMap: Map<string, InsecurityLevel>
): ExpressionSpecification {
  // Build inner match expression for level-based colors
  const matchExpr: unknown[] = ["match", ["get", "insee"]];

  for (const [insee, level] of communeInsecurityMap) {
    matchExpr.push(insee);
    // Line color slightly darker than fill
    matchExpr.push(INSECURITY_PALETTE[level]);
  }

  // Fallback
  matchExpr.push(COMMUNE_COLORS.line.base);

  // Wrap in case for feature-state priority
  const caseExpr: unknown[] = [
    "case",
    ["boolean", ["feature-state", "active"], false],
    COMMUNE_COLORS.line.active,
    ["boolean", ["feature-state", "highlight"], false],
    COMMUNE_COLORS.line.highlight,
    matchExpr,
  ];

  return caseExpr as ExpressionSpecification;
}

// ============================================================================
// Data Loading
// ============================================================================

/**
 * Load insecurity data and build Map<insee, InsecurityLevel>.
 */
async function loadInsecurityData(
  signal?: AbortSignal
): Promise<Map<string, InsecurityLevel>> {
  const meta = await loadInsecurityMeta(signal);

  // Use most recent year
  const latestYear = Math.max(...meta.yearsAvailable);
  const yearData = await loadInsecurityYear(latestYear, signal);

  const result = new Map<string, InsecurityLevel>();

  for (const [insee, row] of yearData) {
    const level = computeInsecurityLevel(row.indexGlobal);
    if (level) {
      result.set(insee, level);
    }
  }

  return result;
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
  };
}

/**
 * Apply insecurity mode expressions to the map.
 */
function applyInsecurityExpressions(
  map: MapLibreMap,
  communeData: Map<string, InsecurityLevel>
): void {
  const fillColorExpr = buildInsecurityFillColorExpr(communeData);
  const lineColorExpr = buildInsecurityLineColorExpr(communeData);

  map.setPaintProperty(FILL_LAYER_ID, "fill-color", fillColorExpr);
  map.setPaintProperty(FILL_LAYER_ID, "fill-opacity", INSECURITY_FILL_OPACITY);
  map.setPaintProperty(LINE_LAYER_ID, "line-color", lineColorExpr);
}

/**
 * Restore original expressions.
 */
function restoreOriginalExpressions(
  map: MapLibreMap,
  saved: SavedExpressions
): void {
  if (saved.fillColor !== undefined) {
    map.setPaintProperty(FILL_LAYER_ID, "fill-color", saved.fillColor);
  }
  if (saved.fillOpacity !== undefined) {
    map.setPaintProperty(FILL_LAYER_ID, "fill-opacity", saved.fillOpacity);
  }
  if (saved.lineColor !== undefined) {
    map.setPaintProperty(LINE_LAYER_ID, "line-color", saved.lineColor);
  }
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

  if (mode === "default") {
    // Restore original expressions
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
      const communeData = await loadInsecurityData(signal);

      // Check if still in insecurity mode after async load
      if (state.currentMode !== "insecurity") {
        return;
      }

      applyInsecurityExpressions(state.map, communeData);
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
