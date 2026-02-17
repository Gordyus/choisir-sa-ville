"use client";

/**
 * ToggleGroup for urban/rural/any living preference.
 */

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { LivingPreference } from "@/lib/search/types";

interface LivingPreferencePickerProps {
    value: LivingPreference;
    onChange: (pref: LivingPreference) => void;
}

const OPTIONS: Array<{ value: LivingPreference; label: string }> = [
    { value: "urban", label: "Urbain" },
    { value: "rural", label: "Rural" },
    { value: "any", label: "Indifferent" },
];

export default function LivingPreferencePicker({ value, onChange }: LivingPreferencePickerProps) {
    return (
        <ToggleGroup
            type="single"
            value={value}
            onValueChange={(next: string) => {
                if (next === "urban" || next === "rural" || next === "any") {
                    onChange(next);
                }
            }}
            className="justify-start"
        >
            {OPTIONS.map((option) => (
                <ToggleGroupItem
                    key={option.value}
                    value={option.value}
                    className="text-sm"
                >
                    {option.label}
                </ToggleGroupItem>
            ))}
        </ToggleGroup>
    );
}
