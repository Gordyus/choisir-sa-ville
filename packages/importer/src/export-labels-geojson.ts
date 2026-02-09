#!/usr/bin/env tsx

import path from "node:path";
import { fileURLToPath } from "node:url";

import { exportLabelsGeoJson } from "./exports/communes/exportLabelsGeoJson.js";
import type { ExportContext } from "./exports/shared/types.js";

/**
 * Export commune labels as GeoJSON for Tippecanoe vector tile generation.
 * 
 * Usage:
 *   pnpm --filter @choisir-sa-ville/importer export:labels-geojson
 * 
 * Output:
 *   tile-server/tmp/commune-labels.geojson
 */

async function main(): Promise<void> {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const packageRoot = path.resolve(__dirname, "..");
    const repoRoot = path.resolve(packageRoot, "..", "..");
    
    // Use latest dataset version
    const dataDir = path.join(repoRoot, "apps", "web", "public", "data");
    const currentManifestPath = path.join(dataDir, "current", "manifest.json");
    
    let datasetVersion: string;
    try {
        const fs = await import("node:fs/promises");
        const manifestContent = await fs.readFile(currentManifestPath, "utf-8");
        const manifest = JSON.parse(manifestContent) as { datasetVersion?: string };
        datasetVersion = manifest.datasetVersion ?? "v2026-02-08";
    } catch (error) {
        console.error("[export-labels-geojson] Failed to read current manifest, using default version");
        // Fallback to latest directory
        const fs = await import("node:fs/promises");
        const entries = await fs.readdir(dataDir, { withFileTypes: true });
        const versions = entries
            .filter((e) => e.isDirectory() && e.name.startsWith("v"))
            .map((e) => e.name)
            .sort()
            .reverse();
        datasetVersion = versions[0] ?? "v2026-02-08";
    }

    const datasetDir = path.join(dataDir, datasetVersion);
    const context: ExportContext = {
        datasetDir,
        datasetVersion,
        rootDir: repoRoot
    };

    console.info(`[export-labels-geojson] Using dataset: ${datasetVersion}`);
    console.info(`[export-labels-geojson] Dataset directory: ${datasetDir}`);

    const outputPath = await exportLabelsGeoJson(context);

    console.info(`[export-labels-geojson] ✅ GeoJSON exported to: ${outputPath}`);
    console.info("");
    console.info("Next steps:");
    console.info("  1. Run Tippecanoe to generate MBTiles:");
    console.info("     cd tile-server/tmp");
    console.info("     tippecanoe -o ../data/commune-labels.mbtiles \\");
    console.info("       -Z6 -z14 --force \\");
    console.info("       --drop-densest-as-needed \\");
    console.info("       --coalesce-densest-as-needed \\");
    console.info("       --no-tile-compression \\");
    console.info("       --layer=commune_labels \\");
    console.info("       --promote-id=insee \\");
    console.info("       commune-labels.geojson");
    console.info("");
    console.info("  2. Add to tile-server/data/config.json:");
    console.info('     "commune_labels": { "mbtiles": "commune-labels.mbtiles" }');
    console.info("");
    console.info("  3. Restart tileserver Docker container");
}

main().catch((error) => {
    console.error("[export-labels-geojson] Failed:", error);
    process.exitCode = 1;
});
