/**
 * Highlight State Helpers - Build feature-state-aware MapLibre expressions.
 * Used for highlight/active styling on polygons and labels.
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
        highlight: "#2d5bff",
        active: "#f59e0b"
    },
    line: {
        base: "#0f172a",
        highlight: "#2d5bff",
        active: "#f59e0b"
    }
} as const;

export const ARR_MUNICIPAL_COLORS = {
    fill: {
        base: "#082032",
        highlight: "#38bdf8",
        active: "#f59e0b"
    },
    line: {
        base: "#0f172a",
        highlight: "#38bdf8",
        active: "#f59e0b"
    }
} as const;

// ============================================================================
// Opacity Values
// ============================================================================

export const COMMUNE_OPACITY = {
    fill: { base: 0, highlight: 0.16, active: 0.24 },
    line: { base: 0, highlight: 0.85, active: 1 }
} as const;

export const ARR_MUNICIPAL_OPACITY = {
    fill: { base: 0, highlight: 0.12, active: 0.2 },
    line: { base: 0, highlight: 0.85, active: 1 }
} as const;

// ============================================================================
// Line Width Values (fixed per zoom, not interpolated inside case)
// ============================================================================

export const COMMUNE_LINE_WIDTH = {
    highlight: 1.2,
    active: 1.8
} as const;

export const ARR_MUNICIPAL_LINE_WIDTH = {
    highlight: 1.0,
    active: 1.5
} as const;

// ============================================================================
// Feature State Expression Builders
// ============================================================================

/**
 * Build a simple case expression that switches on feature-state highlight/active.
 * Does NOT contain zoom interpolation - safe to use for any paint property.
 */
export function buildFeatureStateCaseExpr(
    baseValue: unknown,
    highlightValue: unknown,
    activeValue: unknown
): ExpressionSpecification {
    return [
        "case",
        ["boolean", ["feature-state", "active"], false],
        activeValue,
        ["boolean", ["feature-state", "highlight"], false],
        highlightValue,
        baseValue
    ] as ExpressionSpecification;
}

/**
 * Build a line-width expression for polygon borders.
 * Uses a simple case expression with static values - no nested interpolations.
 */
export function buildLineWidthExpr(
    baseWidth: number,
    highlightWidth: number,
    activeWidth: number
): ExpressionSpecification {
    return buildFeatureStateCaseExpr(baseWidth, highlightWidth, activeWidth);
}

/**
 * Build a fill color expression with highlight/active states.
 */
export function buildFillColorExpr(colors: {
    base: string;
    highlight: string;
    active: string;
}): ExpressionSpecification {
    return buildFeatureStateCaseExpr(colors.base, colors.highlight, colors.active);
}

/**
 * Build a fill opacity expression with highlight/active states.
 */
export function buildFillOpacityExpr(opacity: {
    base: number;
    highlight: number;
    active: number;
}): ExpressionSpecification {
    return buildFeatureStateCaseExpr(opacity.base, opacity.highlight, opacity.active);
}

/**
 * Build a line color expression with highlight/active states.
 */
export function buildLineColorExpr(colors: {
    base: string;
    highlight: string;
    active: string;
}): ExpressionSpecification {
    return buildFeatureStateCaseExpr(colors.base, colors.highlight, colors.active);
}

/**
 * Build a line opacity expression with highlight/active states.
 */
export function buildLineOpacityExpr(opacity: {
    base: number;
    highlight: number;
    active: number;
}): ExpressionSpecification {
    return buildFeatureStateCaseExpr(opacity.base, opacity.highlight, opacity.active);
}

// ============================================================================
// Label Text Styling
// ============================================================================

export const LABEL_TEXT_COLORS = {
    base: "#1f2933",
    highlight: "#1130ff",
    active: "#0f172a"
} as const;

export const LABEL_HALO_COLORS = {
    base: "#f7f4ef",
    highlight: "#ffffff",
    active: "#ffe28f"
} as const;

export const LABEL_HALO_WIDTH = {
    base: 1.5,
    highlight: 2.2,
    active: 2.8
} as const;

/**
 * Build text color expression for labels with highlight/active states.
 */
export function buildTextColorExpr(overrides?: {
    base?: string;
    highlight?: string;
    active?: string;
}): ExpressionSpecification {
    return buildFeatureStateCaseExpr(
        overrides?.base ?? LABEL_TEXT_COLORS.base,
        overrides?.highlight ?? LABEL_TEXT_COLORS.highlight,
        overrides?.active ?? LABEL_TEXT_COLORS.active
    );
}

/**
 * Build text halo color expression for labels with highlight/active states.
 */
export function buildTextHaloColorExpr(overrides?: {
    base?: string;
    highlight?: string;
    active?: string;
}): ExpressionSpecification {
    return buildFeatureStateCaseExpr(
        overrides?.base ?? LABEL_HALO_COLORS.base,
        overrides?.highlight ?? LABEL_HALO_COLORS.highlight,
        overrides?.active ?? LABEL_HALO_COLORS.active
    );
}

/**
 * Build text halo width expression for labels with highlight/active states.
 */
export function buildTextHaloWidthExpr(overrides?: {
    base?: number;
    highlight?: number;
    active?: number;
}): ExpressionSpecification {
    return buildFeatureStateCaseExpr(
        overrides?.base ?? LABEL_HALO_WIDTH.base,
        overrides?.highlight ?? LABEL_HALO_WIDTH.highlight,
        overrides?.active ?? LABEL_HALO_WIDTH.active
    );
}