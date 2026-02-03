import { loadCommunesIndexLite, type CommuneIndexLiteEntry } from "./communesIndexLite";
import { normalizeName, tokenizeName } from "./nameNormalization";

export { normalizeName, tokenizeName } from "./nameNormalization";

const CELL_SIZE_DEGREES = 0.2;
const MAX_SEARCH_RING = 6;
const MAX_DISTANCE_KM = 30;
const MAX_CANDIDATES = 64;

export type NearestCommuneResult = {
    inseeCode: string;
    distanceKm: number;
};

export type CommuneResolutionReason = "name:exact" | "name:partial" | "distance";

export type ResolveCommuneByClickParams = {
    lng: number;
    lat: number;
    labelName?: string | null;
    debug?: boolean;
    /**
     * When true, only resolve when an exact name match exists nearby (no partial/distance fallback).
     * This is the safe mode for label clicks.
     */
    requireNameMatch?: boolean;
};

export type ResolveCommuneByClickResult = {
    inseeCode: string;
    distanceKm: number;
    reason: CommuneResolutionReason;
};

type SpatialGrid = {
    cellSizeDeg: number;
    cells: Map<string, string[]>;
};

type SpatialContext = {
    communes: Map<string, CommuneIndexLiteEntry>;
    grid: SpatialGrid;
    nameIndex: Map<string, string[]>;
};

let spatialGridPromise: Promise<SpatialGrid> | null = null;
let nameIndexPromise: Promise<Map<string, string[]>> | null = null;
const normalizedTokenCache = new Map<string, string[]>();

type Candidate = {
    entry: CommuneIndexLiteEntry;
    distanceKm: number;
};

export async function resolveNearestCommuneInsee(
    lng: number,
    lat: number,
    signal?: AbortSignal
): Promise<NearestCommuneResult | null> {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
        return null;
    }

    const { communes, grid } = await loadSpatialContext(signal);
    const candidates = collectSpatialCandidates(communes, grid, lng, lat);
    if (!candidates.length) {
        return null;
    }
    const nearest = candidates.reduce((best, candidate) => {
        if (!best || candidate.distanceKm < best.distanceKm) {
            return candidate;
        }
        return best;
    }, null as Candidate | null);
    if (!nearest || nearest.distanceKm > MAX_DISTANCE_KM) {
        return null;
    }
    return {
        inseeCode: nearest.entry.inseeCode,
        distanceKm: nearest.distanceKm
    };
}

export async function resolveCommuneByClick(
    params: ResolveCommuneByClickParams,
    signal?: AbortSignal
): Promise<ResolveCommuneByClickResult | null> {
    const { lng, lat } = params;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
        return null;
    }

    const { communes, grid, nameIndex } = await loadSpatialContext(signal);
    const normalizedLabel = normalizeName(params.labelName ?? null);
    const labelTokens = tokenizeName(params.labelName ?? null);
    const exactCandidates = normalizedLabel.length
        ? buildExactMatchCandidates(normalizedLabel, nameIndex, communes, lng, lat)
        : [];
    const sortedExact = sortCandidatesByScore(exactCandidates);
    const exactBest = sortedExact[0] ?? null;

    if (exactBest) {
        const hasDistance = Number.isFinite(exactBest.distanceKm);
        const distanceOk = !hasDistance || exactBest.distanceKm <= MAX_DISTANCE_KM;
        if (distanceOk) {
            logResolutionDebug(params, normalizedLabel, exactCandidates.length, sortedExact, "name:exact");
            return {
                inseeCode: exactBest.entry.inseeCode,
                distanceKm: exactBest.distanceKm,
                reason: "name:exact"
            };
        }
        if (params.debug && process.env.NODE_ENV === "development") {
            console.warn("[commune-resolution] Exact match rejected by distance guard", {
                labelName: params.labelName ?? null,
                inseeCode: exactBest.entry.inseeCode,
                name: exactBest.entry.name,
                distanceKm: exactBest.distanceKm
            });
        }
        if (params.requireNameMatch) {
            logResolutionDebug(params, normalizedLabel, exactCandidates.length, sortedExact, "name:exact");
            return null;
        }
    } else if (params.requireNameMatch) {
        logResolutionDebug(params, normalizedLabel, exactCandidates.length, [], "name:exact");
        return null;
    }

    const spatialCandidates = collectSpatialCandidates(communes, grid, lng, lat);
    if (!spatialCandidates.length) {
        logResolutionDebug(params, normalizedLabel, exactCandidates.length, [], "distance");
        return null;
    }

    const sortedSpatial = sortCandidatesByScore(spatialCandidates);
    let candidatePool = sortedSpatial;
    let reason: CommuneResolutionReason = "distance";

    if (labelTokens.length >= 2) {
        const labelTokenSet = new Set(labelTokens);
        const partialCandidates = sortedSpatial.filter((candidate) => {
            const tokens = getCommuneTokens(candidate.entry);
            if (!tokens.length) {
                return false;
            }
            const tokenSet = new Set(tokens);
            for (const token of labelTokenSet) {
                if (!tokenSet.has(token)) {
                    return false;
                }
            }
            return true;
        });
        if (partialCandidates.length) {
            candidatePool = partialCandidates;
            reason = "name:partial";
        }
    }

    const best = candidatePool[0] ?? null;
    if (!best) {
        logResolutionDebug(params, normalizedLabel, exactCandidates.length, candidatePool, reason);
        return null;
    }

    if (reason === "distance" && best.distanceKm > MAX_DISTANCE_KM) {
        logResolutionDebug(params, normalizedLabel, exactCandidates.length, candidatePool, reason);
        return null;
    }

    logResolutionDebug(params, normalizedLabel, exactCandidates.length, candidatePool, reason);

    return {
        inseeCode: best.entry.inseeCode,
        distanceKm: best.distanceKm,
        reason
    };
}

