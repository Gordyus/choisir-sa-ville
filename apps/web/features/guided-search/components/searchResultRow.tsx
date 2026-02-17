"use client";

/**
 * Individual search result row.
 * Shows rank, commune name, travel time, security dots.
 */

import { useCallback } from "react";

import { panelTabService } from "@/lib/panelTab";
import { getEntityStateService } from "@/lib/selection";
import type { SearchResult } from "@/lib/search/types";

interface SearchResultRowProps {
    result: SearchResult;
    rank: number;
}

function formatTravelTime(seconds: number): string {
    return `${Math.round(seconds / 60)} min`;
}

function travelTimeColor(seconds: number): string {
    const minutes = seconds / 60;
    if (minutes < 20) return "text-green-600";
    if (minutes < 40) return "text-yellow-600";
    if (minutes < 60) return "text-orange-600";
    return "text-red-600";
}

/**
 * Security dots: 5 circles.
 * Level 0 = safest (all green), level 4 = least safe (all red).
 * Fill circles up to (4 - level) in green, rest in red.
 *
 * Interpretation: higher securityLevel = higher insecurity.
 * We show 5 dots representing safety: green = safe, red = unsafe.
 */
function SecurityDots({ level }: { level: number | null }) {
    const safeLevel = level ?? 0;
    // Level 0 → 5 green dots (safest), level 4 → 1 green dot
    const greenCount = 5 - safeLevel;

    return (
        <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }, (_, i) => (
                <span
                    key={i}
                    className={
                        "inline-block h-2 w-2 rounded-full " +
                        (i < greenCount ? "bg-green-500" : "bg-red-400")
                    }
                />
            ))}
        </div>
    );
}

export default function SearchResultRow({ result, rank }: SearchResultRowProps) {
    const entityRef = { kind: "commune" as const, inseeCode: result.inseeCode };

    const handleMouseEnter = useCallback(() => {
        getEntityStateService().setHighlighted(entityRef);
    }, [entityRef.inseeCode]);

    const handleMouseLeave = useCallback(() => {
        getEntityStateService().setHighlighted(null);
    }, []);

    const handleClick = useCallback(() => {
        getEntityStateService().setActive(entityRef);
        panelTabService.setTab("explorer");
    }, [entityRef.inseeCode]);

    return (
        <button
            type="button"
            className="w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-accent/50 rounded-lg transition-colors"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
        >
            <span className="text-xs font-medium text-muted-foreground w-6 text-right flex-shrink-0">
                #{rank}
            </span>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{result.communeName}</p>
                <div className="flex items-center gap-3 mt-0.5">
                    <span className={`text-xs font-medium ${travelTimeColor(result.travelSeconds)}`}>
                        {formatTravelTime(result.travelSeconds)}
                    </span>
                    <SecurityDots level={result.securityLevel} />
                </div>
            </div>
        </button>
    );
}
