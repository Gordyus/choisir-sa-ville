const MANIFEST_PATH = "/data/current/manifest.json";
const INDEX_RELATIVE_PATH = "infraZones/indexLite.json";

export type InfraZoneIndexLiteEntry = {
    id: string;
    type: string;
    code: string;
    parentCommuneCode: string;
    name: string;
    lat: number;
    lon: number;
    population: number | null;
};

interface InfraZoneManifest {
    datasetVersion: string;
    files: string[];
}

interface RawIndexLite {
    columns: string[];
    rows: Array<Array<string | number | null>>;
}

let datasetVersionCache: string | null = null;
let infraZonesIndexCache: Map<string, InfraZoneIndexLiteEntry> | null = null;
let infraZonesIndexPromise: Promise<Map<string, InfraZoneIndexLiteEntry>> | null = null;

export async function loadInfraZonesIndexLite(signal?: AbortSignal): Promise<Map<string, InfraZoneIndexLiteEntry>> {
    if (infraZonesIndexCache) {
        return infraZonesIndexCache;
    }
    if (!infraZonesIndexPromise) {
        infraZonesIndexPromise = fetchInfraZonesIndexLite(signal)
            .then((map) => {
                infraZonesIndexCache = map;
                return map;
            })
            .catch((error) => {
                infraZonesIndexPromise = null;
                throw error;
            });
    }
    return infraZonesIndexPromise;
}

export async function getInfraZoneById(id: string, signal?: AbortSignal): Promise<InfraZoneIndexLiteEntry | null> {
    const index = await loadInfraZonesIndexLite(signal);
    return index.get(id) ?? null;
}

async function fetchInfraZonesIndexLite(signal?: AbortSignal): Promise<Map<string, InfraZoneIndexLiteEntry>> {
    const version = await resolveDatasetVersion(signal);
    const url = `/data/${version}/${INDEX_RELATIVE_PATH}`;
    const raw = await fetchJson<RawIndexLite>(url, signal);
    return buildIndex(raw);
}

async function resolveDatasetVersion(signal?: AbortSignal): Promise<string> {
    if (datasetVersionCache) {
        return datasetVersionCache;
    }
    const manifest = await fetchJson<InfraZoneManifest>(MANIFEST_PATH, signal);
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

function buildIndex(raw: RawIndexLite): Map<string, InfraZoneIndexLiteEntry> {
    const columnIndex = new Map<string, number>();
    raw.columns.forEach((column, idx) => {
        columnIndex.set(column, idx);
    });

    const requiredColumns = ["id", "type", "code", "parentCommuneCode", "name", "lat", "lng", "population"];
    for (const column of requiredColumns) {
        if (!columnIndex.has(column)) {
            throw new Error(`Missing column "${column}" in infra zones index`);
        }
    }

    const index = new Map<string, InfraZoneIndexLiteEntry>();
    for (const row of raw.rows) {
        const id = getString(row, columnIndex.get("id")!);
        if (!id) {
            continue;
        }
        index.set(id, {
            id,
            type: getString(row, columnIndex.get("type")!) ?? "",
            code: getString(row, columnIndex.get("code")!) ?? "",
            parentCommuneCode: getString(row, columnIndex.get("parentCommuneCode")!) ?? "",
            name: getString(row, columnIndex.get("name")!) ?? id,
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
