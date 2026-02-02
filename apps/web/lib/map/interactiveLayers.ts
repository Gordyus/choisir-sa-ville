/**
 * Interactive Layers - City identity extraction and related types.
 * This module provides types and utilities for city identification from map features.
 */

import type { ExpressionSpecification, MapGeoJSONFeature, StyleSpecification } from "maplibre-gl";

import { DEFAULT_PLACE_CLASSES, FEATURE_FIELDS } from "./registry/layerRegistry";

// Re-export registry constants for backward compatibility
export {
    ADMIN_POLYGON_SPECS as ADMIN_POLYGON_LAYER_SPECS,
    DEFAULT_PLACE_CLASSES,
    FEATURE_FIELDS,
    LAYER_IDS,
    OMT_LABEL_LAYER_IDS as BASE_COMMUNE_LABEL_LAYER_IDS,
    SOURCE_IDS,
    SOURCE_LAYERS
} from "./registry/layerRegistry";

// Re-export layer helpers for backward compatibility
export {
    buildPlaceClassExcludeFilter,
    buildPlaceClassIncludeFilter as buildPlaceClassFilter,
    getPlaceClasses as getPlaceClassList,
    setPlaceClasses as setPlaceClassList
} from "./layers/baseLabels";

// ============================================================================
// Constants (kept for backward compatibility)
// ============================================================================

export const CITY_ID_FIELD = FEATURE_FIELDS.inseeCode;
export const CITY_ID_FALLBACK_FIELDS = FEATURE_FIELDS.fallbackIds;

// Legacy layer IDs - kept for backward compatibility
export const COMMUNE_POLYGON_SOURCE_ID = "communes";
export const COMMUNE_POLYGON_SOURCE_LAYER = "communes";
export const COMMUNE_FILL_LAYER_ID = "communes-fill";
export const COMMUNE_LINE_LAYER_ID = "communes-line";

export const ARR_MUNICIPAL_SOURCE_ID = "arr_municipal";
export const ARR_MUNICIPAL_SOURCE_LAYER = "arr_municipal";
export const ARR_MUNICIPAL_FILL_LAYER_ID = "arr-municipal-fill";
export const ARR_MUNICIPAL_LINE_LAYER_ID = "arr-municipal-line";

// Legacy - kept for cityInteractiveLayer.ts compatibility
export const COMMUNE_LABEL_LAYERS: string[] = [
    "custom-city-label::place_label_other",
    "custom-city-label::place_label_city",
    "place_label_other",
    "place_label_city"
];

export const MANAGED_CITY_LABEL_LAYER_PREFIX = "custom-city-label::";
export const MANAGED_CITY_LABEL_METADATA_FLAG = "csv:managedCityLabel";
export const MANAGED_CITY_LABEL_METADATA_BASE_ID = "csv:managedCityBaseLayerId";

export function buildManagedCityLabelLayerId(layerId: string): string {
    return `${MANAGED_CITY_LABEL_LAYER_PREFIX}${layerId}`;
}

// ============================================================================
// Types
// ============================================================================

export type CityResolutionMethod = "feature" | "polygon" | "osm" | "wikidata" | "fallback";

export type CityPlaceClass = string;

export type CityIdentity = {
    id: string;
    name: string;
    inseeCode?: string | null;
    originalId?: string | null;
    osmId?: string | null;
    wikidataId?: string | null;
    resolutionMethod?: CityResolutionMethod;
    resolutionStatus?: "resolved" | "unresolved";
    unresolvedReason?: string | null;
    placeClass?: CityPlaceClass | null;
    location?: { lng: number; lat: number } | null;
    rank?: number | null;
    capitalType?: string | null;
    propertiesSnapshot?: Record<string, unknown> | null;
};

// ============================================================================
// City Identity Extraction
// ============================================================================

const CITY_NAME_FIELDS = FEATURE_FIELDS.names;
const CITY_ID_SENTINEL = "__none__";
const CITY_RANK_FIELDS = ["rank", "rank_local"] as const;
const CITY_CAPITAL_FIELDS = ["capital", "capital_level", "capital:municipality"] as const;
const PROPERTY_SNAPSHOT_FIELDS = [
    "name",
    "name:fr",
    "name:en",
    "class",
    "rank",
    "rank_local",
    "capital",
    "capital_level",
    "capital:municipality",
    "osm_id",
    "osmId",
    "wikidata",
    "insee"
] as const;

// Place class state
let placeClassSet = new Set(DEFAULT_PLACE_CLASSES.map((c) => c.toLowerCase()));

// Update place class set when classes change (called from baseLabels)
export function _updatePlaceClassSet(classes: readonly string[]): void {
    placeClassSet = new Set(classes.map((c) => c.toLowerCase()));
}

export const CITY_ID_EXPRESSION: ExpressionSpecification = [
    "coalesce",
    ["get", CITY_ID_FIELD],
    ...CITY_ID_FALLBACK_FIELDS.map((field) => ["get", field])
] as unknown as ExpressionSpecification;

