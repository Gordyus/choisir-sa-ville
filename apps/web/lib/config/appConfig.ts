import { loadMapMarkersConfig, type MapMarkersConfig } from "./mapMarkersConfig";

export type AppConfig = {
    mapMarkers: MapMarkersConfig;
};

let configPromise: Promise<AppConfig> | null = null;

export async function loadAppConfig(signal?: AbortSignal): Promise<AppConfig> {
    if (!configPromise) {
        configPromise = resolveAppConfig(signal).catch((error) => {
            configPromise = null;
            throw error;
        });
    }
    return configPromise;
}

async function resolveAppConfig(signal?: AbortSignal): Promise<AppConfig> {
    const mapMarkers = await loadMapMarkersConfig(signal);
    return { mapMarkers };
}

