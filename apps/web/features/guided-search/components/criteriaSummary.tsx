"use client";

/**
 * Compact read-only summary of search criteria.
 * Used in both computing and results phases.
 */

import { Badge } from "@/components/ui/badge";
import { INSECURITY_COLORS } from "@/lib/config/insecurityPalette";
import type { SearchCriteria } from "@/lib/search/types";

const INSECURITY_LABELS: Record<number, string> = {
    0: "Tres faible",
    1: "Faible",
    2: "Modere",
    3: "Eleve",
    4: "Plus eleve",
};

const LIVING_LABELS: Record<string, string> = {
    urban: "Urbain",
    rural: "Rural",
    any: "Indifferent",
};

interface CriteriaSummaryProps {
    criteria: SearchCriteria;
}

export default function CriteriaSummary({ criteria }: CriteriaSummaryProps) {
    return (
        <div className="flex flex-wrap items-center gap-2 text-sm">
            {criteria.destination !== null && (
                <Badge>{criteria.destination.label}</Badge>
            )}
            {criteria.travelTimeTargets.map((target, i) => (
                <span key={i} className="text-muted-foreground">
                    {target.destination.label} · {target.maxMinutes} min
                    · {target.mode === "car" ? "Voiture" : "Transports"}
                </span>
            ))}
            {criteria.minSecurityLevel !== null && (
                <span
                    className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                    style={{ backgroundColor: INSECURITY_COLORS[criteria.minSecurityLevel] }}
                >
                    {INSECURITY_LABELS[criteria.minSecurityLevel] ?? `Niveau ${criteria.minSecurityLevel}`}
                </span>
            )}
            <span className="text-muted-foreground">
                {LIVING_LABELS[criteria.livingPreference] ?? criteria.livingPreference}
            </span>
        </div>
    );
}
