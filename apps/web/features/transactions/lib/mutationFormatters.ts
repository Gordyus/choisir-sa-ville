/**
 * Mutation Formatters
 *
 * Runtime helpers for formatting mutation data in the UI.
 * Separates data primitives (exported by importer) from presentation logic.
 */

import type { MutationSummary } from "@/lib/selection/types";

/**
 * Build a short composition summary for a mutation (title line).
 * For single-lot: includes room count + surface (e.g. "1 appartement 2p (45 m²)")
 * For multi-lot: only counts (e.g. "10 appartements, 1 dépendance") — detail in dropdown
 */
export function buildMutationCompositionLabel(mutation: MutationSummary): string {
    const totalLots = mutation.housingCount + mutation.dependencyCount + mutation.parcelCount;
    const isSingleLot = totalLots === 1;

    const parts: string[] = [];

    if (mutation.housingCount > 0) {
        const lots = mutation.lots?.filter(
            (lot) => lot.typeLocal === "Maison" || lot.typeLocal === "Appartement"
        ) ?? [];

        const maisonCount = lots.filter((lot) => lot.typeLocal === "Maison").length;
        const appartCount = lots.filter((lot) => lot.typeLocal === "Appartement").length;

        if (isSingleLot && lots.length === 1) {
            // Single lot: show full detail inline
            const lot = lots[0]!;
            const type = lot.typeLocal === "Maison" ? "maison" : "appartement";
            let label = `1 ${type}`;
            if (lot.roomCount !== null) label += ` ${lot.roomCount}p`;
            if (lot.surfaceM2 !== null) label += ` (${Math.round(lot.surfaceM2)} m²)`;
            if (lot.typeLocal === "Maison" && lot.landSurfaceM2 !== null && lot.landSurfaceM2 > 0) {
                parts.push(label);
                parts.push(`terrain ${Math.round(lot.landSurfaceM2)} m²`);
                return parts.join(", ");
            }
            parts.push(label);
        } else {
            // Multi-lot: counts only
            const housingParts: string[] = [];
            if (maisonCount > 0) {
                housingParts.push(`${maisonCount} maison${maisonCount > 1 ? "s" : ""}`);
            }
            if (appartCount > 0) {
                housingParts.push(`${appartCount} appartement${appartCount > 1 ? "s" : ""}`);
            }
            parts.push(housingParts.join(", "));
        }
    }

    if (mutation.dependencyCount > 0) {
        parts.push(
            `${mutation.dependencyCount} dépendance${mutation.dependencyCount > 1 ? "s" : ""}`
        );
    }

    if (mutation.parcelCount > 0) {
        parts.push(
            `${mutation.parcelCount} parcelle${mutation.parcelCount > 1 ? "s" : ""}`
        );
    }

    return parts.join(", ");
}

/**
 * Check if lot details provide more info than the composition label.
 * Returns true when the dropdown "Voir le détail" should be shown.
 */
export function hasLotDetails(mutation: MutationSummary): boolean {
    if (!mutation.lots || mutation.lots.length === 0) return false;

    const totalLots = mutation.housingCount + mutation.dependencyCount + mutation.parcelCount;
    // Single lot: detail already shown inline in the composition label
    if (totalLots <= 1) return false;

    // Multi-lot: check if any lot has room count, surface, or land surface
    return mutation.lots.some(
        (lot) => lot.roomCount !== null || lot.surfaceM2 !== null || (lot.landSurfaceM2 !== null && lot.landSurfaceM2 > 0)
    );
}

/**
 * Compute price per square meter for a mutation.
 * Returns null if:
 * - Mutation contains non-housing lots (dependencies, parcels)
 * - Total housing surface is zero or null
 *
 * This ensures the price/m² is only shown when it's meaningful
 * (100% housing with valid surface data).
 */
export function computePricePerM2(mutation: MutationSummary): number | null {
    // Only compute if mutation is 100% housing (no dependencies, no parcels)
    if (mutation.dependencyCount > 0 || mutation.parcelCount > 0) {
        return null;
    }

    // Need valid total surface
    if (mutation.housingSurfaceM2Total === null || mutation.housingSurfaceM2Total <= 0) {
        return null;
    }

    return Math.round(mutation.priceEurTotal / mutation.housingSurfaceM2Total);
}

/**
 * Check if a mutation is a grouped sale (multiple housing units).
 */
export function isMutationGrouped(mutation: MutationSummary): boolean {
    return mutation.housingCount > 1;
}

/**
 * Check if a mutation is complex (includes dependencies, parcels, or multi-parcel sale).
 */
export function isMutationComplex(mutation: MutationSummary): boolean {
    return mutation.dependencyCount > 0 || mutation.parcelCount > 0 || mutation.cadastralParcelCount > 5;
}
