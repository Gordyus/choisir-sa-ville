import type { DvfRawRow, MutationSummary, TransactionLot } from "./types.js";
import { buildAddressKey } from "./addressNormalization.js";

/**
 * Build a stable mutation key from DVF row.
 * Uses `id_mutation` if available, otherwise falls back to a composite key.
 */
export function buildMutationKey(row: DvfRawRow): string {
    if (row.idMutation) {
        return row.idMutation;
    }

    // Fallback composite key for pre-2018 data (no id_mutation)
    const addressKey = buildAddressKey(row.inseeCode, row.streetNumber, row.streetName);
    return `${row.date}|${row.priceEur}|${row.inseeCode}|${addressKey}`;
}

/**
 * Aggregate deduplicated rows by mutation.
 * Groups rows that share the same mutation key (same notarial act).
 * Returns mutation summaries with primitive data only (no UI labels).
 */
export function aggregateByMutation(rows: DvfRawRow[]): MutationSummary[] {
    const mutationMap = new Map<string, DvfRawRow[]>();

    // Group by mutation key
    for (const row of rows) {
        const key = buildMutationKey(row);
        const existing = mutationMap.get(key);
        if (existing) {
            existing.push(row);
        } else {
            mutationMap.set(key, [row]);
        }
    }

    // Build mutation summaries
    const mutations: MutationSummary[] = [];

    for (const [mutationKey, mutationRows] of mutationMap) {
        // All rows in a mutation share the same date and price
        const firstRow = mutationRows[0];
        if (!firstRow) continue;

        const date = firstRow.date;
        const priceEurTotal = firstRow.priceEur;

        let housingCount = 0;
        let housingSurfaceM2Total = 0;
        let dependencyCount = 0;
        let parcelCount = 0;
        const lots: TransactionLot[] = [];

        // Collect all cadastral parcel codes from all rows in this mutation
        const cadastralParcelSet = new Set<string>();
        for (const row of mutationRows) {
            if (row.parcelCodes) {
                for (const code of row.parcelCodes) {
                    cadastralParcelSet.add(code);
                }
            }
        }
        const cadastralParcelCount = cadastralParcelSet.size;

        for (const row of mutationRows) {
            const lot: TransactionLot = {
                typeLocal: row.typeLocal,
                surfaceM2: row.surfaceM2,
                isVefa: row.isVefa,
                roomCount: row.roomCount,
                landSurfaceM2: row.landSurfaceM2
            };
            lots.push(lot);

            if (row.typeLocal === "Maison" || row.typeLocal === "Appartement") {
                housingCount++;
                if (row.surfaceM2 !== null) {
                    housingSurfaceM2Total += row.surfaceM2;
                }
            } else if (row.typeLocal === "Dépendance") {
                dependencyCount++;
            } else if (row.typeLocal === "Sol") {
                parcelCount++;
            }
        }

        mutations.push({
            mutationId: mutationKey,
            date,
            priceEurTotal,
            housingCount,
            housingSurfaceM2Total: housingSurfaceM2Total > 0 ? housingSurfaceM2Total : null,
            dependencyCount,
            parcelCount,
            cadastralParcelCount,
            lots
        });
    }

    // Sort by date descending
    mutations.sort((a, b) => b.date.localeCompare(a.date));

    return mutations;
}
