const MANIFEST_PATH = "/data/current/manifest.json";
const INDEX_RELATIVE_PATH = "communes/indexLite.json";

export type CommuneIndexLiteEntry = {
    inseeCode: string;
    name: string;
    departmentCode: string;
    regionCode: string;
    lat: number;
    lon: number;
    population: number | null;
};

interface CommunesManifest {
    datasetVersion: string;
    files: string[];
}

interface RawIndexLite {
    columns: string[];
    rows: Array<Array<string | number | null>>;
}

let datasetVersionCache: string | null = null;
let communesIndexCache: Map<string, CommuneIndexLiteEntry> | null = null;
let communesIndexPromise: Promise<Map<string, CommuneIndexLiteEntry>> | null = null;

export async function loadCommunesIndexLite(signal?: AbortSignal): Promise<Map<string, CommuneIndexLiteEntry>> {
    if (communesIndexCache) {
        return communesIndexCache;
    }
    if (!communesIndexPromise) {
        communesIndexPromise = fetchCommunesIndexLite(signal)
            .then((map) => {
                communesIndexCache = map;
                return map;
            })
            .catch((error) => {
                communesIndexPromise = null;
                throw error;
            });
    }
    return communesIndexPromise;
}

export async function getCommuneByInsee(code: string, signal?: AbortSignal): Promise<CommuneIndexLiteEntry | null> {
    const index = await loadCommunesIndexLite(signal);
    return index.get(code) ?? null;
}

async function fetchCommunesIndexLite(signal?: AbortSignal): Promise<Map<string, CommuneIndexLiteEntry>> {
    const version = await resolveDatasetVersion(signal);
    const url = `/data/${version}/${INDEX_RELATIVE_PATH}`;
    const raw = await fetchJson<RawIndexLite>(url, signal);
    return buildIndex(raw);
}

async function resolveDatasetVersion(signal?: AbortSignal): Promise<string> {
    if (datasetVersionCache) {
        return datasetVersionCache;
    }
    const manifest = await fetchJson<CommunesManifest>(MANIFEST_PATH, signal);
    datasetVersionCache = manifest.datasetVersion;
    return datasetVersionCache;
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
    const init: RequestInit = {};
    if (typeof signal !== "undefined") {
        init.signal = signal;
    }
    const response = await fetch(url, init);
    if (!response.ok) {
        throw new Error(`Failed to load ${url}: ${response.status} ${response.statusText}`);
    }
    return (await response.json()) as T;
}

function buildIndex(raw: RawIndexLite): Map<string, CommuneIndexLiteEntry> {
    const columnIndex = new Map<string, number>();
    raw.columns.forEach((column, idx) => {
        columnIndex.set(column, idx);
    });

    const requiredColumns = ["insee", "name", "departmentCode", "regionCode", "lat", "lng", "population"];
    for (const column of requiredColumns) {
        if (!columnIndex.has(column)) {
            throw new Error(`Missing column "${column}" in communes index`);
        }
    }

    const index = new Map<string, CommuneIndexLiteEntry>();
    for (const row of raw.rows) {
        const inseeCode = getString(row, columnIndex.get("insee")!);
        if (!inseeCode) {
            continue;
        }
        index.set(inseeCode, {
            inseeCode,
            name: getString(row, columnIndex.get("name")!) ?? inseeCode,
            departmentCode: getString(row, columnIndex.get("departmentCode")!) ?? "",
            regionCode: getString(row, columnIndex.get("regionCode")!) ?? "",
            lat: getNumber(row, columnIndex.get("lat")!) ?? 0,
            lon: getNumber(row, columnIndex.get("lng")!) ?? 0,
            population: getNumber(row, columnIndex.get("population")!) ?? null
        });
    }

    return index;
}

function getString(row: Array<string | number | null>, index: number): string | null {
    const value = row[index];
    if (typeof value === "string" && value.length > 0) {
        return value;
    }
    if (typeof value === "number") {
        return String(value);
    }
    return null;
}

function getNumber(row: Array<string | number | null>, index: number): number | null {
    const value = row[index];
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}
