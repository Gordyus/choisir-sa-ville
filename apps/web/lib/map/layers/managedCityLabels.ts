/**
 * Managed City Labels - Split OMT label layers for hover/selection styling.
 * 
 * This module duplicates OpenMapTiles label layers so that city/town/village
 * labels can have feature-state-driven styling while other place labels
 * remain unchanged.
 */

import type {
    ExpressionSpecification,
    LegacyFilterSpecification,
    StyleSpecification,
    SymbolLayerSpecification
} from "maplibre-gl";

import type { CityLabelStyleConfig } from "@/lib/config/mapTilesConfig";

import { LAYER_IDS, OMT_LABEL_LAYER_IDS } from "../registry/layerRegistry";
import { buildPlaceClassExcludeFilter, buildPlaceClassIncludeFilter } from "./baseLabels";

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_TEXT_COLOR = "#1f2933";
const HOVER_TEXT_COLOR = "#1130ff";
const SELECTED_TEXT_COLOR = "#0f172a";
const DEFAULT_HALO_COLOR = "#f7f4ef";
const HOVER_HALO_COLOR = "#ffffff";
const SELECTED_HALO_COLOR = "#ffe28f";
const DEFAULT_HALO_WIDTH = 1.5;
const HOVER_HALO_WIDTH = 2.2;
const SELECTED_HALO_WIDTH = 2.8;

const MANAGED_LAYER_METADATA_FLAG = "__managedCityLabel";

// ============================================================================
// Public API
// ============================================================================

/**
 * Check if managed city label layers already exist in the style
 */
export function hasManagedCityLayers(layers: StyleSpecification["layers"]): boolean {
    if (!layers) return false;
    return layers.some((layer) => readManagedMetadataFlag(layer));
}

/**
 * Split city label layers into managed (with feature-state styling) and base layers.
 * 
 * @param layers - The style layers array
 * @param targetIds - Set of layer IDs to split (defaults to OMT_LABEL_LAYER_IDS)
 * @param styleOverrides - Optional style customizations
 * @returns Updated layers array with split layers
 */
export function splitCityLabelLayers(
    layers: StyleSpecification["layers"],
    targetIds?: Set<string>,
    styleOverrides?: CityLabelStyleConfig
): StyleSpecification["layers"] {
    if (!layers) return layers;

    const ids = targetIds ?? new Set(OMT_LABEL_LAYER_IDS);
    if (!ids.size) return layers;

    const includeFilter = buildPlaceClassIncludeFilter();
    const excludeFilter = buildPlaceClassExcludeFilter();

    let applied = false;
    const result: StyleSpecification["layers"] = [];

    for (const layer of layers) {
        if (shouldSplitLayer(layer, ids)) {
            const { baseLayer, managedLayer } = buildManagedLayerPair(
                layer as SymbolLayerSpecification,
                styleOverrides,
                includeFilter,
                excludeFilter
            );
            // Insert managed layer before base so it renders on top
            result.push(managedLayer, baseLayer);
            applied = true;
        } else {
            result.push(layer);
        }
    }

    return applied ? result : layers;
}

/**
 * Get the managed layer ID for a base label layer
 */
export function buildManagedCityLabelLayerId(baseLayerId: string): string {
    return `${baseLayerId}${LAYER_IDS.MANAGED_CITY_LABEL_SUFFIX}`;
}

/**
 * Check if a layer is a managed city label layer
 */
export function isManagedCityLabelLayer(layer: StyleSpecification["layers"][number]): boolean {
    return readManagedMetadataFlag(layer);
}

// ============================================================================
// Internal Helpers
// ============================================================================

function shouldSplitLayer(
    layer: StyleSpecification["layers"][number],
    targetIds: Set<string>
): boolean {
    if (!targetIds.size) return false;
    if (layer.type !== "symbol" || typeof layer.id !== "string") return false;
    if (!targetIds.has(layer.id)) return false;
    return true;
}

function buildManagedLayerPair(
    layer: SymbolLayerSpecification,
    styleOverrides: CityLabelStyleConfig | undefined,
    includeFilter: LegacyFilterSpecification,
    excludeFilter: LegacyFilterSpecification
): {
    baseLayer: SymbolLayerSpecification;
    managedLayer: SymbolLayerSpecification;
} {
    const baseLayer = cloneLayer(layer);
    const managedLayer = cloneLayer(layer);
    const originalFilter = layer.filter as LegacyFilterSpecification | undefined;

    // Base layer excludes city classes, managed layer includes them
    baseLayer.filter = combineFilters(originalFilter, cloneFilter(excludeFilter));
    managedLayer.filter = combineFilters(originalFilter, cloneFilter(includeFilter));

    // Give managed layer a distinct ID
    managedLayer.id = buildManagedCityLabelLayerId(layer.id);

    // Apply styling
    managedLayer.paint = buildManagedPaint(layer.paint, styleOverrides);
    managedLayer.metadata = buildManagedMetadata(layer);
    applyLayoutOverrides(managedLayer, styleOverrides);
    applyHoverResponsiveTextSize(managedLayer);

    return { baseLayer, managedLayer };
}

