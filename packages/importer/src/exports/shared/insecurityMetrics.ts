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
    { level: 0, label: "Très faible", description: "indexGlobal 0–24" },
    { level: 1, label: "Faible", description: "indexGlobal 25–49" },
    { level: 2, label: "Modéré", description: "indexGlobal 50–74" },
    { level: 3, label: "Élevé", description: "indexGlobal 75–99" },
    { level: 4, label: "Plus élevé", description: "indexGlobal 100" }
] as const;

// Utility
export function getTotalWeight(): number {
    return INSECURITY_CATEGORIES.reduce((sum, cat) => sum + cat.weight, 0);
}

export function getWeightPercentage(weight: number): string {
    return ((weight / getTotalWeight()) * 100).toFixed(0);
}
