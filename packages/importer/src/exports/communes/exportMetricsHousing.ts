import path from "node:path";

import { writeJsonAtomic } from "../shared/fileSystem.js";
import type { ExportCommune, ExportContext, RowForColumns } from "../shared/types.js";

const HOUSING_COLUMNS = [
    "insee",
    "rentMedianEurM2",
    "rentP25EurM2",
    "rentP75EurM2",
    "rentSourceYear"
] as const;

type HousingRow = RowForColumns<typeof HOUSING_COLUMNS>;

type ExportMetricsHousingParams = {
    context: ExportContext;
    communes: ExportCommune[];
};

export async function exportMetricsHousing({ context, communes }: ExportMetricsHousingParams): Promise<string> {
    const rows: HousingRow[] = communes
        .slice()
        .sort((a, b) => a.insee.localeCompare(b.insee))
        .map((commune) => [commune.insee, null, null, null, null]);

    const targetPath = path.join(context.datasetDir, "communes", "metrics", "housing.json");
    await writeJsonAtomic(targetPath, {
        columns: HOUSING_COLUMNS,
        rows
    });

    console.info(`[metrics:housing] Exported ${rows.length} rows (values are null placeholders)`);
    return "communes/metrics/housing.json";
}
