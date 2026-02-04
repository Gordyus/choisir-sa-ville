export type DebugConfig = {
    enabled: boolean;
    logHighlightFeatures: boolean;
    logEntityFetch: boolean;
    logStyleHints: boolean;
    showTileBoundaries: boolean;
    showCollisionBoxes: boolean;
};

const DEFAULT_CONFIG: DebugConfig = {
    enabled: false,
    logHighlightFeatures: false,
    logEntityFetch: false,
    logStyleHints: false,
    showTileBoundaries: false,
    showCollisionBoxes: false
};

let debugConfigPromise: Promise<DebugConfig> | null = null;
let debugConfigOncePromise: Promise<DebugConfig> | null = null;

export async function loadDebugConfig(signal?: AbortSignal): Promise<DebugConfig> {
    if (process.env.NODE_ENV === "development") {
        return resolveDebugConfig(signal);
    }
    if (!debugConfigPromise) {
        debugConfigPromise = resolveDebugConfig(signal).catch((error) => {
            debugConfigPromise = null;
            throw error;
        });
    }
    return debugConfigPromise;
}

/**
 * Load debug config once (cached even in development).
 * Useful for modules that must avoid re-fetching config on every operation.
 */
export async function loadDebugConfigOnce(signal?: AbortSignal): Promise<DebugConfig> {
    if (!debugConfigOncePromise) {
        debugConfigOncePromise = resolveDebugConfig(signal).catch((error) => {
            debugConfigOncePromise = null;
            throw error;
        });
    }
    return debugConfigOncePromise;
}

async function resolveDebugConfig(signal?: AbortSignal): Promise<DebugConfig> {
    // This config is meant for client-side diagnostics.
    // On the server (SSR/RSC), a relative URL cannot be fetched without a base origin.
    // Defaulting silently avoids noisy warnings during SSR.
    if (typeof window === "undefined") {
        return DEFAULT_CONFIG;
    }

    const url = "/config/app-debug.json";

    try {
        const cache = process.env.NODE_ENV === "development" ? "no-store" : "force-cache";
        const response = await fetch(url, { signal: signal ?? null, cache });
        if (!response.ok) {
            console.warn(`[config] ${url} missing (${response.status}). Using defaults.`);
            return DEFAULT_CONFIG;
        }

        const json = (await response.json()) as unknown;
        const parsed = parseDebugConfig(json);
        if (!parsed) {
            console.warn(`[config] ${url} invalid. Using defaults.`);
            return DEFAULT_CONFIG;
        }

        return parsed;
    } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
            throw error;
        }
        console.warn(`[config] Failed to load ${url}. Using defaults.`, error);
        return DEFAULT_CONFIG;
    }
}

function parseDebugConfig(value: unknown): DebugConfig | null {
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;

    const enabled = toBoolean(record.enabled);
    const logHighlightFeatures = toBoolean(record.logHighlightFeatures);
    const logEntityFetch = toBoolean(record.logEntityFetch);
    const logStyleHints = toBoolean(record.logStyleHints);
    const showTileBoundaries = toBoolean(record.showTileBoundaries);
    const showCollisionBoxes = toBoolean(record.showCollisionBoxes);

    if (
        enabled == null ||
        logHighlightFeatures == null ||
        logEntityFetch == null ||
        logStyleHints == null ||
        showTileBoundaries == null ||
        showCollisionBoxes == null
    ) {
        return null;
    }

    return {
        enabled,
        logHighlightFeatures,
        logEntityFetch,
        logStyleHints,
        showTileBoundaries,
        showCollisionBoxes
    };
}

function toBoolean(value: unknown): boolean | null {
    if (typeof value !== "boolean") return null;
    return value;
}
