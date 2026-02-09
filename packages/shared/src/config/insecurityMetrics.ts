/**
 * Centralized configuration for insecurity metrics.
 * Shared between importer and frontend FAQ.
 */

export const INSECURITY_CATEGORIES = [
    { id: "violences_personnes", label: "Crimes violents", weight: 0.4 },
    { id: "securite_biens", label: "Atteintes aux biens", weight: 0.35 },
    { id: "tranquillite", label: "Troubles à l'ordre public", weight: 0.25 }
] as const;

export const INSECURITY_LEVELS = [
    { level: 0, label: "Très faible", description: "Percentile [0-20)" },
    { level: 1, label: "Faible", description: "Percentile [20-40)" },
    { level: 2, label: "Modéré", description: "Percentile [40-60)" },
    { level: 3, label: "Élevé", description: "Percentile [60-80)" },
    { level: 4, label: "Plus élevé", description: "Percentile [80-100]" }
] as const;

export const POPULATION_CATEGORIES = {
    small: { 
        min: 0, 
        max: 9999, 
        label: "Petites communes",
        description: "Villages et petites communes rurales"
    },
    medium: { 
        min: 10000, 
        max: 99999, 
        label: "Communes moyennes",
        description: "Villes moyennes"
    },
    large: { 
        min: 100000, 
        max: Infinity, 
        label: "Grandes villes",
        description: "Grandes villes et métropoles"
    }
} as const;

export type PopulationCategory = "small" | "medium" | "large";

export function getPopulationCategory(population: number | null): PopulationCategory | null {
    if (population === null || !Number.isFinite(population) || population <= 0) {
        return null;
    }
    if (population < 10000) return "small";
    if (population < 100000) return "medium";
    return "large";
}

// Utility
export function getTotalWeight(): number {
    return INSECURITY_CATEGORIES.reduce((sum, cat) => sum + cat.weight, 0);
}

export function getWeightPercentage(weight: number): string {
    return ((weight / getTotalWeight()) * 100).toFixed(0);
}
