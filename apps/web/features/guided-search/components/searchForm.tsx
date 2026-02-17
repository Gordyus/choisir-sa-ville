"use client";

/**
 * Search form with toggle-box criteria and submit button.
 * Criteria are displayed as a grid of toggleable boxes.
 * Parameters for selected criteria appear below the grid.
 */

import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { displayModeService } from "@/lib/map/state/displayModeService";
import { getSearchService } from "@/lib/search/searchService";
import type { Destination, LivingPreference, SearchCriteria } from "@/lib/search/types";
import { DEFAULT_CRITERIA } from "@/lib/search/types";

import { useEstimatedCount } from "../hooks/useEstimatedCount";
import AddressAutocomplete from "./addressAutocomplete";
import CriterionToggleBox from "./criterionToggleBox";
import LivingPreferencePicker from "./livingPreferencePicker";
import SecurityLevelPicker from "./securityLevelPicker";

type CriterionId = "travelTime" | "security" | "livingPreference" | "budget";

const CRITERIA_DEFINITIONS: Array<{
    id: CriterionId;
    label: string;
    icon: string;
    disabled?: boolean;
    disabledLabel?: string;
}> = [
    { id: "travelTime", label: "Temps de trajet", icon: "\u{1F551}" },
    { id: "security", label: "Securite", icon: "\u{1F6E1}\uFE0F" },
    { id: "livingPreference", label: "Cadre de vie", icon: "\u{1F333}" },
    { id: "budget", label: "Budget", icon: "\u{1F4B0}", disabled: true, disabledLabel: "Bientot" },
];

export default function SearchForm() {
    const [destination, setDestination] = useState<Destination | null>(
        DEFAULT_CRITERIA.destination
    );
    const [maxTravelMinutes, setMaxTravelMinutes] = useState(
        DEFAULT_CRITERIA.maxTravelMinutes
    );
    const [minSecurityLevel, setMinSecurityLevel] = useState<number | null>(
        DEFAULT_CRITERIA.minSecurityLevel
    );
    const [livingPreference, setLivingPreference] = useState<LivingPreference>(
        DEFAULT_CRITERIA.livingPreference
    );
    const [radiusKm, setRadiusKm] = useState(DEFAULT_CRITERIA.radiusKm);
    const [selectedCriteria, setSelectedCriteria] = useState<Set<CriterionId>>(
        () => new Set(["travelTime"])
    );

    const { count, isLoading: isCountLoading } = useEstimatedCount({
        destination,
        maxTravelMinutes,
        radiusKm,
        minSecurityLevel,
        livingPreference,
    });

    const handleToggle = useCallback((id: string) => {
        setSelectedCriteria((prev) => {
            const next = new Set(prev);
            if (next.has(id as CriterionId)) {
                next.delete(id as CriterionId);
            } else {
                next.add(id as CriterionId);
            }
            return next;
        });
    }, []);

    const handleSubmit = useCallback(
        (e: React.FormEvent) => {
            e.preventDefault();
            if (destination === null) return;

            const criteria: SearchCriteria = {
                destination,
                maxTravelMinutes,
                radiusKm,
                minSecurityLevel: selectedCriteria.has("security") ? minSecurityLevel : null,
                livingPreference: selectedCriteria.has("livingPreference") ? livingPreference : "any",
            };

            getSearchService().startSearch(criteria);
            displayModeService.setMode("search");
        },
        [destination, maxTravelMinutes, radiusKm, minSecurityLevel, livingPreference, selectedCriteria]
    );

    const ctaLabel = (() => {
        if (destination === null) return "Rechercher";
        if (isCountLoading) return "Rechercher (~...)";
        if (count !== null) return `Rechercher (~${count} communes)`;
        return "Rechercher";
    })();

    return (
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {/* Destination + radius */}
                <div className="space-y-3">
                    <AddressAutocomplete
                        value={destination}
                        onSelect={setDestination}
                    />
                    {destination !== null && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">Dans un rayon de</span>
                                <span className="text-sm font-medium text-brand">
                                    {radiusKm} km
                                </span>
                            </div>
                            <Slider
                                min={10}
                                max={50}
                                step={5}
                                value={[radiusKm]}
                                onValueChange={(values: number[]) => {
                                    const next = values[0];
                                    if (next !== undefined) {
                                        setRadiusKm(next);
                                    }
                                }}
                            />
                        </div>
                    )}
                </div>

                <Separator />

                {/* Criteria toggle boxes */}
                <div className="space-y-3">
                    <Label>Criteres</Label>
                    <div className="grid grid-cols-4 gap-2">
                        {CRITERIA_DEFINITIONS.map((criterion) => (
                            <CriterionToggleBox
                                key={criterion.id}
                                id={criterion.id}
                                label={criterion.label}
                                icon={criterion.icon}
                                selected={selectedCriteria.has(criterion.id)}
                                disabled={criterion.disabled}
                                disabledLabel={criterion.disabledLabel}
                                onToggle={handleToggle}
                            />
                        ))}
                    </div>
                    <button
                        type="button"
                        className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                        disabled
                    >
                        + de criteres
                    </button>
                </div>

                {/* Parameters for selected criteria */}
                {(selectedCriteria.has("travelTime") ||
                  selectedCriteria.has("security") ||
                  selectedCriteria.has("livingPreference")) && (
                    <>
                        <Separator />
                        <div className="space-y-5">
                            {selectedCriteria.has("travelTime") && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label>Temps de trajet max</Label>
                                        <span className="text-sm font-medium text-brand">
                                            {maxTravelMinutes} min
                                        </span>
                                    </div>
                                    <Slider
                                        min={15}
                                        max={90}
                                        step={5}
                                        value={[maxTravelMinutes]}
                                        onValueChange={(values: number[]) => {
                                            const next = values[0];
                                            if (next !== undefined) {
                                                setMaxTravelMinutes(next);
                                            }
                                        }}
                                    />
                                </div>
                            )}

                            {selectedCriteria.has("security") && (
                                <div className="space-y-2">
                                    <Label>Niveau de securite minimum</Label>
                                    <SecurityLevelPicker
                                        value={minSecurityLevel}
                                        onChange={setMinSecurityLevel}
                                    />
                                </div>
                            )}

                            {selectedCriteria.has("livingPreference") && (
                                <div className="space-y-2">
                                    <Label>Cadre de vie</Label>
                                    <LivingPreferencePicker
                                        value={livingPreference}
                                        onChange={setLivingPreference}
                                    />
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Sticky CTA */}
            <div className="p-4 border-t flex-shrink-0">
                <Button
                    type="submit"
                    className="w-full"
                    disabled={destination === null}
                >
                    {ctaLabel}
                </Button>
            </div>
        </form>
    );
}
