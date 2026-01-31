import type { HysteresisConfig, WorldGridConfig, ZoomRule } from "@/lib/config/mapMarkersConfig";

import type { CommunesIndexLite } from "./communesIndexLite";
import type { InfraZonesIndexLite } from "./infraZonesIndexLite";
import { pointToCellId } from "./grid";
import { scoreCommune, scoreInfra } from "./markerScoring";
import { latLngToTile, resolveTileZoom, tileCellId } from "./worldGrid";

export type MarkerKind = "commune" | "infra";

export type MarkerCandidate = {
    type: MarkerKind;
    id: string;
    lat: number;
    lng: number;
    label: string;
    score: number;
};

export type Bounds = {
    north: number;
    south: number;
    east: number;
    west: number;
};

export type ProjectFn = (lat: number, lng: number) => { x: number; y: number };

export type MarkerSelectionInput = {
    communes: CommunesIndexLite;
    infra: InfraZonesIndexLite;
    bounds: Bounds;
    zoom: number;
    zoomRules: ZoomRule[];
    worldGrid: WorldGridConfig;
    hysteresis: HysteresisConfig;
    previous?: MarkerSelectionResult | null;
    project: ProjectFn;
    mapSize: { width: number; height: number };
};

export type MarkerSelectionResult = {
    communes: MarkerCandidate[];
    infra: MarkerCandidate[];
};

type ZoomSettings = {
    includeInfra: boolean;
    cellSize: number;
    budget: number;
    infraShare: number;
};

export function selectMarkers(input: MarkerSelectionInput): MarkerSelectionResult {
    const settings = resolveZoomSettings(input.zoom, input.zoomRules);
    const cellCandidates = new Map<string, MarkerCandidate>();

    const resolveCellId = createCellIdResolver(input, settings);

    iterateCommunes(input, settings, resolveCellId, cellCandidates);
    if (settings.includeInfra) {
        iterateInfra(input, settings, resolveCellId, cellCandidates);
    }

    if (input.hysteresis.enabled && input.previous) {
        applyHysteresis(input, settings, resolveCellId, cellCandidates);
    }

    const sorted = Array.from(cellCandidates.values()).sort((a, b) => b.score - a.score);
    const pickedCommunes: MarkerCandidate[] = [];
    const pickedInfra: MarkerCandidate[] = [];
    const maxInfra = settings.includeInfra ? Math.max(0, Math.floor(settings.budget * settings.infraShare)) : 0;

    for (const candidate of sorted) {
        const totalPicked = pickedCommunes.length + pickedInfra.length;
        if (totalPicked >= settings.budget) {
            break;
        }
        if (candidate.type === "infra") {
            if (!settings.includeInfra) continue;
            if (pickedInfra.length >= maxInfra) continue;
            pickedInfra.push(candidate);
        } else {
            pickedCommunes.push(candidate);
        }
    }

    return { communes: pickedCommunes, infra: pickedInfra };
}

function resolveZoomSettings(zoom: number, zoomRules: ZoomRule[]): ZoomSettings {
    for (const rule of zoomRules) {
        if (zoom <= rule.maxZoom) {
            return {
                includeInfra: rule.includeInfra,
                cellSize: rule.cellSize,
                budget: rule.budget,
                infraShare: rule.infraShare
            };
        }
    }
    const fallback = zoomRules[zoomRules.length - 1];
    if (!fallback) {
        return { includeInfra: false, cellSize: 90, budget: 200, infraShare: 0 };
    }
    return {
        includeInfra: fallback.includeInfra,
        cellSize: fallback.cellSize,
        budget: fallback.budget,
        infraShare: fallback.infraShare
    };
}

