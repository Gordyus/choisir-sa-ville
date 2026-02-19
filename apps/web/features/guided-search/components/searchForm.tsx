"use client";

/**
 * Search form with toggle-box criteria and submit button.
 * Criteria are displayed as a grid of toggleable boxes.
 * Parameters for selected criteria appear below the grid.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { mapNavigationService, zoomForRadiusKm } from "@/lib/map/mapNavigationService";
import { displayModeService } from "@/lib/map/state/displayModeService";
import { getSearchService } from "@/lib/search/searchService";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type {
    Destination,
    LivingPreference,
    SearchCriteria,
    TransportMode,
    TravelTimeTarget,
} from "@/lib/search/types";
import { DEFAULT_CRITERIA } from "@/lib/search/types";

import { useEstimatedCount } from "../hooks/useEstimatedCount";
import AddressAutocomplete from "./addressAutocomplete";
import CriterionToggleBox from "./criterionToggleBox";
import LivingPreferencePicker from "./livingPreferencePicker";
import SecurityLevelPicker from "./securityLevelPicker";

type CriterionId = "travelTime" | "security" | "livingPreference" | "budget";

type TravelEntry = {
    label: string;
    destination: Destination | null;
    mode: TransportMode;
    maxMinutes: number;
};

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

const MAX_TRAVEL_ENTRIES = 3;

function createDefaultEntry(index: number): TravelEntry {
    const label = index === 0 ? "Travail" : `Lieu ${index + 1}`;
    return { label, destination: null, mode: "car", maxMinutes: 30 };
}

export default function SearchForm() {
    const [destination, setDestination] = useState<Destination | null>(
        DEFAULT_CRITERIA.destination
    );
    const [travelEntries, setTravelEntries] = useState<TravelEntry[]>([createDefaultEntry(0)]);
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

    // Fly map to destination when selected or radius changes
    const radiusDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        if (radiusDebounceRef.current !== null) {
            clearTimeout(radiusDebounceRef.current);
        }
        if (destination === null) return;
        radiusDebounceRef.current = setTimeout(() => {
            mapNavigationService.flyTo({
                center: [destination.lng, destination.lat],
                zoom: zoomForRadiusKm(radiusKm),
            });
        }, 150);
        return () => {
            if (radiusDebounceRef.current !== null) {
                clearTimeout(radiusDebounceRef.current);
            }
        };
    }, [destination, radiusKm]);

    const { count, isLoading: isCountLoading } = useEstimatedCount({
        destination,
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

    const updateEntry = useCallback((index: number, patch: Partial<TravelEntry>) => {
        setTravelEntries((prev) =>
            prev.map((entry, i) => (i === index ? { ...entry, ...patch } : entry))
        );
    }, []);

    const addEntry = useCallback(() => {
        setTravelEntries((prev) => {
            if (prev.length >= MAX_TRAVEL_ENTRIES) return prev;
            const label = prev.length === 0 ? "Travail" : `Lieu ${prev.length + 1}`;
            return [...prev, { label, destination: null, mode: "car", maxMinutes: 30 }];
        });
    }, []);

    const removeEntry = useCallback((index: number) => {
        setTravelEntries((prev) => {
            if (prev.length <= 1) return prev;
            return prev.filter((_, i) => i !== index);
        });
    }, []);

    const travelTimeTargets: TravelTimeTarget[] = selectedCriteria.has("travelTime")
        ? travelEntries
              .filter((e): e is TravelEntry & { destination: Destination } => e.destination !== null)
              .map((e) => ({ destination: e.destination, maxMinutes: e.maxMinutes, mode: e.mode }))
        : [];

    const handleSubmit = useCallback(
        (e: React.FormEvent) => {
            e.preventDefault();
            if (destination === null) return;

            const criteria: SearchCriteria = {
                destination,
                radiusKm,
                travelTimeTargets,
                minSecurityLevel: selectedCriteria.has("security") ? minSecurityLevel : null,
                livingPreference: selectedCriteria.has("livingPreference") ? livingPreference : "any",
            };

            getSearchService().startSearch(criteria);
            displayModeService.setMode("search");
        },
        [destination, radiusKm, travelTimeTargets, minSecurityLevel, livingPreference, selectedCriteria]
    );

    const ctaLabel = (() => {
        if (destination === null) return "Rechercher";
        if (isCountLoading) return "Rechercher (~...)";
        if (count !== null) return `Rechercher (~${count} communes)`;
        return "Rechercher";
    })();

    const lastEntry = travelEntries[travelEntries.length - 1];
    const canAddEntry =
        travelEntries.length < MAX_TRAVEL_ENTRIES &&
        lastEntry !== undefined &&
        lastEntry.destination !== null;

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
                                <div className="space-y-3">
                                    <Label>Temps de trajet</Label>
                                    {travelEntries.map((entry, index) => (
                                        <div key={index} className="space-y-2 rounded-lg border p-2">
                                            <div className="flex items-center justify-between">
                                                <input
                                                    type="text"
                                                    value={entry.label}
                                                    onChange={(e) => updateEntry(index, { label: e.target.value })}
                                                    placeholder={index === 0 ? "Travail" : `Lieu ${index + 1}`}
                                                    className="text-sm font-medium bg-transparent border-transparent outline-none focus:outline-none w-full max-w-[160px]"
                                                />
                                                {travelEntries.length > 1 && (
                                                    <button
                                                        type="button"
                                                        className="text-xs text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                                                        onClick={() => removeEntry(index)}
                                                    >
                                                        Supprimer
                                                    </button>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <AddressAutocomplete
                                                        value={entry.destination}
                                                        onSelect={(dest) => updateEntry(index, { destination: dest })}
                                                        placeholder="Lieu de travail, ecole..."
                                                    />
                                                </div>
                                                {entry.destination !== null && (
                                                    <>
                                                        <ToggleGroup
                                                            type="single"
                                                            variant="outline"
                                                            value={entry.mode}
                                                            onValueChange={(value: string) => {
                                                                if (value !== "") {
                                                                    updateEntry(index, { mode: value as TransportMode });
                                                                }
                                                            }}
                                                            className="flex-shrink-0 gap-1"
                                                            size="sm"
                                                        >
                                                            <ToggleGroupItem value="car" aria-label="Voiture">
                                                                Voiture
                                                            </ToggleGroupItem>
                                                            <ToggleGroupItem value="transit" aria-label="Transports en commun">
                                                                TC
                                                            </ToggleGroupItem>
                                                        </ToggleGroup>
                                                        <div className="flex items-center gap-2 flex-shrink-0">
                                                            <Slider
                                                                className="w-24"
                                                                min={15}
                                                                max={90}
                                                                step={5}
                                                                value={[entry.maxMinutes]}
                                                                onValueChange={(values: number[]) => {
                                                                    const next = values[0];
                                                                    if (next !== undefined) {
                                                                        updateEntry(index, { maxMinutes: next });
                                                                    }
                                                                }}
                                                            />
                                                            <span className="text-xs font-medium text-brand whitespace-nowrap w-10 text-right">
                                                                {entry.maxMinutes}min
                                                            </span>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {canAddEntry && (
                                        <button
                                            type="button"
                                            className="text-sm text-brand hover:text-brand/80 transition-colors font-medium"
                                            onClick={addEntry}
                                        >
                                            + Ajouter un lieu
                                        </button>
                                    )}
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
