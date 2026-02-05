/**
 * Palette de couleurs centralisée pour les niveaux d'insécurité
 * Source unique de vérité (SSOT) pour chromatic scale d'insecurité
 *
 * Utilisée par:
 * - MapLibre expressions (fill-color, line-color)
 * - Components UI (badges, legends)
 * - Feature detection (choroplèthe)
 */

export type InsecurityLevel = "faible" | "modere" | "eleve" | "tres-eleve";

/**
 * INSECURITY_PALETTE
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
 * Type guard pour validation de niveau d'insécurité
 * Utile pour validations à runtime ou parsing de données externes
 */
export function isInsecurityLevel(value: unknown): value is InsecurityLevel {
  return typeof value === "string" && value in INSECURITY_PALETTE;
}
