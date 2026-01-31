import path from "node:path";

import { writeJsonAtomic } from "../shared/fileSystem.js";
import type { ExportCommune, ExportContext, RowForColumns } from "../shared/types.js";

const CORE_COLUMNS = ["insee", "areaKm2", "densityPopKm2"] as const;
type CoreRow = RowForColumns<typeof CORE_COLUMNS>;

type ExportMetricsCoreParams = {
    context: ExportContext;
    communes: ExportCommune[];
};

export async function exportMetricsCore({ context, communes }: ExportMetricsCoreParams): Promise<string> {
    const rows: CoreRow[] = communes
        .slice()
        .sort((a, b) => a.insee.localeCompare(b.insee))
        .map((commune) => [commune.insee, null, null]);

    const targetPath = path.join(context.datasetDir, "communes", "metrics", "core.json");
    await writeJsonAtomic(targetPath, {
        columns: CORE_COLUMNS,
        rows
    });

    console.info(`[metrics:core] Exported ${rows.length} rows (values are null placeholders)`);
    return "communes/metrics/core.json";
}
