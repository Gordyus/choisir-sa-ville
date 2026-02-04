import { debugLogEntityFetch } from "./entityFetchDebug";
import { normalizeName } from "./nameNormalization";

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
let infraZonesNameIndexCache: Map<string, string[]> | null = null;
let infraZonesNameIndexPromise: Promise<Map<string, string[]>> | null = null;

// ARM index caches: bi-directional mapping between infraZone.id and inseeCode (code field)
type ArmIndexes = {
    idToInseeCode: Map<string, string>;
    inseeCodeToId: Map<string, string>;
};
let armIndexesCache: ArmIndexes | null = null;
let armIndexesPromise: Promise<ArmIndexes> | null = null;

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

export async function findInfraZonesByNormalizedName(
    normalizedName: string,
    signal?: AbortSignal
): Promise<InfraZoneIndexLiteEntry[]> {
    if (!normalizedName) {
        return [];
    }
    const [index, nameIndex] = await Promise.all([
        loadInfraZonesIndexLite(signal),
        ensureNameIndex(signal)
    ]);
    const ids = nameIndex.get(normalizedName) ?? [];
    if (!ids.length) {
        return [];
    }
    const entries: InfraZoneIndexLiteEntry[] = [];
    for (const id of ids) {
        const entry = index.get(id);
        if (entry) {
            entries.push(entry);
        }
    }
    return entries;
}

// ============================================================================
// ARM Index (Arrondissements Municipaux) - Bi-directional id <-> inseeCode
// ============================================================================

/**
 * Given an infraZone.id (ARM), returns the corresponding inseeCode (the "code" field).
 * Returns null if the id is not found or is not an ARM.
 */
export async function getArmInseeCodeById(infraZoneId: string, signal?: AbortSignal): Promise<string | null> {
    const indexes = await ensureArmIndexes(signal);
    return indexes.idToInseeCode.get(infraZoneId) ?? null;
}

/**
 * Given an inseeCode (promoted on arr_municipal tiles), returns the infraZone.id.
 * Returns null if no ARM matches the given inseeCode.
 */
export async function getArmIdByInseeCode(inseeCode: string, signal?: AbortSignal): Promise<string | null> {
    const indexes = await ensureArmIndexes(signal);
    return indexes.inseeCodeToId.get(inseeCode) ?? null;
}

async function ensureArmIndexes(signal?: AbortSignal): Promise<ArmIndexes> {
    if (armIndexesCache) {
        return armIndexesCache;
    }
    if (!armIndexesPromise) {
        armIndexesPromise = loadInfraZonesIndexLite(signal)
            .then((index) => {
                const indexes = buildArmIndexes(index);
                armIndexesCache = indexes;
                return indexes;
            })
            .catch((error) => {
                armIndexesPromise = null;
                throw error;
            });
    }
    return armIndexesPromise;
}

function buildArmIndexes(index: Map<string, InfraZoneIndexLiteEntry>): ArmIndexes {
    const idToInseeCode = new Map<string, string>();
    const inseeCodeToId = new Map<string, string>();

    for (const entry of index.values()) {
        if (entry.type !== "ARM") {
            continue;
        }
        const inseeCode = entry.code;
        if (!inseeCode) {
            continue;
        }
        idToInseeCode.set(entry.id, inseeCode);
        inseeCodeToId.set(inseeCode, entry.id);
    }

    return { idToInseeCode, inseeCodeToId };
}

async function fetchInfraZonesIndexLite(signal?: AbortSignal): Promise<Map<string, InfraZoneIndexLiteEntry>> {
    const version = await resolveDatasetVersion(signal);
    const url = `/data/${version}/${INDEX_RELATIVE_PATH}`;
    const raw = await fetchJson<RawIndexLite>(url, signal);
    return buildIndex(raw);
}

async function ensureNameIndex(signal?: AbortSignal): Promise<Map<string, string[]>> {
    if (infraZonesNameIndexCache) {
        return infraZonesNameIndexCache;
    }
    if (!infraZonesNameIndexPromise) {
        infraZonesNameIndexPromise = loadInfraZonesIndexLite(signal)
            .then((index) => {
                const nameIndex = buildNameIndex(index);
                infraZonesNameIndexCache = nameIndex;
                return nameIndex;
            })
            .catch((error) => {
                infraZonesNameIndexPromise = null;
                throw error;
            });
    }
    return infraZonesNameIndexPromise;
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
    debugLogEntityFetch(url, { domain: "infraZonesIndexLite" });
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

function buildNameIndex(index: Map<string, InfraZoneIndexLiteEntry>): Map<string, string[]> {
    const nameIndex = new Map<string, string[]>();
    for (const entry of index.values()) {
        const primary = normalizeName(entry.name);
        if (primary) {
            addNameIndexKey(nameIndex, primary, entry.id);
        }

        if (entry.type === "ARM") {
            const alias = normalizeName(stripMajorCityPrefix(entry.name));
            if (alias && alias !== primary) {
                addNameIndexKey(nameIndex, alias, entry.id);
            }
        }
    }
    return nameIndex;
}

function addNameIndexKey(index: Map<string, string[]>, key: string, id: string): void {
    const bucket = index.get(key);
    if (bucket) {
        bucket.push(id);
    } else {
        index.set(key, [id]);
    }
}

function stripMajorCityPrefix(name: string): string {
    const trimmed = typeof name === "string" ? name.trim() : "";
    if (!trimmed) {
        return trimmed;
    }
    return trimmed.replace(/^(paris|lyon|marseille)\s+/i, "");
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
