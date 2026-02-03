/**
 * Hover State Helpers - Build feature-state-aware MapLibre expressions.
 * Used for hover/selected styling on polygons and labels.
 *
 * IMPORTANT: These expressions avoid nesting zoom-based interpolations inside
 * case expressions to prevent the MapLibre "Only one zoom-based step/interpolate
 * subexpression may be used in an expression" error.
 */

import type { ExpressionSpecification } from "maplibre-gl";

// ============================================================================
// Color Palettes
// ============================================================================

export const COMMUNE_COLORS = {
    fill: {
        base: "#0f172a",
        hover: "#2d5bff",
        selected: "#f59e0b"
    },
    line: {
        base: "#0f172a",
        hover: "#2d5bff",
        selected: "#f59e0b"
    }
} as const;

export const ARR_MUNICIPAL_COLORS = {
    fill: {
        base: "#082032",
        hover: "#38bdf8",
        selected: "#f59e0b"
    },
    line: {
        base: "#0f172a",
        hover: "#38bdf8",
        selected: "#f59e0b"
    }
} as const;

// ============================================================================
// Opacity Values
// ============================================================================

export const COMMUNE_OPACITY = {
    fill: { base: 0, hover: 0.16, selected: 0.24 },
    line: { base: 0, hover: 0.85, selected: 1 }
} as const;

export const ARR_MUNICIPAL_OPACITY = {
    fill: { base: 0, hover: 0.12, selected: 0.2 },
    line: { base: 0, hover: 0.85, selected: 1 }
} as const;

// ============================================================================
// Line Width Values (fixed per zoom, not interpolated inside case)
// ============================================================================

export const COMMUNE_LINE_WIDTH = {
    hover: 1.2,
    selected: 1.8
} as const;

export const ARR_MUNICIPAL_LINE_WIDTH = {
    hover: 1.0,
    selected: 1.5
} as const;

// ============================================================================
// Feature State Expression Builders
// ============================================================================

/**
 * Build a simple case expression that switches on feature-state hover/selected.
 * Does NOT contain zoom interpolation - safe to use for any paint property.
 */
export function buildFeatureStateCaseExpr(
    baseValue: unknown,
    hoverValue: unknown,
    selectedValue: unknown
): ExpressionSpecification {
    return [
        "case",
        ["boolean", ["feature-state", "selected"], false],
        selectedValue,
        ["boolean", ["feature-state", "hover"], false],
        hoverValue,
        baseValue
    ] as ExpressionSpecification;
}

/**
 * Build a line-width expression for polygon borders.
 * Uses a simple case expression with static values - no nested interpolations.
 */
export function buildLineWidthExpr(
    baseWidth: number,
    hoverWidth: number,
    selectedWidth: number
): ExpressionSpecification {
    return buildFeatureStateCaseExpr(baseWidth, hoverWidth, selectedWidth);
}

/**
 * Build a fill color expression with hover/selected states.
 */
export function buildFillColorExpr(colors: {
    base: string;
    hover: string;
    selected: string;
}): ExpressionSpecification {
    return buildFeatureStateCaseExpr(colors.base, colors.hover, colors.selected);
}

/**
 * Build a fill opacity expression with hover/selected states.
 */
export function buildFillOpacityExpr(opacity: {
    base: number;
    hover: number;
    selected: number;
}): ExpressionSpecification {
    return buildFeatureStateCaseExpr(opacity.base, opacity.hover, opacity.selected);
}

/**
 * Build a line color expression with hover/selected states.
 */
export function buildLineColorExpr(colors: {
    base: string;
    hover: string;
    selected: string;
}): ExpressionSpecification {
    return buildFeatureStateCaseExpr(colors.base, colors.hover, colors.selected);
}

/**
 * Build a line opacity expression with hover/selected states.
 */
export function buildLineOpacityExpr(opacity: {
    base: number;
    hover: number;
    selected: number;
}): ExpressionSpecification {
    return buildFeatureStateCaseExpr(opacity.base, opacity.hover, opacity.selected);
}

// ============================================================================
// Label Text Styling
// ============================================================================

export const LABEL_TEXT_COLORS = {
    base: "#1f2933",
    hover: "#1130ff",
    selected: "#0f172a"
} as const;

export const LABEL_HALO_COLORS = {
    base: "#f7f4ef",
    hover: "#ffffff",
    selected: "#ffe28f"
} as const;

export const LABEL_HALO_WIDTH = {
    base: 1.5,
    hover: 2.2,
    selected: 2.8
} as const;

/**
 * Build text color expression for labels with hover/selected states.
 */
export function buildTextColorExpr(overrides?: {
    base?: string;
    hover?: string;
    selected?: string;
}): ExpressionSpecification {
    return buildFeatureStateCaseExpr(
        overrides?.base ?? LABEL_TEXT_COLORS.base,
        overrides?.hover ?? LABEL_TEXT_COLORS.hover,
        overrides?.selected ?? LABEL_TEXT_COLORS.selected
    );
}

/**
 * Build text halo color expression for labels with hover/selected states.
 */
export function buildTextHaloColorExpr(overrides?: {
    base?: string;
    hover?: string;
    selected?: string;
}): ExpressionSpecification {
    return buildFeatureStateCaseExpr(
        overrides?.base ?? LABEL_HALO_COLORS.base,
        overrides?.hover ?? LABEL_HALO_COLORS.hover,
        overrides?.selected ?? LABEL_HALO_COLORS.selected
    );
}

/**
 * Build text halo width expression for labels with hover/selected states.
 */
export function buildTextHaloWidthExpr(overrides?: {
    base?: number;
    hover?: number;
    selected?: number;
}): ExpressionSpecification {
    return buildFeatureStateCaseExpr(
        overrides?.base ?? LABEL_HALO_WIDTH.base,
        overrides?.hover ?? LABEL_HALO_WIDTH.hover,
        overrides?.selected ?? LABEL_HALO_WIDTH.selected
    );
}
