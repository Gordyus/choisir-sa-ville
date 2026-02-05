"use client";

/**
 * Insecurity Badge Component
 *
 * Displays a colored badge showing the insecurity level for a commune.
 * Uses the pre-computed `level` field (0-4) from the SSMSI data export.
 *
 * Levels (using INSECURITY_COLORS palette):
 * - 0: Très faible (very low) - Green (#22c55e)
 * - 1: Faible (low) - Lime (#84cc16)
 * - 2: Modéré (moderate) - Yellow (#eab308)
 * - 3: Élevé (high) - Orange (#f97316)
 * - 4: Plus élevé (very high) - Red (#ef4444)
 *
 * Per spec: badge is entity-centric. For infraZones, pass parent commune INSEE code.
 */

import type { HTMLAttributes } from "react";

import { INSECURITY_COLORS } from "@/lib/config/insecurityPalette";
import { useInsecurityMetrics } from "@/lib/data/insecurityMetrics";
import { cn } from "@/lib/utils";

// ============================================================================
// Constants
// ============================================================================

/**
 * Level labels (0-4) matching the exported data classification.
 */
const LEVEL_LABELS = [
    "Très faible", // 0
    "Faible",      // 1
    "Modéré",      // 2
    "Élevé",       // 3
    "Plus élevé"   // 4
] as const;

// ============================================================================
// Types
// ============================================================================

export interface InsecurityBadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
    /**
     * INSEE code of the commune.
     * For infraZones, pass the parent commune's INSEE code.
     */
    inseeCode: string | null;

    /**
     * Optional year to display. Defaults to latest available.
     */
    year?: number;

    /**
     * Whether to show a loading skeleton while fetching.
     * @default false
     */
    showLoading?: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get display label for a level code (0-4).
 */
function getLevelLabel(level: number | null): string {
    if (level === null || !Number.isFinite(level)) {
        return "";
    }

    const index = Math.max(0, Math.min(4, Math.floor(level)));
    return LEVEL_LABELS[index] ?? "";
}

/**
 * Get color for a level code (0-4).
 */
function getLevelColor(level: number | null): string {
    if (level === null || !Number.isFinite(level)) {
        return INSECURITY_COLORS[0]; // Default to très faible
    }

    const index = Math.max(0, Math.min(4, Math.floor(level)));
    return INSECURITY_COLORS[index] ?? INSECURITY_COLORS[0];
}

// ============================================================================
// Component
// ============================================================================

/**
 * Badge displaying commune insecurity level.
 *
 * Automatically hides when:
 * - No INSEE code provided
 * - No data available for the commune
 * - Data is loading (unless showLoading=true)
 *
 * @example
 * // For a commune
 * <InsecurityBadge inseeCode="75056" />
 *
 * // For an infraZone (use parent commune code)
 * <InsecurityBadge inseeCode={infraZone.parentCommuneCode} />
 */
export function InsecurityBadge({
    inseeCode,
    year,
    showLoading = false,
    className,
    ...props
}: InsecurityBadgeProps): JSX.Element | null {
    const { data, loading, error } = useInsecurityMetrics(inseeCode, year);

    // Hide during loading unless explicitly requested
    if (loading && !showLoading) {
        return null;
    }

    // Show loading skeleton
    if (loading && showLoading) {
        return (
            <span
                className={cn(
                    "inline-block h-5 w-16 animate-pulse rounded-full bg-brand/10",
                    className
                )}
                {...props}
            />
        );
    }

    // Hide on error or no data
    if (error || !data || data.level === null) {
        return null;
    }

    const bgColor = getLevelColor(data.level);
    const label = getLevelLabel(data.level);

    return (
        <span
            className={cn(
                "inline-flex items-center rounded-full px-3 py-1 text-sm font-medium text-white",
                className
            )}
            style={{ backgroundColor: bgColor }}
            title={`Indice d'insécurité: ${data.indexGlobal ?? "—"}/100 (${data.year})`}
            {...props}
        >
            {label}
        </span>
    );
}

// ============================================================================
// Exports for direct access
// ============================================================================

export { getLevelLabel };

