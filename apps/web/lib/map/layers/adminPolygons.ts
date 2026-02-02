/**
 * Admin Polygons - Injects commune and arrondissement polygon sources and layers.
 * Handles source creation, layer creation, and proper ordering.
 */

import type {
    FillLayerSpecification,
    LineLayerSpecification,
    StyleSpecification,
    VectorSourceSpecification
} from "maplibre-gl";

import type { PolygonSourcesConfig } from "@/lib/config/mapTilesConfig";
import {
    ADMIN_POLYGON_SPECS,
    FEATURE_FIELDS,
    SOURCE_IDS,
    type AdminPolygonSpec
} from "@/lib/map/registry/layerRegistry";
import type { VectorLayerAvailability } from "@/lib/map/style/styleLoader";
import { isSourceLayerAvailable } from "@/lib/map/style/styleLoader";

import {
    ARR_MUNICIPAL_COLORS,
    ARR_MUNICIPAL_LINE_WIDTH,
    ARR_MUNICIPAL_OPACITY,
    buildFillColorExpr,
    buildFillOpacityExpr,
    buildLineColorExpr,
    buildLineOpacityExpr,
    buildLineWidthExpr,
    COMMUNE_COLORS,
    COMMUNE_LINE_WIDTH,
    COMMUNE_OPACITY
} from "./hoverState";

const warnedMissingSources = new Set<string>();

/**
 * Inject admin polygon sources and layers into a style specification.
 * Mutates the style in place.
 */
export function injectAdminPolygons(
    style: StyleSpecification,
    polygonSources: PolygonSourcesConfig,
    availability: VectorLayerAvailability
): void {
    if (!style.sources) {
        style.sources = {};
    }

    const sources = style.sources as Record<string, VectorSourceSpecification>;
    const newLayers: Array<FillLayerSpecification | LineLayerSpecification> = [];

    // Process communes
    const communesSpec = resolveSpec("communes", polygonSources);
    if (communesSpec && checkAvailability(availability, communesSpec)) {
        ensureVectorSource(sources, communesSpec);
        newLayers.push(
            buildCommuneFillLayer(communesSpec),
            buildCommuneLineLayer(communesSpec)
        );
    }

    // Process arr_municipal
    const arrMunicipalSpec = resolveSpec("arrMunicipal", polygonSources);
    if (arrMunicipalSpec && checkAvailability(availability, arrMunicipalSpec)) {
        ensureVectorSource(sources, arrMunicipalSpec);
        newLayers.push(
            buildArrMunicipalFillLayer(arrMunicipalSpec),
            buildArrMunicipalLineLayer(arrMunicipalSpec)
        );
    }

    if (!newLayers.length) {
        return;
    }

    // Insert layers before labels
    style.layers = insertLayersBeforeLabels(style.layers ?? [], newLayers);
}

type ResolvedSpec = AdminPolygonSpec & {
    tileJsonUrl: string;
    configuredSourceLayer: string;
};

/**
 * Resolve a polygon spec with config overrides
 */
function resolveSpec(
    key: "communes" | "arrMunicipal",
    polygonSources: PolygonSourcesConfig
): ResolvedSpec | null {
    const baseSpec = ADMIN_POLYGON_SPECS[key];
    const configKey = key === "arrMunicipal" ? "arr_municipal" : key;
    const config = polygonSources[configKey];

    if (!config?.tileJsonUrl) {
        return null;
    }

    return {
        ...baseSpec,
        sourceLayer: config.sourceLayer || baseSpec.sourceLayer,
        configuredSourceLayer: config.sourceLayer || baseSpec.sourceLayer,
        tileJsonUrl: config.tileJsonUrl
    };
}

/**
 * Check if the source-layer is available in the TileJSON metadata
 */
function checkAvailability(
    availability: VectorLayerAvailability,
    spec: ResolvedSpec
): boolean {
    const available = isSourceLayerAvailable(
        availability,
        spec.sourceId,
        spec.configuredSourceLayer
    );

    if (!available) {
        const key = `${spec.sourceId}/${spec.configuredSourceLayer}`;
        if (!warnedMissingSources.has(key)) {
            console.warn(
                `[admin-polygons] Skipping layers for "${key}" - source-layer not found in TileJSON metadata.`
            );
            warnedMissingSources.add(key);
        }
    }

    return available;
}

