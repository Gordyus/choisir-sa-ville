/**
 * Style Loader - Fetches MapLibre style and tile metadata.
 * Pure data fetching, no business logic.
 */

import type { StyleSpecification } from "maplibre-gl";

export type TileJsonMetadata = {
    vector_layers?: Array<{ id?: string; name?: string }>;
    tiles?: string[];
    bounds?: number[];
    center?: number[];
    minzoom?: number;
    maxzoom?: number;
};

export type VectorLayerAvailability = Map<string, Set<string>>;

/**
 * Fetch a JSON resource with error handling
 */
export async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
    const response = await fetch(url, { signal: signal ?? null, cache: "force-cache" });
    if (!response.ok) {
        throw new Error(`[style-loader] Failed to fetch ${url} (${response.status})`);
    }
    return (await response.json()) as T;
}

/**
 * Load a MapLibre style specification from a URL
 */
 export async function loadStyle(styleUrl: string, signal?: AbortSignal): Promise<StyleSpecification | null> {
    try {
        return await fetchJson<StyleSpecification>(styleUrl, signal);
    } catch (error) {
        if (process.env.NODE_ENV === "development") {
            console.warn(
                `[style-loader] Failed to fetch ${styleUrl}. Map will fall back to a minimal style.`,
                error
            );
        }
        return null;
    }
}

/**
 * Load TileJSON metadata and extract vector layer names
 */
export async function loadTileJsonMetadata(
    tileJsonUrl: string,
    signal?: AbortSignal
): Promise<TileJsonMetadata> {
    return fetchJson<TileJsonMetadata>(tileJsonUrl, signal);
}

/**
 * Extract vector layer names from TileJSON metadata
 */
export function extractVectorLayerNames(metadata: TileJsonMetadata): string[] {
    const layers = metadata.vector_layers ?? [];
    return layers
        .map((layer) => layer.name || layer.id)
        .filter((name): name is string => typeof name === "string" && name.length > 0);
}

/**
 * Load vector layer names from a TileJSON URL
 */
export async function loadVectorLayerNames(
    tileJsonUrl: string | undefined,
    signal?: AbortSignal
): Promise<string[]> {
    if (!tileJsonUrl) {
        return [];
    }
    try {
        const metadata = await loadTileJsonMetadata(tileJsonUrl, signal);
        return extractVectorLayerNames(metadata);
    } catch {
        return [];
    }
}

/**
 * Load availability info for multiple TileJSON sources
 * Returns a map of sourceId -> Set of available layer names
 */
export async function loadSourceAvailability(
    sources: Record<string, string>,
    signal?: AbortSignal
): Promise<VectorLayerAvailability> {
    const entries = await Promise.all(
        Object.entries(sources).map(async ([sourceId, url]) => {
            try {
                const layers = await loadVectorLayerNames(url, signal);
                return [sourceId, new Set(layers)] as const;
            } catch (error) {
                if (process.env.NODE_ENV === "development") {
                    console.warn(`[style-loader] Unable to inspect ${sourceId} TileJSON at ${url}`, error);
                }
                return null;
            }
        })
    );

    const availability: VectorLayerAvailability = new Map();
    for (const entry of entries) {
        if (entry) {
            availability.set(entry[0], entry[1]);
        }
    }
    return availability;
}

/**
 * Check if a source-layer is available in the given availability map
 */
export function isSourceLayerAvailable(
    availability: VectorLayerAvailability,
    sourceId: string,
    sourceLayer: string
): boolean {
    const layerSet = availability.get(sourceId);
    // If we have no metadata for this source, assume it's available
    if (!layerSet) {
        return true;
    }
    return layerSet.has(sourceLayer);
}
