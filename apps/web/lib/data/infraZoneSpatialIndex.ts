import { loadInfraZonesIndexLite, type InfraZoneIndexLiteEntry } from "./infraZonesIndexLite";
import { normalizeName } from "./nameNormalization";

const CELL_SIZE_DEGREES = 0.2;
const MAX_SEARCH_RING = 6;
const MAX_DISTANCE_KM = 30;
const MAX_CANDIDATES = 64;

export type InfraZoneResolutionReason = "name:exact" | "distance";

export type ResolveInfraZoneByClickParams = {
    lng: number;
    lat: number;
    labelName?: string | null;
    debug?: boolean;
    /**
     * When true, only resolve when an exact name match exists (no distance-only fallback).
     * This is the safe mode for label clicks.
     */
    requireNameMatch?: boolean;
};

export type ResolveInfraZoneByClickResult = {
    id: string;
    distanceKm: number;
    reason: InfraZoneResolutionReason;
    entry: InfraZoneIndexLiteEntry;
};

type SpatialGrid = {
    cellSizeDeg: number;
    cells: Map<string, string[]>;
};

type SpatialContext = {
    zones: Map<string, InfraZoneIndexLiteEntry>;
    grid: SpatialGrid;
    nameIndex: Map<string, string[]>;
};

type Candidate = {
    entry: InfraZoneIndexLiteEntry;
    distanceKm: number;
};

let spatialGridPromise: Promise<SpatialGrid> | null = null;
let nameIndexPromise: Promise<Map<string, string[]>> | null = null;

export async function resolveInfraZoneByClick(
    params: ResolveInfraZoneByClickParams,
    signal?: AbortSignal
): Promise<ResolveInfraZoneByClickResult | null> {
    const { lng, lat } = params;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
        return null;
    }

    const { zones, grid, nameIndex } = await loadSpatialContext(signal);
    const normalizedLabel = normalizeName(params.labelName ?? null);
    const exactCandidates = normalizedLabel.length
        ? buildExactMatchCandidates(normalizedLabel, nameIndex, zones, lng, lat)
        : [];

    if (exactCandidates.length) {
        const bestExact = sortCandidatesByScore(exactCandidates)[0] ?? null;
        if (!bestExact) {
            return null;
        }
        logResolutionDebug(params, normalizedLabel, exactCandidates.length, exactCandidates, "name:exact");
        return {
            id: bestExact.entry.id,
            distanceKm: bestExact.distanceKm,
            reason: "name:exact",
            entry: bestExact.entry
        };
    }

    if (params.requireNameMatch) {
        logResolutionDebug(params, normalizedLabel, 0, [], "name:exact");
        return null;
    }

    const candidates = collectSpatialCandidates(zones, grid, lng, lat);
    if (!candidates.length) {
        logResolutionDebug(params, normalizedLabel, 0, [], "distance");
        return null;
    }

    const sorted = sortCandidatesByScore(candidates);
    const best = sorted[0] ?? null;
    if (!best) {
        logResolutionDebug(params, normalizedLabel, 0, sorted, "distance");
        return null;
    }

    if (!Number.isFinite(best.distanceKm) || best.distanceKm > MAX_DISTANCE_KM) {
        logResolutionDebug(params, normalizedLabel, 0, sorted, "distance");
        return null;
    }

    logResolutionDebug(params, normalizedLabel, 0, sorted, "distance");
    return {
        id: best.entry.id,
        distanceKm: best.distanceKm,
        reason: "distance",
        entry: best.entry
    };
}

export async function resolveNearestInfraZoneByDistance(
    lng: number,
    lat: number,
    signal?: AbortSignal
): Promise<ResolveInfraZoneByClickResult | null> {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
        return null;
    }

    const { zones, grid } = await loadSpatialContext(signal);
    const candidates = collectSpatialCandidates(zones, grid, lng, lat);
    if (!candidates.length) {
        return null;
    }

    const sorted = sortCandidatesByScore(candidates);
    const best = sorted[0] ?? null;
    if (!best) {
        return null;
    }

    if (!Number.isFinite(best.distanceKm) || best.distanceKm > MAX_DISTANCE_KM) {
        return null;
    }

    return {
        id: best.entry.id,
        distanceKm: best.distanceKm,
        reason: "distance",
        entry: best.entry
    };
}

async function loadSpatialContext(signal?: AbortSignal): Promise<SpatialContext> {
    const zones = await loadInfraZonesIndexLite(signal);
    const [grid, nameIndex] = await Promise.all([
        ensureSpatialGrid(zones),
        ensureNameIndex(zones)
    ]);
    return { zones, grid, nameIndex };
}

async function ensureSpatialGrid(zones: Map<string, InfraZoneIndexLiteEntry>): Promise<SpatialGrid> {
    if (!spatialGridPromise) {
        spatialGridPromise = Promise.resolve(buildSpatialGrid(zones));
    }
    return spatialGridPromise;
}

function buildSpatialGrid(zones: Map<string, InfraZoneIndexLiteEntry>): SpatialGrid {
    const cells = new Map<string, string[]>();
    for (const entry of zones.values()) {
        if (!Number.isFinite(entry.lat) || !Number.isFinite(entry.lon)) {
            continue;
        }
        const key = encodeCellKey(entry.lon, entry.lat, CELL_SIZE_DEGREES);
        let bucket = cells.get(key);
        if (!bucket) {
            bucket = [];
            cells.set(key, bucket);
        }
        bucket.push(entry.id);
    }
    return { cellSizeDeg: CELL_SIZE_DEGREES, cells };
}

