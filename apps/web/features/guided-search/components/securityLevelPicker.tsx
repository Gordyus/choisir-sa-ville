"use client";

/**
 * Badge-based security level filter.
 * Uses INSECURITY_COLORS for badge backgrounds.
 */

import { INSECURITY_COLORS } from "@/lib/config/insecurityPalette";

const LEVELS: Array<{ label: string; value: number | null }> = [
    { label: "Tous", value: null },
    { label: "Tres faible", value: 0 },
    { label: "Faible", value: 1 },
    { label: "Modere", value: 2 },
    { label: "Eleve", value: 3 },
];

interface SecurityLevelPickerProps {
    value: number | null;
    onChange: (level: number | null) => void;
}

export default function SecurityLevelPicker({ value, onChange }: SecurityLevelPickerProps) {
    return (
        <div className="flex flex-wrap gap-2">
            {LEVELS.map((level) => {
                const isSelected = value === level.value;
                const bgColor = level.value !== null
                    ? INSECURITY_COLORS[level.value]
                    : "#9ca3af";

                return (
                    <button
                        key={level.label}
                        type="button"
                        onClick={() => onChange(level.value)}
                        className={
                            "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium text-white transition-all " +
                            (isSelected ? "ring-2 ring-offset-2 ring-brand" : "")
                        }
                        style={{ backgroundColor: bgColor }}
                    >
                        {level.label}
                    </button>
                );
            })}
        </div>
    );
}
