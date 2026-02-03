/**
 * Interactive Layers - City identity extraction and related types.
 * This module provides types and utilities for city identification from map features.
 */

import type { MapGeoJSONFeature, StyleSpecification } from "maplibre-gl";

import { getPlaceClasses } from "./layers/baseLabels";
import { FEATURE_FIELDS } from "./registry/layerRegistry";

// ============================================================================
// Types
// ============================================================================

export type CityResolutionMethod = "feature" | "polygon" | "position" | "fallback";

export type CityPlaceClass = string;

export type CityIdentity = {
    id: string;
    name: string;
    inseeCode?: string | null;
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
const CITY_ID_FIELD = FEATURE_FIELDS.inseeCode;
const CITY_ID_FALLBACK_FIELDS = FEATURE_FIELDS.fallbackIds;
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
    "insee"
] as const;

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

function readPlaceClass(feature: MapGeoJSONFeature): CityPlaceClass | null {
    const rawValue = (feature.properties ?? {}).class;
    if (typeof rawValue !== "string") {
        return null;
    }
    const normalized = rawValue.trim().toLowerCase();
    const classSet = new Set(getPlaceClasses().map((c) => c.toLowerCase()));
    return classSet.has(normalized) ? normalized : null;
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

