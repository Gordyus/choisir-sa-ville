import type { StyleSpecification } from "maplibre-gl";

import type { MapTilesConfig } from "@/lib/config/mapTilesConfig";

export async function loadVectorMapStyle(config: MapTilesConfig, signal?: AbortSignal): Promise<StyleSpecification> {
    const [style, availableLayers] = await Promise.all([
        fetchJson<StyleSpecification>(config.styleUrl, signal),
        loadVectorLayerNames(config.tilesMetadataUrl, signal).catch(() => null)
    ]);

    if (!Array.isArray(style.layers)) {
        return style;
    }

    const availableLayerSet = availableLayers ? new Set(availableLayers) : null;
    const excludedLayerSet = buildExcludedLayerSet(config.excludeLayers);

    const sanitizedLayers = style.layers.filter((layer) => {
        const sourceLayer = (layer as { "source-layer"?: unknown })["source-layer"];
        if (shouldHideLayer(layer, sourceLayer, excludedLayerSet)) {
            console.info(`[map-style] Removing layer ${layer.id} via excludeLayers setting.`);
            return false;
        }

        if (availableLayerSet && typeof sourceLayer === "string" && !availableLayerSet.has(sourceLayer)) {
            console.warn(`[map-style] Removing layer ${layer.id} referencing missing source-layer ${sourceLayer}`);
            return false;
        }

        return true;
    });

    return { ...style, layers: sanitizedLayers };
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
    const response = await fetch(url, { signal: signal ?? null, cache: "force-cache" });
    if (!response.ok) {
        throw new Error(`[map-style] Failed to fetch ${url} (${response.status})`);
    }
    return (await response.json()) as T;
}

async function loadVectorLayerNames(url: string | undefined, signal?: AbortSignal): Promise<string[]> {
    if (!url) {
        return [];
    }
    const metadata = await fetchJson<{
        vector_layers?: Array<{ id?: string; name?: string }>;
    }>(url, signal);
    const layers = metadata.vector_layers ?? [];
    return layers
        .map((layer) => layer.name || layer.id)
        .filter((name): name is string => typeof name === "string" && name.length > 0);
}

function buildExcludedLayerSet(layers?: string[]): Set<string> | null {
    if (!layers || layers.length === 0) {
        return null;
    }
    return new Set(layers);
}

function shouldHideLayer(
    layer: { id?: string | number },
    sourceLayer: unknown,
    excludedLayerSet: Set<string> | null
): boolean {
    if (!excludedLayerSet || excludedLayerSet.size === 0) {
        return false;
    }

    const sourceLayerName = typeof sourceLayer === "string" ? sourceLayer : null;
    if (typeof layer.id === "string" && excludedLayerSet.has(layer.id)) {
        return true;
    }
    if (sourceLayerName && excludedLayerSet.has(sourceLayerName)) {
        return true;
    }
    return false;
}
