import path from "node:path";
import fs from "node:fs/promises";

import type { ExportContext } from "../shared/types.js";

/**
 * Export commune labels as GeoJSON Point features for vector tile generation.
 * 
 * This GeoJSON will be used by Tippecanoe to generate commune-labels.mbtiles.
 * Only communes with valid coordinates are included.
 * 
 * Properties are minimal (no business logic):
 * - insee: Code INSEE (used as feature ID via promoteId)
 * - name: Nom de la commune
 * - population: Population (for symbol-sort-key in MapLibre)
 */

type IndexLiteData = {
    columns: readonly string[];
    rows: Array<Array<string | number | null>>;
};

type GeoJsonFeature = {
    type: "Feature";
    id: string; // Feature ID for vector tiles
    geometry: {
        type: "Point";
        coordinates: [number, number]; // [lng, lat]
    };
    properties: {
        insee: string;
        name: string;
        population: number | null;
    };
};

type GeoJsonFeatureCollection = {
    type: "FeatureCollection";
    features: GeoJsonFeature[];
};

export async function exportLabelsGeoJson(context: ExportContext): Promise<string> {
    // Resolve root directory
    const rootDir = context.rootDir ?? path.join(context.datasetDir, "..", "..", "..", "..");
    
    // Read indexLite.json (source of truth for commune coordinates)
    const indexLitePath = path.join(context.datasetDir, "communes", "indexLite.json");
    const indexLiteContent = await fs.readFile(indexLitePath, "utf-8");
    const indexLite = JSON.parse(indexLiteContent) as IndexLiteData;

    const columns = indexLite.columns;
    const inseeIdx = columns.indexOf("insee");
    const nameIdx = columns.indexOf("name");
    const latIdx = columns.indexOf("lat");
    const lngIdx = columns.indexOf("lng");
    const populationIdx = columns.indexOf("population");

    if (inseeIdx === -1 || nameIdx === -1 || latIdx === -1 || lngIdx === -1 || populationIdx === -1) {
        throw new Error("[exportLabelsGeoJson] Missing required columns in indexLite.json");
    }

    const features: GeoJsonFeature[] = [];
    let skippedCount = 0;

    for (const row of indexLite.rows) {
        const insee = row[inseeIdx];
        const name = row[nameIdx];
        const lat = row[latIdx];
        const lng = row[lngIdx];
        const population = row[populationIdx];

        // Skip communes without valid coordinates
        if (typeof lat !== "number" || typeof lng !== "number") {
            skippedCount++;
            continue;
        }

        // Validate required fields
        if (typeof insee !== "string" || typeof name !== "string") {
            console.warn(`[exportLabelsGeoJson] Invalid data for row, skipping:`, row);
            skippedCount++;
            continue;
        }

        features.push({
            type: "Feature",
            id: insee, // Feature ID for promoteId in MapLibre
            geometry: {
                type: "Point",
                coordinates: [lng, lat] // GeoJSON standard: [longitude, latitude]
            },
            properties: {
                insee,
                name,
                population: typeof population === "number" ? population : null
            }
        });
    }

    const featureCollection: GeoJsonFeatureCollection = {
        type: "FeatureCollection",
        features
    };

    // Write to tile-server/tmp/ directory (will be used by Tippecanoe)
    const outputDir = path.join(rootDir, "tile-server", "tmp");
    await fs.mkdir(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, "commune-labels.geojson");

    await fs.writeFile(outputPath, JSON.stringify(featureCollection, null, 2), "utf-8");

    console.info(
        `[exportLabelsGeoJson] Exported ${features.length} commune labels to GeoJSON (${skippedCount} skipped due to missing coordinates)`
    );

    return outputPath;
}
