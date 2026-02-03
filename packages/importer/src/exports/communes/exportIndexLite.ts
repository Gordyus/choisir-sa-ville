import path from "node:path";

import { writeJsonAtomic } from "../shared/fileSystem.js";
import type { ExportCommune, ExportContext, PostalRecord, RowForColumns } from "../shared/types.js";

const INDEX_LITE_COLUMNS = [
    "insee",
    "name",
    "departmentCode",
    "regionCode",
    "lat",
    "lng",
    "population"
] as const;

type IndexLiteRow = RowForColumns<typeof INDEX_LITE_COLUMNS>;

type ExportIndexLiteParams = {
    context: ExportContext;
    communes: ExportCommune[];
    postalRecords: PostalRecord[];
    parentChildrenMap: Map<string, string[]>;
    populationByInsee: Map<string, number>;
};

export async function exportIndexLite({
    context,
    communes,
    postalRecords,
    parentChildrenMap,
    populationByInsee
}: ExportIndexLiteParams): Promise<string> {
    const coords = aggregateCoordinates(postalRecords);
    const rows: IndexLiteRow[] = communes
        .slice()
        .sort((a, b) => a.insee.localeCompare(b.insee))
        .map((commune) => {
            const direct = coords.get(commune.insee) ?? null;
            const derived = direct ? null : deriveFromChildren(commune.insee, coords, parentChildrenMap);
            const stats = direct ?? derived;
            const lat = stats ? round(stats.latSum / stats.count) : null;
            const lng = stats ? round(stats.lngSum / stats.count) : null;
            const directPopulation = populationByInsee.get(commune.insee) ?? null;
            const derivedPopulation = directPopulation
                ? null
                : derivePopulationFromChildren(commune.insee, populationByInsee, parentChildrenMap);
            const population = directPopulation ?? derivedPopulation;

            return [
                commune.insee,
                commune.name,
                commune.departmentCode ?? null,
                commune.regionCode ?? null,
                lat,
                lng,
                population
            ];
        });

    const missingRows = rows.filter((row) => row[4] === null || row[5] === null);
    const missingCoordinates = missingRows.length;
    const targetPath = path.join(context.datasetDir, "communes", "indexLite.json");

    await writeJsonAtomic(targetPath, {
        columns: INDEX_LITE_COLUMNS,
        rows
    });

    if (missingCoordinates > 0) {
        const limit = 50;
        for (const row of missingRows.slice(0, limit)) {
            const insee = row[0] as string;
            const name = row[1] as string;
            const children = parentChildrenMap.get(insee);
            const childInfo = children?.length ? `children=${children.length}` : "children=0";
            console.warn(`[indexLite] Missing coordinates: ${insee} (${name}) ${childInfo}`);
        }
        if (missingCoordinates > limit) {
            console.warn(
                `[indexLite] Missing coordinates: ${missingCoordinates} total (showing first ${limit})`
            );
        }
    }

    console.info(
        `[indexLite] Exported ${rows.length} communes (${rows.length - missingCoordinates} with coordinates, ${missingCoordinates} without coordinates)`
    );

    return "communes/indexLite.json";
}

export function buildCommuneCoordsByInsee(indexLiteRows: IndexLiteRow[]): Map<string, { lat: number; lng: number } | null> {
    const map = new Map<string, { lat: number; lng: number } | null>();
    for (const row of indexLiteRows) {
        const insee = row[0] as string;
        const lat = row[4] as number | null;
        const lng = row[5] as number | null;
        map.set(insee, lat != null && lng != null ? { lat, lng } : null);
    }
    return map;
}

type CoordAccumulator = {
    latSum: number;
    lngSum: number;
    count: number;
};

function aggregateCoordinates(records: PostalRecord[]): Map<string, CoordAccumulator> {
    const map = new Map<string, CoordAccumulator>();
    for (const record of records) {
        if (!record.insee) continue;
        if (record.lat == null || record.lng == null) continue;
        const current = map.get(record.insee) ?? { latSum: 0, lngSum: 0, count: 0 };
        current.latSum += record.lat;
        current.lngSum += record.lng;
        current.count += 1;
        map.set(record.insee, current);
    }
    return map;
}

function deriveFromChildren(
    parentInsee: string,
    coords: Map<string, CoordAccumulator>,
    parentChildrenMap: Map<string, string[]>
): CoordAccumulator | null {
    const children = parentChildrenMap.get(parentInsee);
    if (!children || children.length === 0) return null;

    let latSum = 0;
    let lngSum = 0;
    let count = 0;

    for (const child of children) {
        const stats = coords.get(child);
        if (!stats) continue;
        latSum += stats.latSum;
        lngSum += stats.lngSum;
        count += stats.count;
    }

    if (count === 0) return null;
    return { latSum, lngSum, count };
}

function derivePopulationFromChildren(
    parentInsee: string,
    populationByInsee: Map<string, number>,
    parentChildrenMap: Map<string, string[]>
): number | null {
    const children = parentChildrenMap.get(parentInsee);
    if (!children || children.length === 0) return null;

    let sum = 0;
    let hasValue = false;

    for (const child of children) {
        const value = populationByInsee.get(child);
        if (value == null) continue;
        sum += value;
        hasValue = true;
    }

    return hasValue ? sum : null;
}

function round(value: number): number {
    return Number(value.toFixed(6));
}
