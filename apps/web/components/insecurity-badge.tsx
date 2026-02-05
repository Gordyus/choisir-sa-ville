"use client";

/**
 * Insecurity Badge Component
 *
 * Displays a colored badge showing the insecurity level for a commune.
 * Uses the SSMSI indexGlobal (0-100 percentile rank) to determine level.
 *
 * Levels (using centralized INSECURITY_PALETTE):
 * - Faible (0-24): Green (#22c55e)
 * - Modéré (25-49): Yellow (#eab308)
 * - Élevé (50-74): Orange (#f97316)
 * - Très élevé (75-100): Red (#ef4444)
 *
 * Per spec: badge is entity-centric. For infraZones, pass parent commune INSEE code.
 */

import type { HTMLAttributes } from "react";

import { INSECURITY_PALETTE } from "@/lib/config/insecurityPalette";
import {
    type InsecurityLevel,
    getInsecurityLevelLabel,
    useInsecurityMetrics
} from "@/lib/data/insecurityMetrics";
import { cn } from "@/lib/utils";

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

    const bgColor = INSECURITY_PALETTE[data.level];
    const label = getInsecurityLevelLabel(data.level);

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

export { getInsecurityLevelLabel, type InsecurityLevel };