export function createCityIdMatchExpression(cityId: string | null): ExpressionSpecification {
    return ["==", CITY_ID_EXPRESSION, cityId ?? CITY_ID_SENTINEL];
}

export function extractCityIdentity(feature: MapGeoJSONFeature): CityIdentity | null {
    const inseeCandidate = pickFirstString(feature, [CITY_ID_FIELD]);
    const fallbackId = pickFirstString(feature, [...CITY_ID_FALLBACK_FIELDS]);
    const id = inseeCandidate ?? fallbackId;
    if (!id) {
        return null;
    }
    const name = pickFirstString(feature, [...CITY_NAME_FIELDS]) ?? id;
    const placeClass = readPlaceClass(feature);
    const rank = readCityRank(feature);
    const capitalType = readCapitalType(feature);
    const identity: CityIdentity = {
        id,
        name,
        inseeCode: inseeCandidate ?? null,
        originalId: fallbackId ?? inseeCandidate ?? null,
        osmId: pickFirstString(feature, ["osm_id", "osmId"]) ?? null,
        wikidataId: pickFirstString(feature, ["wikidata"]) ?? null,
        placeClass,
        location: null,
        rank,
        capitalType,
        propertiesSnapshot: buildPropertiesSnapshot(feature)
    };
    if (inseeCandidate) {
        identity.resolutionMethod = "feature";
        identity.resolutionStatus = "resolved";
    }
    return identity;
}

export function pickCityIdFieldFromFeatures(features: readonly MapGeoJSONFeature[]): string | null {
    const fieldOrder = [CITY_ID_FIELD, ...CITY_ID_FALLBACK_FIELDS];
    for (const field of fieldOrder) {
        if (features.some((feature) => hasReadableProperty(feature, field))) {
            return field;
        }
    }
    return null;
}

let hasLoggedSymbolHints = false;

export function debugLogSymbolLabelHints(style?: StyleSpecification | null): void {
    if (hasLoggedSymbolHints || process.env.NODE_ENV !== "development") {
        return;
    }
    if (!style?.layers) {
        return;
    }
    const candidates = style.layers.filter((layer) => {
        if (layer.type !== "symbol") {
            return false;
        }
        const layout = layer.layout as Record<string, unknown> | undefined;
        return layout && typeof layout["text-field"] !== "undefined";
    });
    if (candidates.length) {
        console.warn("[map-style] Available text symbol layers:", candidates.map((layer) => layer.id).join(", "));
    } else {
        console.warn("[map-style] No text symbol layers detected in current style.");
    }
    hasLoggedSymbolHints = true;
}

// ============================================================================
// Helper Functions
// ============================================================================

function pickFirstString(feature: MapGeoJSONFeature, fields: readonly string[]): string | null {
    for (const field of fields) {
        const value = (feature.properties ?? {})[field];
        if (typeof value === "string" && value.length > 0) {
            return value;
        }
        if (typeof value === "number" && Number.isFinite(value)) {
            return value.toString();
        }
    }
    return null;
}

function pickFirstNumber(feature: MapGeoJSONFeature, fields: readonly string[]): number | null {
    for (const field of fields) {
        const value = (feature.properties ?? {})[field];
        if (typeof value === "number" && Number.isFinite(value)) {
            return value;
        }
        if (typeof value === "string") {
            const parsed = Number(value);
            if (Number.isFinite(parsed)) {
                return parsed;
            }
        }
    }
    return null;
}

function hasReadableProperty(feature: MapGeoJSONFeature, field: string): boolean {
    return pickFirstString(feature, [field]) !== null;
}

function readPlaceClass(feature: MapGeoJSONFeature): CityPlaceClass | null {
    const rawValue = (feature.properties ?? {}).class;
    if (typeof rawValue !== "string") {
        return null;
    }
    const normalized = rawValue.trim().toLowerCase();
    return placeClassSet.has(normalized) ? normalized : null;
}

function readCityRank(feature: MapGeoJSONFeature): number | null {
    return pickFirstNumber(feature, CITY_RANK_FIELDS);
}

function readCapitalType(feature: MapGeoJSONFeature): string | null {
    return pickFirstString(feature, CITY_CAPITAL_FIELDS);
}

function buildPropertiesSnapshot(feature: MapGeoJSONFeature): Record<string, unknown> | null {
    const properties = feature.properties ?? null;
    if (!properties) {
        return null;
    }
    const snapshot: Record<string, unknown> = {};
    for (const key of PROPERTY_SNAPSHOT_FIELDS) {
        if (typeof properties[key] !== "undefined") {
            snapshot[key] = properties[key];
        }
    }
    return Object.keys(snapshot).length ? snapshot : null;
}

// Self-check in development
if (process.env.NODE_ENV === "development") {
    const fakeFeature = {
        type: "Feature",
        properties: { name: "SelfCheckVille", osm_id: 12345 }
    } as unknown as MapGeoJSONFeature;
    const identity = extractCityIdentity(fakeFeature);
    if (!identity?.osmId || identity.osmId !== "12345") {
        console.warn("[city-identity] Failed to normalize osm_id during self-check.");
    }
}