async function ensureSpatialGrid(communes: Map<string, CommuneIndexLiteEntry>): Promise<SpatialGrid> {
    if (!spatialGridPromise) {
        spatialGridPromise = Promise.resolve(buildSpatialGrid(communes));
    }
    return spatialGridPromise;
}

function buildSpatialGrid(communes: Map<string, CommuneIndexLiteEntry>): SpatialGrid {
    const cells = new Map<string, string[]>();
    for (const entry of communes.values()) {
        if (!Number.isFinite(entry.lat) || !Number.isFinite(entry.lon)) {
            continue;
        }
        const key = encodeCellKey(entry.lon, entry.lat, CELL_SIZE_DEGREES);
        let bucket = cells.get(key);
        if (!bucket) {
            bucket = [];
            cells.set(key, bucket);
        }
        bucket.push(entry.inseeCode);
    }
    return { cellSizeDeg: CELL_SIZE_DEGREES, cells };
}

function collectSpatialCandidates(
    communes: Map<string, CommuneIndexLiteEntry>,
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
            for (const inseeCode of bucket) {
                if (visited.has(inseeCode)) {
                    continue;
                }
                visited.add(inseeCode);
                const entry = communes.get(inseeCode);
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

function buildExactMatchCandidates(
    normalizedKey: string,
    nameIndex: Map<string, string[]>,
    communes: Map<string, CommuneIndexLiteEntry>,
    lng: number,
    lat: number
): Candidate[] {
    if (!normalizedKey) {
        return [];
    }
    const inseeCodes = nameIndex.get(normalizedKey);
    if (!inseeCodes || !inseeCodes.length) {
        return [];
    }
    const candidates: Candidate[] = [];
    for (const code of inseeCodes) {
        const entry = communes.get(code);
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

function sortCandidatesByScore(candidates: Candidate[]): Candidate[] {
    if (!candidates.length) {
        return candidates;
    }
    return [...candidates].sort(compareCandidates);
}

function compareCandidates(a: Candidate, b: Candidate): number {
    const distanceComparison = compareDistances(a.distanceKm, b.distanceKm);
    if (distanceComparison !== 0) {
        return distanceComparison;
    }
    const popA = a.entry.population ?? 0;
    const popB = b.entry.population ?? 0;
    if (popA !== popB) {
        return popB - popA;
    }
    return a.entry.inseeCode.localeCompare(b.entry.inseeCode);
}

function compareDistances(a: number, b: number): number {
    const safeA = Number.isFinite(a) ? a : Number.POSITIVE_INFINITY;
    const safeB = Number.isFinite(b) ? b : Number.POSITIVE_INFINITY;
    if (safeA === safeB) {
        return 0;
    }
    return safeA < safeB ? -1 : 1;
}

function logResolutionDebug(
    params: ResolveCommuneByClickParams,
    normalizedKey: string,
    exactMatchCount: number,
    candidates: Candidate[],
    reason: CommuneResolutionReason
): void {
    if (!params.debug || process.env.NODE_ENV !== "development") {
        return;
    }
    const topCandidates = candidates.slice(0, 3).map(formatCandidateDebug);
    console.debug("[commune-resolution] resolveCommuneByClick", {
        labelName: params.labelName ?? null,
        key: normalizedKey,
        exactMatchCount,
        reason,
        candidates: topCandidates
    });
}

function formatCandidateDebug(candidate: Candidate): {
    inseeCode: string;
    name: string;
    distanceKm: number | null;
    population: number | null;
} {
    return {
        inseeCode: candidate.entry.inseeCode,
        name: candidate.entry.name,
        distanceKm: Number.isFinite(candidate.distanceKm)
            ? Number(candidate.distanceKm.toFixed(2))
            : null,
        population: candidate.entry.population ?? null
    };
}

function getCommuneTokens(entry: CommuneIndexLiteEntry): string[] {
    const cached = normalizedTokenCache.get(entry.inseeCode);
    if (cached) {
        return cached;
    }
    const tokens = tokenizeName(entry.name);
    normalizedTokenCache.set(entry.inseeCode, tokens);
    return tokens;
}

async function loadSpatialContext(signal?: AbortSignal): Promise<SpatialContext> {
    const communes = await loadCommunesIndexLite(signal);
    const [grid, nameIndex] = await Promise.all([
        ensureSpatialGrid(communes),
        ensureNameIndex(communes)
    ]);
    return { communes, grid, nameIndex };
}

async function ensureNameIndex(communes: Map<string, CommuneIndexLiteEntry>): Promise<Map<string, string[]>> {
    if (!nameIndexPromise) {
        nameIndexPromise = Promise.resolve(buildNameIndex(communes));
    }
    return nameIndexPromise;
}

function buildNameIndex(communes: Map<string, CommuneIndexLiteEntry>): Map<string, string[]> {
    const index = new Map<string, string[]>();
    for (const entry of communes.values()) {
        const key = normalizeName(entry.name);
        if (!key) {
            continue;
        }
        const bucket = index.get(key);
        if (bucket) {
            bucket.push(entry.inseeCode);
        } else {
            index.set(key, [entry.inseeCode]);
        }
    }
    return index;
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
    const R = 6371; // km
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toRadians(value: number): number {
    return (value * Math.PI) / 180;
}
