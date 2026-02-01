export type DebugConfig = {
    enabled: boolean;
    logHoverFeatures: boolean;
    logStyleHints: boolean;
    showTileBoundaries: boolean;
    showCollisionBoxes: boolean;
    managedCityLabelsEnabled: boolean;
};

const DEFAULT_CONFIG: DebugConfig = {
    enabled: false,
    logHoverFeatures: false,
    logStyleHints: false,
    showTileBoundaries: false,
    showCollisionBoxes: false,
    managedCityLabelsEnabled: true
};

let debugConfigPromise: Promise<DebugConfig> | null = null;

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

async function resolveDebugConfig(signal?: AbortSignal): Promise<DebugConfig> {
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
    const logHoverFeatures = toBoolean(record.logHoverFeatures);
    const logStyleHints = toBoolean(record.logStyleHints);
    const showTileBoundaries = toBoolean(record.showTileBoundaries);
    const showCollisionBoxes = toBoolean(record.showCollisionBoxes);
    const managedCityLabelsEnabledRaw = record.managedCityLabelsEnabled;
    const managedCityLabelsEnabled =
        typeof managedCityLabelsEnabledRaw === "undefined"
            ? true
            : toBoolean(managedCityLabelsEnabledRaw);

    if (
        enabled == null ||
        logHoverFeatures == null ||
        logStyleHints == null ||
        showTileBoundaries == null ||
        showCollisionBoxes == null ||
        managedCityLabelsEnabled == null
    ) {
        return null;
    }

    return {
        enabled,
        logHoverFeatures,
        logStyleHints,
        showTileBoundaries,
        showCollisionBoxes,
        managedCityLabelsEnabled
    };
}

function toBoolean(value: unknown): boolean | null {
    if (typeof value !== "boolean") return null;
    return value;
}

