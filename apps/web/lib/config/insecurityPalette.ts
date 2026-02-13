/**
 * Palette de couleurs centralisée pour les niveaux d'insécurité
 * Source unique de vérité (SSOT) pour chromatic scale d'insecurité
 *
 * Utilisée par:
 * - MapLibre expressions (fill-color, line-color)
 * - Components UI (badges, legends)
 * - Feature detection (choroplèthe)
 */

/**
 * INSECURITY_COLORS (5-level system using numeric codes 0-4)
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