async function ensureNameIndex(zones: Map<string, InfraZoneIndexLiteEntry>): Promise<Map<string, string[]>> {
    if (!nameIndexPromise) {
        nameIndexPromise = Promise.resolve(buildNameIndex(zones));
    }
    return nameIndexPromise;
}

function buildNameIndex(zones: Map<string, InfraZoneIndexLiteEntry>): Map<string, string[]> {
    const index = new Map<string, string[]>();
    for (const entry of zones.values()) {
        const primary = normalizeName(entry.name);
        if (primary) {
            addNameIndexKey(index, primary, entry.id);
        }

        // ARM labels are often rendered without the parent city prefix in OSM styles
        // (e.g. "15e Arrondissement" instead of "Paris 15e Arrondissement").
        if (entry.type === "ARM") {
            const alias = normalizeName(stripMajorCityPrefix(entry.name));
            if (alias && alias !== primary) {
                addNameIndexKey(index, alias, entry.id);
            }
        }
    }
    return index;
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

function buildExactMatchCandidates(
    normalizedKey: string,
    nameIndex: Map<string, string[]>,
    zones: Map<string, InfraZoneIndexLiteEntry>,
    lng: number,
    lat: number
): Candidate[] {
    const ids = nameIndex.get(normalizedKey);
    if (!ids || !ids.length) {
        return [];
    }
    const candidates: Candidate[] = [];
    for (const id of ids) {
        const entry = zones.get(id);
        if (!entry) {
            continue;
        }
        let distanceKm = Number.POSITIVE_INFINITY;
        if (Number.isFinite(entry.lat) && Number.isFinite(entry.lon)) {
            distanceKm = haversineDistanceKm(lat, lng, entry.lat, entry.lon);
        }
        candidates.push({ entry, distanceKm });
    }
    return candidates;
}

function collectSpatialCandidates(
    zones: Map<string, InfraZoneIndexLiteEntry>,
    grid: SpatialGrid,
    lng: number,
    lat: number
): Candidate[] {
    const originX = Math.floor(lng / grid.cellSizeDeg);
    const originY = Math.floor(lat / grid.cellSizeDeg);
    const visited = new Set<string>();
    const candidates: Candidate[] = [];
    let bestDistance: number | null = null;

    outer: for (let ring = 0; ring <= MAX_SEARCH_RING; ring++) {
        const keys = listRingKeys(originX, originY, ring);
        for (const key of keys) {
            const bucket = grid.cells.get(key);
            if (!bucket || bucket.length === 0) {
                continue;
            }
            for (const id of bucket) {
                if (visited.has(id)) {
                    continue;
                }
                visited.add(id);
                const entry = zones.get(id);
                if (!entry) {
                    continue;
                }
                const distanceKm = haversineDistanceKm(lat, lng, entry.lat, entry.lon);
                if (!Number.isFinite(distanceKm)) {
                    continue;
                }
                candidates.push({ entry, distanceKm });
                if (bestDistance === null || distanceKm < bestDistance) {
                    bestDistance = distanceKm;
                }
                if (candidates.length >= MAX_CANDIDATES) {
                    break outer;
                }
            }
        }
        if (typeof bestDistance === "number" && bestDistance <= MAX_DISTANCE_KM) {
            break;
        }
    }

    return candidates;
}

function sortCandidatesByScore(candidates: Candidate[]): Candidate[] {
    if (!candidates.length) {
        return candidates;
    }
    return [...candidates].sort(compareCandidates);
}

function compareCandidates(a: Candidate, b: Candidate): number {
    if (a.distanceKm !== b.distanceKm) {
        return a.distanceKm - b.distanceKm;
    }
    const popA = a.entry.population ?? 0;
    const popB = b.entry.population ?? 0;
    if (popA !== popB) {
        return popB - popA;
    }
    return a.entry.id.localeCompare(b.entry.id);
}

function logResolutionDebug(
    params: ResolveInfraZoneByClickParams,
    normalizedKey: string,
    exactCount: number,
    candidates: Candidate[],
    reason: InfraZoneResolutionReason
): void {
    if (!params.debug || process.env.NODE_ENV !== "development") {
        return;
    }
    const topCandidates = candidates.slice(0, 3).map((candidate) => ({
        id: candidate.entry.id,
        name: candidate.entry.name,
        distanceKm: Number.isFinite(candidate.distanceKm)
            ? Number(candidate.distanceKm.toFixed(2))
            : null,
        population: candidate.entry.population ?? null
    }));
    console.debug("[infra-zone-resolution] resolveInfraZoneByClick", {
        labelName: params.labelName ?? null,
        key: normalizedKey,
        exactMatchCount: exactCount,
        reason,
        candidates: topCandidates
    });
}

function listRingKeys(cx: number, cy: number, ring: number): string[] {
    if (ring === 0) {
        return [formatCellKey(cx, cy)];
    }
    const keys: string[] = [];
    const minX = cx - ring;
    const maxX = cx + ring;
    const minY = cy - ring;
    const maxY = cy + ring;

    for (let x = minX; x <= maxX; x++) {
        keys.push(formatCellKey(x, minY));
        keys.push(formatCellKey(x, maxY));
    }
    for (let y = minY + 1; y <= maxY - 1; y++) {
        keys.push(formatCellKey(minX, y));
        keys.push(formatCellKey(maxX, y));
    }
    return keys;
}

function encodeCellKey(lon: number, lat: number, cellSizeDeg: number): string {
    const x = Math.floor(lon / cellSizeDeg);
    const y = Math.floor(lat / cellSizeDeg);
    return formatCellKey(x, y);
}

function formatCellKey(x: number, y: number): string {
    return `${x}:${y}`;
}

function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toRadians(value: number): number {
    return (value * Math.PI) / 180;
}
