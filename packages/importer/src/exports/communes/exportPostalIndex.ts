import path from "node:path";

import { writeJsonAtomic } from "../shared/fileSystem.js";
import type { ExportContext, PostalRecord } from "../shared/types.js";

type ExportPostalIndexParams = {
    context: ExportContext;
    postalRecords: PostalRecord[];
};

export async function exportPostalIndex({ context, postalRecords }: ExportPostalIndexParams): Promise<string> {
    const postalMap = new Map<string, Set<string>>();
    let ignored = 0;

    for (const record of postalRecords) {
        if (!record.postalCode || !record.insee) {
            ignored += 1;
            continue;
        }

        const existing = postalMap.get(record.postalCode) ?? new Set<string>();
        existing.add(record.insee);
        postalMap.set(record.postalCode, existing);
    }

    const postalCodeToInsee: Record<string, string[]> = {};
    const sortedEntries = Array.from(postalMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    for (const [postalCode, codes] of sortedEntries) {
        postalCodeToInsee[postalCode] = Array.from(codes).sort((a, b) => a.localeCompare(b));
    }

    const targetPath = path.join(context.datasetDir, "communes", "postalIndex.json");
    await writeJsonAtomic(targetPath, { postalCodeToInsee });

    console.info(
        `[postalIndex] Exported ${sortedEntries.length} postal codes (ignored ${ignored} rows without postal/insee)`
    );

    return "communes/postalIndex.json";
}
