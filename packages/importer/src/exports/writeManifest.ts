import path from "node:path";

import { writeJsonAtomic } from "./shared/fileSystem.js";
import type { SourceMeta } from "./shared/types.js";

export type ManifestPayload = {
    datasetDir: string;
    datasetVersion: string;
    files: string[];
    sources: SourceMeta[];
};

export async function writeManifest({ datasetDir, datasetVersion, files, sources }: ManifestPayload): Promise<void> {
    const manifestPath = path.join(datasetDir, "manifest.json");
    const manifest = {
        datasetVersion,
        createdAtUtc: new Date().toISOString(),
        schemaVersion: 1,
        files: files.sort(),
        sources: sources.map((source) => ({
            url: source.url,
            retrievedAtUtc: source.retrievedAtUtc,
            checksumSha256: source.checksumSha256
        }))
    };

    await writeJsonAtomic(manifestPath, manifest);
}
