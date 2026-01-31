const DATA_ROOT = "/data";
const CURRENT_MANIFEST_PATH = `${DATA_ROOT}/current/manifest.json`;

export type DatasetManifest = {
    datasetVersion: string;
    files: string[];
};

export type DatasetContext = {
    manifest: DatasetManifest;
    baseUrl: string;
};

let manifestPromise: Promise<DatasetContext> | null = null;

export async function loadDataset(signal?: AbortSignal): Promise<DatasetContext> {
    if (!manifestPromise) {
        manifestPromise = resolveDataset(signal).catch((error) => {
            manifestPromise = null;
            throw error;
        });
    }
    return manifestPromise;
}

async function resolveDataset(signal?: AbortSignal): Promise<DatasetContext> {
    const response = await fetch(CURRENT_MANIFEST_PATH, { signal: signal ?? null, cache: "force-cache" });
    if (!response.ok) {
        throw new Error(`[dataset] Missing ${CURRENT_MANIFEST_PATH}. Create it to point to the current dataset.`);
    }
    const manifest = (await response.json()) as DatasetManifest;
    const baseUrl = `${DATA_ROOT}/${manifest.datasetVersion}`;
    return { manifest, baseUrl };
}

export function resolveDatasetFileUrl(context: DatasetContext, relativePath: string): string {
    return `${context.baseUrl}/${relativePath}`;
}

