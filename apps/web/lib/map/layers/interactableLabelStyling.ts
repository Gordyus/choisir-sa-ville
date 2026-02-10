/**
 * Interactable Label Styling - Apply feature-state-based styling to a single label layer.
 *
 * This module is intentionally small and opinionated:
 * - No legacy/backward compatibility paths
 * - Single exported entry point used by the style pipeline
 * - Only uses feature-state flags: hasData, highlight, active
 *
 * Goal:
 * - Labels with data (hasData=true) are visually distinct and clearly clickable
 * - Labels without data are de-emphasized but still readable
 */

import type { ExpressionSpecification, LayerSpecification, SymbolLayerSpecification } from "maplibre-gl";

import type { CityLabelStyleConfig } from "@/lib/config/mapTilesConfig";
import { ENTITY_STATE_COLORS } from "./entityVisualStateColors";

const DEFAULTS = {
    textColor: ENTITY_STATE_COLORS.hasData,
    highlightTextColor: ENTITY_STATE_COLORS.highlight,
    activeTextColor: ENTITY_STATE_COLORS.active,
    textHaloColor: "#ffffff",
    highlightTextHaloColor: "#ffffff",
    activeTextHaloColor: "#ffffff",
    textHaloWidth: 2.8,
    highlightTextHaloWidth: 3.6,
    activeTextHaloWidth: 4.2,

    noDataTextColor: ENTITY_STATE_COLORS.noData,
    noDataTextOpacity: 1,
    noDataTextHaloColor: "rgba(255,255,255,0.65)",
    noDataTextHaloWidth: 1.4
} as const;

export function applyInteractableLabelStyling(
    layers: LayerSpecification[],
    targetLayerId: string,
    style?: CityLabelStyleConfig
): void {
    const layer = layers.find(
        (entry): entry is SymbolLayerSpecification =>
            entry.id === targetLayerId && entry.type === "symbol"
    );
    if (!layer) {
        return;
    }

    layer.paint = layer.paint ?? {};

    const textColor = style?.textColor ?? DEFAULTS.textColor;
    const highlightTextColor = style?.highlightTextColor ?? DEFAULTS.highlightTextColor;
    const activeTextColor = style?.activeTextColor ?? DEFAULTS.activeTextColor;

    const textHaloColor = style?.textHaloColor ?? DEFAULTS.textHaloColor;
    const highlightTextHaloColor = style?.highlightTextHaloColor ?? DEFAULTS.highlightTextHaloColor;
    const activeTextHaloColor = style?.activeTextHaloColor ?? DEFAULTS.activeTextHaloColor;

    const textHaloWidth = style?.textHaloWidth ?? DEFAULTS.textHaloWidth;
    const highlightTextHaloWidth = style?.highlightTextHaloWidth ?? DEFAULTS.highlightTextHaloWidth;
    const activeTextHaloWidth = style?.activeTextHaloWidth ?? DEFAULTS.activeTextHaloWidth;

    layer.paint["text-color"] = buildLabelCaseExpr({
        active: activeTextColor,
        highlight: highlightTextColor,
        hasData: textColor,
        noData: DEFAULTS.noDataTextColor
    });

    layer.paint["text-opacity"] = buildHasDataOpacityExpr(
        1,
        DEFAULTS.noDataTextOpacity
    );

    layer.paint["text-halo-color"] = buildLabelCaseExpr({
        active: activeTextHaloColor,
        highlight: highlightTextHaloColor,
        hasData: textHaloColor,
        noData: DEFAULTS.noDataTextHaloColor
    });

    layer.paint["text-halo-width"] = buildLabelCaseExpr({
        active: activeTextHaloWidth,
        highlight: highlightTextHaloWidth,
        hasData: textHaloWidth,
        noData: DEFAULTS.noDataTextHaloWidth
    });

    layer.paint["text-halo-blur"] = 0;
}

function buildLabelCaseExpr(values: {
    active: unknown;
    highlight: unknown;
    hasData: unknown;
    noData: unknown;
}): ExpressionSpecification {
    return [
        "case",
        ["boolean", ["feature-state", "active"], false],
        values.active,
        ["boolean", ["feature-state", "highlight"], false],
        values.highlight,
        ["boolean", ["feature-state", "hasData"], false],
        values.hasData,
        values.noData
    ] as ExpressionSpecification;
}

function buildHasDataOpacityExpr(
    hasDataOpacity: number,
    noDataOpacity: number
): ExpressionSpecification {
    return [
        "case",
        ["boolean", ["feature-state", "hasData"], false],
        hasDataOpacity,
        noDataOpacity
    ] as ExpressionSpecification;
}