/**
 * Ensure a vector source exists with proper promoteId configuration
 */
function ensureVectorSource(
    sources: Record<string, VectorSourceSpecification>,
    spec: ResolvedSpec
): void {
    const existing = sources[spec.sourceId];

    if (existing) {
        // Update promoteId if needed
        if (existing.type === "vector") {
            const promote = existing.promoteId;
            if (!promote) {
                existing.promoteId = { [spec.configuredSourceLayer]: FEATURE_FIELDS.inseeCode };
            } else if (typeof promote === "object") {
                promote[spec.configuredSourceLayer] = promote[spec.configuredSourceLayer] ?? FEATURE_FIELDS.inseeCode;
            }
        }
        return;
    }

    sources[spec.sourceId] = {
        type: "vector",
        url: spec.tileJsonUrl,
        promoteId: { [spec.configuredSourceLayer]: FEATURE_FIELDS.inseeCode }
    } as VectorSourceSpecification;
}

/**
 * Insert new layers before the first label layer
 */
function insertLayersBeforeLabels(
    existingLayers: StyleSpecification["layers"],
    newLayers: Array<FillLayerSpecification | LineLayerSpecification>
): StyleSpecification["layers"] {
    // Find first symbol layer (labels usually come after fills/lines)
    const labelIndex = existingLayers.findIndex((layer) => layer.type === "symbol");

    if (labelIndex < 0) {
        return [...existingLayers, ...newLayers];
    }

    return [
        ...existingLayers.slice(0, labelIndex),
        ...newLayers,
        ...existingLayers.slice(labelIndex)
    ];
}

// ============================================================================
// Layer Builders
// ============================================================================

function buildCommuneFillLayer(spec: ResolvedSpec): FillLayerSpecification {
    return {
        id: spec.fillLayerId,
        type: "fill",
        source: spec.sourceId,
        "source-layer": spec.configuredSourceLayer,
        minzoom: spec.zoomRange.min,
        maxzoom: spec.zoomRange.max,
        paint: {
            "fill-color": buildFillColorExpr(COMMUNE_COLORS.fill),
            "fill-opacity": buildFillOpacityExpr(COMMUNE_OPACITY.fill)
        }
    };
}

function buildCommuneLineLayer(spec: ResolvedSpec): LineLayerSpecification {
    return {
        id: spec.lineLayerId,
        type: "line",
        source: spec.sourceId,
        "source-layer": spec.configuredSourceLayer,
        minzoom: spec.zoomRange.min,
        maxzoom: spec.zoomRange.max,
        paint: {
            "line-color": buildLineColorExpr(COMMUNE_COLORS.line),
            "line-opacity": buildLineOpacityExpr(COMMUNE_OPACITY.line),
            "line-width": buildLineWidthExpr(0, COMMUNE_LINE_WIDTH.hover, COMMUNE_LINE_WIDTH.selected)
        }
    };
}

function buildArrMunicipalFillLayer(spec: ResolvedSpec): FillLayerSpecification {
    return {
        id: spec.fillLayerId,
        type: "fill",
        source: spec.sourceId,
        "source-layer": spec.configuredSourceLayer,
        minzoom: spec.zoomRange.min,
        maxzoom: spec.zoomRange.max,
        paint: {
            "fill-color": buildFillColorExpr(ARR_MUNICIPAL_COLORS.fill),
            "fill-opacity": buildFillOpacityExpr(ARR_MUNICIPAL_OPACITY.fill)
        }
    };
}

function buildArrMunicipalLineLayer(spec: ResolvedSpec): LineLayerSpecification {
    return {
        id: spec.lineLayerId,
        type: "line",
        source: spec.sourceId,
        "source-layer": spec.configuredSourceLayer,
        minzoom: spec.zoomRange.min,
        maxzoom: spec.zoomRange.max,
        paint: {
            "line-color": buildLineColorExpr(ARR_MUNICIPAL_COLORS.line),
            "line-opacity": buildLineOpacityExpr(ARR_MUNICIPAL_OPACITY.line),
            "line-width": buildLineWidthExpr(0, ARR_MUNICIPAL_LINE_WIDTH.hover, ARR_MUNICIPAL_LINE_WIDTH.selected)
        }
    };
}