function cloneLayer<T extends StyleSpecification["layers"][number]>(layer: T): T {
    return JSON.parse(JSON.stringify(layer)) as T;
}

function cloneFilter(filter: LegacyFilterSpecification): LegacyFilterSpecification {
    return JSON.parse(JSON.stringify(filter)) as LegacyFilterSpecification;
}

function combineFilters(
    existing: LegacyFilterSpecification | undefined,
    additional: LegacyFilterSpecification
): LegacyFilterSpecification {
    if (!existing) return additional;

    // If existing is already an "all" compound, append to it
    if (Array.isArray(existing) && existing[0] === "all") {
        return [...existing, additional] as LegacyFilterSpecification;
    }

    // Otherwise wrap both in "all"
    return ["all", existing, additional] as LegacyFilterSpecification;
}

type SymbolPaint = Exclude<SymbolLayerSpecification["paint"], undefined>;

function buildManagedPaint(
    basePaint: SymbolLayerSpecification["paint"],
    overrides?: CityLabelStyleConfig
): SymbolPaint {
    const paint: SymbolPaint = { ...(basePaint ?? {}) };

    // Text color with feature-state
    paint["text-color"] = buildFeatureStateColor(
        overrides?.textColor ?? DEFAULT_TEXT_COLOR,
        overrides?.hoverTextColor ?? HOVER_TEXT_COLOR,
        overrides?.selectedTextColor ?? SELECTED_TEXT_COLOR
    );

    // Halo color with feature-state
    paint["text-halo-color"] = buildFeatureStateColor(
        overrides?.textHaloColor ?? DEFAULT_HALO_COLOR,
        overrides?.hoverTextHaloColor ?? HOVER_HALO_COLOR,
        overrides?.selectedTextHaloColor ?? SELECTED_HALO_COLOR
    );

    // Halo width with feature-state
    paint["text-halo-width"] = buildFeatureStateNumber(
        overrides?.textHaloWidth ?? DEFAULT_HALO_WIDTH,
        overrides?.hoverTextHaloWidth ?? HOVER_HALO_WIDTH,
        overrides?.selectedTextHaloWidth ?? SELECTED_HALO_WIDTH
    );

    return paint;
}

function buildManagedMetadata(
    layer: SymbolLayerSpecification
): Record<string, unknown> {
    return {
        ...(layer.metadata as Record<string, unknown> | undefined),
        [MANAGED_LAYER_METADATA_FLAG]: true
    };
}

function readManagedMetadataFlag(layer: StyleSpecification["layers"][number]): boolean {
    const meta = layer.metadata as Record<string, unknown> | undefined;
    return meta?.[MANAGED_LAYER_METADATA_FLAG] === true;
}

function applyLayoutOverrides(
    layer: SymbolLayerSpecification,
    overrides?: CityLabelStyleConfig
): void {
    if (!overrides) return;

    layer.layout = layer.layout ?? {};

    if (overrides.textFont) {
        layer.layout["text-font"] = overrides.textFont;
    }

    if (overrides.textSize !== undefined) {
        layer.layout["text-size"] = overrides.textSize;
    }
}

function applyHoverResponsiveTextSize(layer: SymbolLayerSpecification): void {
    // Scale text slightly on hover/selection
    const baseSize = layer.layout?.["text-size"];
    if (typeof baseSize !== "number") return;

    layer.layout = layer.layout ?? {};
    layer.layout["text-size"] = [
        "case",
        ["boolean", ["feature-state", "selected"], false],
        baseSize * 1.1,
        ["boolean", ["feature-state", "hover"], false],
        baseSize * 1.05,
        baseSize
    ] as ExpressionSpecification;
}

/**
 * Build a feature-state-driven color expression
 */
function buildFeatureStateColor(
    base: string,
    hover: string,
    selected: string
): ExpressionSpecification {
    return [
        "case",
        ["boolean", ["feature-state", "selected"], false],
        selected,
        ["boolean", ["feature-state", "hover"], false],
        hover,
        base
    ];
}

/**
 * Build a feature-state-driven number expression
 */
function buildFeatureStateNumber(
    base: number,
    hover: number,
    selected: number
): ExpressionSpecification {
    return [
        "case",
        ["boolean", ["feature-state", "selected"], false],
        selected,
        ["boolean", ["feature-state", "hover"], false],
        hover,
        base
    ];
}
