/**
 * Palette de couleurs centralisée pour les niveaux d'insécurité
 * Source unique de vérité (SSOT) pour chromatic scale d'insecurité
 *
 * Utilisée par:
 * - MapLibre expressions (fill-color, line-color)
 * - Components UI (badges, legends)
 * - Feature detection (choroplèthe)
 */

import type { InsecurityLevel } from "@/lib/data/insecurityMetrics";

// Re-export the type so consumers can import from this file or from insecurityMetrics
export type { InsecurityLevel };

/**
 * INSECURITY_PALETTE (legacy 4-level system)
 *
 * Définit les couleurs hex pour chaque niveau d'insécurité.
 * Couleurs choisies pour:
 * - Contraste WCAG AA (sur fond blanc et couleurs de borders)
 * - Progression claire (faible → très-élevé)
 * - Différenciation visuelle nette
 *
 * Format hex (24-bit RGB): #RRGGBB
 */
export const INSECURITY_PALETTE: Record<InsecurityLevel, string> = {
    faible: "#22c55e",      // green-500: insécurité basse
    modere: "#eab308",      // yellow-500: insécurité modérée
    eleve: "#f97316",       // orange-500: insécurité élevée
    "tres-eleve": "#ef4444", // red-500: très haute insécurité
};

/**
 * INSECURITY_COLORS (new 5-level system using numeric codes 0-4)
 *
 * Array-based color palette indexed by level code from exported data:
 * - 0: Très faible (very low) - green
 * - 1: Faible (low) - lime
 * - 2: Modéré (moderate) - yellow
 * - 3: Élevé (high) - orange
 * - 4: Plus élevé (very high) - red
 *
 * Used for viewport-only feature-state rendering on the map.
 */
export const INSECURITY_COLORS = [
    "#22c55e",  // 0: Très faible (green-500)
    "#84cc16",  // 1: Faible (lime-500)
    "#eab308",  // 2: Modéré (yellow-500)
    "#f97316",  // 3: Élevé (orange-500)
    "#ef4444",  // 4: Plus élevé (red-500)
] as const;

/**
 * Type guard pour validation de niveau d'insécurité
 * Utile pour validations à runtime ou parsing de données externes
 */
export function isInsecurityLevel(value: unknown): value is InsecurityLevel {
    return typeof value === "string" && value in INSECURITY_PALETTE;
}
