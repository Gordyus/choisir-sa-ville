import { loadMapMarkersConfig, type MapMarkersConfig } from "./mapMarkersConfig";
import { loadMapTilesConfig, type MapTilesConfig } from "./mapTilesConfig";

export type AppConfig = {
    mapMarkers: MapMarkersConfig;
    mapTiles: MapTilesConfig;
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
    const [mapMarkers, mapTiles] = await Promise.all([
        loadMapMarkersConfig(signal),
        loadMapTilesConfig(signal)
    ]);
    return { mapMarkers, mapTiles };
}