function iterateCommunes(
    input: MarkerSelectionInput,
    settings: ZoomSettings,
    resolveCellId: (lat: number, lng: number) => string,
    cellCandidates: Map<string, MarkerCandidate>
): void {
    const length = input.communes.insee.length;
    for (let index = 0; index < length; index += 1) {
        const lat = input.communes.lat[index];
        const lng = input.communes.lng[index];
        if (lat == null || lng == null) continue;
        if (!isInsideBounds(lat, lng, input.bounds)) continue;
        const id = input.communes.insee[index];
        const label = input.communes.name[index];
        if (!id || !label) continue;
        const population = input.communes.population[index] ?? null;

        const candidate: MarkerCandidate = {
            type: "commune",
            id,
            lat,
            lng,
            label,
            score: scoreCommune(population, input.zoom)
        };
        considerCandidate(candidate, resolveCellId, cellCandidates);
    }
}

function iterateInfra(
    input: MarkerSelectionInput,
    settings: ZoomSettings,
    resolveCellId: (lat: number, lng: number) => string,
    cellCandidates: Map<string, MarkerCandidate>
): void {
    const length = input.infra.id.length;
    for (let index = 0; index < length; index += 1) {
        const lat = input.infra.lat[index];
        const lng = input.infra.lng[index];
        if (lat == null || lng == null) continue;
        if (!isInsideBounds(lat, lng, input.bounds)) continue;
        const id = input.infra.id[index];
        const label = input.infra.name[index];
        if (!id || !label) continue;
        const population = input.infra.population[index] ?? null;

        const candidate: MarkerCandidate = {
            type: "infra",
            id,
            lat,
            lng,
            label,
            score: scoreInfra(population, input.zoom)
        };
        considerCandidate(candidate, resolveCellId, cellCandidates);
    }
}

function considerCandidate(
    candidate: MarkerCandidate,
    resolveCellId: (lat: number, lng: number) => string,
    cellCandidates: Map<string, MarkerCandidate>
): void {
    const cellId = resolveCellId(candidate.lat, candidate.lng);
    const current = cellCandidates.get(cellId);
    if (!current || current.score < candidate.score) {
        cellCandidates.set(cellId, candidate);
    }
}

function createCellIdResolver(input: MarkerSelectionInput, settings: ZoomSettings): (lat: number, lng: number) => string {
    if (input.worldGrid.enabled) {
        const z = resolveTileZoom(
            input.zoom,
            input.worldGrid.tileZoomOffset,
            input.worldGrid.minTileZoom,
            input.worldGrid.maxTileZoom
        );
        return (lat, lng) => tileCellId(latLngToTile(lat, lng, z));
    }

    const cellSize = settings.cellSize;
    const project = input.project;
    return (lat, lng) => {
        const point = project(lat, lng);
        return pointToCellId(point, cellSize);
    };
}

function applyHysteresis(
    input: MarkerSelectionInput,
    settings: ZoomSettings,
    resolveCellId: (lat: number, lng: number) => string,
    cellCandidates: Map<string, MarkerCandidate>
): void {
    const previous = input.previous;
    if (!previous) return;

    const ratio = input.hysteresis.replaceRatio;

    const previousCandidates: MarkerCandidate[] = [];
    previousCandidates.push(...previous.communes);
    if (settings.includeInfra) {
        previousCandidates.push(...previous.infra);
    }

    for (const prev of previousCandidates) {
        if (!isInsideBounds(prev.lat, prev.lng, input.bounds)) continue;
        const cellId = resolveCellId(prev.lat, prev.lng);
        const next = cellCandidates.get(cellId);

        if (!next) {
            cellCandidates.set(cellId, prev);
            continue;
        }

        if (next.id === prev.id && next.type === prev.type) {
            continue;
        }

        if (next.score < prev.score * ratio) {
            cellCandidates.set(cellId, prev);
        }
    }
}

function isInsideBounds(lat: number, lng: number, bounds: Bounds): boolean {
    if (lat < bounds.south || lat > bounds.north) {
        return false;
    }
    if (bounds.west <= bounds.east) {
        return lng >= bounds.west && lng <= bounds.east;
    }
    return lng >= bounds.west || lng <= bounds.east;
}
