import { loadMapTilesConfig, type MapTilesConfig } from "./mapTilesConfig";
import { loadDebugConfig, type DebugConfig } from "./debugConfig";

export type AppConfig = {
    mapTiles: MapTilesConfig;
    debug: DebugConfig;
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
    const [mapTiles, debug] = await Promise.all([loadMapTilesConfig(signal), loadDebugConfig(signal)]);
    return { mapTiles, debug };
}
