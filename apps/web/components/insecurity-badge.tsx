"use client";

/**
 * Insecurity Badge Component
 *
 * Displays a colored badge showing the insecurity level for a commune.
 * Uses the SSMSI indexGlobal (0-100 percentile rank) to determine level.
 *
 * Levels:
 * - Faible (0-24): Green
 * - Modéré (25-49): Amber
 * - Élevé (50-74): Orange
 * - Très élevé (75-100): Red
 *
 * Per spec: badge is entity-centric. For infraZones, pass parent commune INSEE code.
 */

import type { HTMLAttributes } from "react";

import { Badge, type BadgeProps } from "@/components/ui/badge";
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
// Level → Badge Variant Mapping
// ============================================================================

type BadgeVariant = NonNullable<BadgeProps["variant"]>;

const levelVariants: Record<InsecurityLevel, BadgeVariant> = {
    faible: "success",
    modere: "warning",
    eleve: "warning", // Will apply custom orange color
    "tres-eleve": "danger"
};

const levelCustomStyles: Record<InsecurityLevel, string> = {
    faible: "",
    modere: "",
    eleve: "bg-orange-100 text-orange-800", // Custom orange (amber variant is yellow-ish)
    "tres-eleve": ""
};

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

    const variant = levelVariants[data.level];
    const customStyle = levelCustomStyles[data.level];
    const label = getInsecurityLevelLabel(data.level);

    return (
        <Badge
            variant={variant}
            className={cn(customStyle, className)}
            title={`Indice d'insécurité: ${data.indexGlobal ?? "—"}/100 (${data.year})`}
            {...props}
        >
            {label}
        </Badge>
    );
}

// ============================================================================
// Exports for direct access
// ============================================================================

export { getInsecurityLevelLabel, type InsecurityLevel };

