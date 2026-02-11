/**
 * Configuration centralisée pour les indicateurs immobiliers multi-échelle.
 * Partagée entre importer (build-time) et web (runtime).
 */

/**
 * Résolution H3 des hexagones pour visualisation immobilière.
 * 
 * Niveaux disponibles :
 * - Niveau 7 : ~5.2 km² par hexagone (~1.5 km largeur) - granularité large
 * - Niveau 8 : ~0.74 km² par hexagone (~461 m largeur) - granularité moyenne (RECOMMANDÉ)
 * - Niveau 9 : ~0.10 km² par hexagone (~174 m largeur) - granularité fine (7x plus d'hexagones)
 * 
 * Choix niveau 8 :
 * - Compromis optimal granularité/performance
 * - Taille adaptée visualisation intra-communale (ni trop large, ni trop fin)
 * - Budget performance raisonnable (nombre hexagones modéré)
 * 
 * Configuration modifiable sans changement de code :
 * - Permet A/B testing différentes résolutions post-launch
 * - Changement résolution nécessite re-run importer (pas hotswap runtime)
 * 
 * @see https://h3geo.org/docs/core-library/restable
 */
export const H3_RESOLUTION_HEXAGONS = 8 as const;

/**
 * Taille approximative hexagone selon résolution (référence).
 */
export const H3_RESOLUTION_METADATA = {
  7: { areaSqKm: 5.161293360, edgeLengthM: 1220.629759 },
  8: { areaSqKm: 0.737327598, edgeLengthM: 461.354684 },
  9: { areaSqKm: 0.105332513, edgeLengthM: 174.375668 }
} as const;
