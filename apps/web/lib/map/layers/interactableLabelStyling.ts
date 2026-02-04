import type {
    ExpressionSpecification,
    StyleSpecification,
    SymbolLayerSpecification
} from "maplibre-gl";

import type { CityLabelStyleConfig } from "@/lib/config/mapTilesConfig";

// Defaults are intentionally high-contrast so users can immediately spot data-backed (clickable) labels.
const DEFAULT_TEXT_COLOR = "#111827"; // near-black
const HIGHLIGHT_TEXT_COLOR = "#2563eb"; // blue
const ACTIVE_TEXT_COLOR = "#f59e0b"; // amber
const DEFAULT_HALO_COLOR = "#ffffff"; // white outline for readability
const HIGHLIGHT_HALO_COLOR = "#ffffff";
const ACTIVE_HALO_COLOR = "#ffffff";
const DEFAULT_HALO_WIDTH = 2.8;
const HIGHLIGHT_HALO_WIDTH = 3.6;
const ACTIVE_HALO_WIDTH = 4.2;

// Explicit non-interactable styling (do not depend on server defaults).
const NO_DATA_TEXT_COLOR = "#6b7280"; // gray-500
const NO_DATA_HALO_COLOR = "rgba(255,255,255,0.75)";
const NO_DATA_HALO_WIDTH = 1.3;
const NO_DATA_TEXT_OPACITY = 0.35;

/**
 * Apply feature-state-driven styling to the server-provided interactable label layer.
 */
export function applyInteractableLabelStyling(
    layers: StyleSpecification["layers"],
    targetLayerId: string,
    styleOverrides?: CityLabelStyleConfig
): void {
    if (!layers || !targetLayerId) {
        return;
    }

    for (const layer of layers) {
        if (!layer || layer.type !== "symbol" || layer.id !== targetLayerId) {
            continue;
        }

        const symbolLayer = layer as SymbolLayerSpecification;
        symbolLayer.paint = buildManagedPaint(symbolLayer.paint, styleOverrides);
    }
}

type SymbolPaint = Exclude<SymbolLayerSpecification["paint"], undefined>;

function buildManagedPaint(
    basePaint: SymbolLayerSpecification["paint"],
    overrides?: CityLabelStyleConfig
): SymbolPaint {
    const paint: SymbolPaint = { ...(basePaint ?? {}) };

    paint["text-color"] = buildHasDataFeatureStateValue(
        NO_DATA_TEXT_COLOR,
        overrides?.textColor ?? DEFAULT_TEXT_COLOR,
        overrides?.highlightTextColor ?? HIGHLIGHT_TEXT_COLOR,
        overrides?.activeTextColor ?? ACTIVE_TEXT_COLOR
    );

    paint["text-halo-color"] = buildHasDataFeatureStateValue(
        NO_DATA_HALO_COLOR,
        overrides?.textHaloColor ?? DEFAULT_HALO_COLOR,
        overrides?.highlightTextHaloColor ?? HIGHLIGHT_HALO_COLOR,
        overrides?.activeTextHaloColor ?? ACTIVE_HALO_COLOR
    );

    paint["text-halo-width"] = buildHasDataFeatureStateValue(
        NO_DATA_HALO_WIDTH,
        overrides?.textHaloWidth ?? DEFAULT_HALO_WIDTH,
        overrides?.highlightTextHaloWidth ?? HIGHLIGHT_HALO_WIDTH,
        overrides?.activeTextHaloWidth ?? ACTIVE_HALO_WIDTH
    );

    paint["text-opacity"] = buildHasDataOpacityExpr(NO_DATA_TEXT_OPACITY);

    return paint;
}

function buildHasDataFeatureStateValue(
    baseNoData: unknown,
    baseHasData: unknown,
    highlight: unknown,
    active: unknown
): ExpressionSpecification {
    return [
        "case",
        ["boolean", ["feature-state", "active"], false],
        active,
        ["boolean", ["feature-state", "highlight"], false],
        highlight,
        ["boolean", ["feature-state", "hasData"], false],
        baseHasData,
        baseNoData
    ] as ExpressionSpecification;
}

function buildHasDataOpacityExpr(noDataOpacity: number): ExpressionSpecification {
    return [
        "case",
        ["boolean", ["feature-state", "hasData"], false],
        1,
        noDataOpacity
    ] as ExpressionSpecification;
}
