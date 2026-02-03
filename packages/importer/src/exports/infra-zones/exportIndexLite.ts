import path from "node:path";

import { writeJsonAtomic } from "../shared/fileSystem.js";
import type {
    ExportContext,
    ExportInfraZone,
    PostalRecord,
    RowForColumns
} from "../shared/types.js";

const INDEX_LITE_COLUMNS = [
    "id",
    "type",
    "code",
    "parentCommuneCode",
    "name",
    "lat",
    "lng",
    "population"
] as const;

type IndexLiteRow = RowForColumns<typeof INDEX_LITE_COLUMNS>;

type ExportIndexLiteParams = {
    context: ExportContext;
    infraZones: ExportInfraZone[];
    postalRecords: PostalRecord[];
    populationByInsee: Map<string, number>;
    communeCoordsByInsee: Map<string, { lat: number; lng: number } | null>;
};

export async function exportInfraZonesIndexLite({
    context,
    infraZones,
    postalRecords,
    populationByInsee,
    communeCoordsByInsee
}: ExportIndexLiteParams): Promise<string> {
    const coords = aggregateCoordinates(postalRecords);
    const rows: IndexLiteRow[] = infraZones
        .slice()
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((zone) => {
            const direct = coords.get(zone.code) ?? null;
            const parent = direct ? null : communeCoordsByInsee.get(zone.parentCommuneCode) ?? null;

            const lat = direct ? round(direct.latSum / direct.count) : parent?.lat ?? null;
            const lng = direct ? round(direct.lngSum / direct.count) : parent?.lng ?? null;

            const population = populationByInsee.get(zone.code) ?? null;

            return [zone.id, zone.type, zone.code, zone.parentCommuneCode, zone.name, lat, lng, population];
        });

    const missingRows = rows.filter((row) => row[5] === null || row[6] === null);
    const missingCoordinates = missingRows.length;
    const targetPath = path.join(context.datasetDir, "infraZones", "indexLite.json");

    await writeJsonAtomic(targetPath, {
        columns: INDEX_LITE_COLUMNS,
        rows
    });

    if (missingCoordinates > 0) {
        const limit = 50;
        for (const row of missingRows.slice(0, limit)) {
            const id = row[0] as string;
            const name = row[4] as string;
            console.warn(`[infraZones:indexLite] Missing coordinates: ${id} (${name})`);
        }
        if (missingCoordinates > limit) {
            console.warn(
                `[infraZones:indexLite] Missing coordinates: ${missingCoordinates} total (showing first ${limit})`
            );
        }
    }

    console.info(
        `[infraZones:indexLite] Exported ${rows.length} infra zones (${rows.length - missingCoordinates} with coordinates, ${missingCoordinates} without coordinates)`
    );

    return "infraZones/indexLite.json";
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

function round(value: number): number {
    return Number(value.toFixed(6));
}

