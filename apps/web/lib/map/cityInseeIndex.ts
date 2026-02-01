import type { CityResolutionMethod } from "./interactiveLayers";

const MAPPING_URL = "/data/city-osm-insee.json";

export type CityOsmInseeRecord = {
    insee: string;
    osmId?: number | string | null;
    wikidata?: string | null;
};

const osmToInsee = new Map<string, string>();
const wikidataToInsee = new Map<string, string>();

let loadPromise: Promise<void> | null = null;
let lastWarningAt = 0;

export async function initCityInseeIndex(signal?: AbortSignal): Promise<void> {
    if (!loadPromise) {
        loadPromise = loadMapping(signal).catch((error) => {
            loadPromise = null;
            throw error;
        });
    }
    return loadPromise;
}

export function isCityInseeIndexReady(): boolean {
    return loadPromise !== null && osmToInsee.size > 0;
}

export function getInseeByOsmId(osmId: unknown): string | null {
    const normalized = normalizeOsmId(osmId);
    if (!normalized) {
        return null;
    }
    return osmToInsee.get(normalized) ?? null;
}

export function getInseeByWikidata(wikidataId: unknown): string | null {
    const normalized = normalizeWikidataId(wikidataId);
    if (!normalized) {
        return null;
    }
    return wikidataToInsee.get(normalized) ?? null;
}

export type InseeResolutionResult =
    | { status: "resolved"; method: CityResolutionMethod; insee: string }
    | { status: "unresolved"; reason: string };

export function describeResolution(result: InseeResolutionResult): string {
    if (result.status === "resolved") {
        return `insee=${result.insee} via ${result.method}`;
    }
    return result.reason;
}

async function loadMapping(signal?: AbortSignal): Promise<void> {
    const response = await fetch(MAPPING_URL, { signal: signal ?? null, cache: "force-cache" });
    if (!response.ok) {
        throw new Error(`[city-insee-index] Failed to fetch ${MAPPING_URL} (${response.status})`);
    }
    const payload = (await response.json()) as unknown;
    if (!Array.isArray(payload)) {
        throw new Error(`[city-insee-index] Invalid mapping payload (expected array)`);
    }

    osmToInsee.clear();
    wikidataToInsee.clear();

    for (const entry of payload) {
        if (!entry || typeof entry !== "object") {
            continue;
        }
        const record = entry as CityOsmInseeRecord;
        const insee = normalizeInsee(record.insee);
        if (!insee) {
            continue;
        }
        const osmKey = normalizeOsmId(record.osmId);
        if (osmKey) {
            osmToInsee.set(osmKey, insee);
        }
        const wikidataKey = normalizeWikidataId(record.wikidata);
        if (wikidataKey) {
            wikidataToInsee.set(wikidataKey, insee);
        }
    }

    runSelfCheck();
}

function normalizeOsmId(value: unknown): string | null {
    if (value == null) {
        return null;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
        return Math.trunc(value).toString();
    }
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed.length === 0) {
            return null;
        }
        return trimmed;
    }
    return null;
}

function normalizeInsee(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    if (!/^[0-9A-Z]{4,6}$/i.test(trimmed)) {
        return null;
    }
    return trimmed.toUpperCase();
}

function normalizeWikidataId(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    if (!/^Q[0-9]+$/i.test(trimmed)) {
        return null;
    }
    return trimmed.toUpperCase();
}

function runSelfCheck(): void {
    const samples: Array<[string, string]> = [
        ["34172", "Montpellier"],
        ["34108", "Castelnau-le-Lez"],
        ["34154", "Lattes"]
    ];
    const knownInseeCodes = new Set(osmToInsee.values());
    const missing: string[] = [];
    for (const [insee] of samples) {
        if (!knownInseeCodes.has(insee)) {
            missing.push(insee);
        }
    }
    if (missing.length && Date.now() - lastWarningAt > 60_000) {
        console.warn(
            "[city-insee-index] Missing self-check entries:",
            missing.join(", "),
            "— regenerate mapping to include them."
        );
        lastWarningAt = Date.now();
    }
}
