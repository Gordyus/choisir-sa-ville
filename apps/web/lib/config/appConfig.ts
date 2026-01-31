import { loadMapTilesConfig, type MapTilesConfig } from "./mapTilesConfig";

export type AppConfig = {
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
    const mapTiles = await loadMapTilesConfig(signal);
    return { mapTiles };
}

