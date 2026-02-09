"use client";

/**
 * Insecurity Badge Component
 *
 * Displays a colored badge showing the insecurity level for a commune.
 * Uses the pre-computed `levelCategory` field (0-4) from the SSMSI data export.
 *
 * Double Perspective (Phase 3):
 * - Main badge displays levelCategory (category-based comparison)
 * - Subtitle shows rankInCategory and category label
 * - Tooltip shows both category and national perspectives
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

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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

/**
 * Get singular label for population category.
 */
function getCategorySingularLabel(category: string | null): string {
    if (!category) return "Commune";
    switch (category) {
        case "small": return "Petite commune";
        case "medium": return "Commune moyenne";
        case "large": return "Grande ville";
        default: return "Commune";
    }
}

/**
 * Convert rate per 100k to percentage.
 */
function rateToPercentage(ratePer100k: number | null): string {
    if (ratePer100k === null) return "N/A";
    return ((ratePer100k / 1000).toFixed(1)) + "%";
}

/**
 * Calculate absolute number of incidents from rate and population.
 */
function calculateAbsoluteIncidents(
    ratePer100k: number | null,
    population: number | null
): string {
    if (ratePer100k === null || population === null) return "N/A";
    return Math.round((ratePer100k / 100000) * population).toString();
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
    if (error || !data) {
        return null;
    }

    const level = data.levelCategory;
    const bgColor = getLevelColor(level);
    const label = getLevelLabel(level);

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <span
                        className={cn(
                            "inline-flex items-center rounded-full px-3 py-1 text-sm font-medium text-white",
                            className
                        )}
                        style={{ backgroundColor: bgColor }}
                        {...props}
                    >
                        {label}
                    </span>
                </TooltipTrigger>
                <TooltipContent>
                    <div className="space-y-2">
                        <p className="font-medium">
                            {getCategorySingularLabel(data.populationCategory)}
                        </p>

                        <div className="text-s space-y-1">
                            <p>Violences physiques : {rateToPercentage(data.violencesPersonnesPer100k)} hbts touchés</p>
                            <p>Atteintes aux biens : {rateToPercentage(data.securiteBiensPer100k)} hbts touchés</p>
                            <p>{calculateAbsoluteIncidents(data.tranquillitePer100k, data.population)} incidents à l'ordre publique</p>
                        </div>

                        {data.dataCompleteness < 1.0 && (
                            <p className="text-amber-600 text-xs">
                                Données partielles ({Math.round(data.dataCompleteness * 100)}%)
                            </p>
                        )}

                        <p className="text-xs text-muted-foreground">
                            Année {data.year}
                        </p>
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

// ============================================================================
// Exports for direct access
// ============================================================================

export { getLevelLabel };

