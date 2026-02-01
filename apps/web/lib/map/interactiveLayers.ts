import type { ExpressionSpecification, MapGeoJSONFeature, StyleSpecification } from "maplibre-gl";

export type CityResolutionMethod = "feature" | "osm" | "wikidata" | "fallback";

export type CityPlaceClass = (typeof PLACE_ALLOWED_CLASSES)[number];

export const BASE_COMMUNE_LABEL_LAYER_IDS = ["place_label_other", "place_label_city"] as const;
export const MANAGED_CITY_LABEL_LAYER_SUFFIX = "__commune_custom";
export const MANAGED_CITY_LABEL_METADATA_FLAG = "csv:managedCityLabel";
export const MANAGED_CITY_LABEL_METADATA_BASE_ID = "csv:managedCityBaseLayerId";

export function buildManagedCityLabelLayerId(layerId: string): string {
    return `${layerId}${MANAGED_CITY_LABEL_LAYER_SUFFIX}`;
}

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
};

export const COMMUNE_LABEL_LAYERS: string[] = [
    ...BASE_COMMUNE_LABEL_LAYER_IDS.map((layerId) => buildManagedCityLabelLayerId(layerId)),
    ...BASE_COMMUNE_LABEL_LAYER_IDS
];

export const PLACE_ALLOWED_CLASSES = ["city", "town", "village"] as const;


export const PLACE_CLASS_FILTER: import("maplibre-gl").LegacyFilterSpecification = [
    "in",
    "class",
    ...PLACE_ALLOWED_CLASSES
] as any;

export const CITY_ID_FIELD = "insee";
export const CITY_ID_FALLBACK_FIELDS = ["osm_id", "osmId", "wikidata", "code", "id", "name:fr", "name"];
const CITY_NAME_FIELDS = ["name:fr", "name", "name:en"];
const CITY_ID_SENTINEL = "__none__";

export const CITY_ID_EXPRESSION: ExpressionSpecification = [
    "coalesce",
    ["get", CITY_ID_FIELD],
    ...CITY_ID_FALLBACK_FIELDS.map((field) => ["get", field])
] as unknown as ExpressionSpecification;

let hasLoggedSymbolHints = false;

if (process.env.NODE_ENV === "development") {
    runIdentitySelfCheck();
}

export function createCityIdMatchExpression(cityId: string | null): ExpressionSpecification {
    return ["==", CITY_ID_EXPRESSION, cityId ?? CITY_ID_SENTINEL];
}

export function extractCityIdentity(feature: MapGeoJSONFeature): CityIdentity | null {
    const inseeCandidate = pickFirstString(feature, [CITY_ID_FIELD]);
    const fallbackId = pickFirstString(feature, CITY_ID_FALLBACK_FIELDS);
    const id = inseeCandidate ?? fallbackId;
    if (!id) {
        return null;
    }
    const name = pickFirstString(feature, CITY_NAME_FIELDS) ?? id;
    const placeClass = readPlaceClass(feature);
    const identity: CityIdentity = {
        id,
        name,
        inseeCode: inseeCandidate ?? null,
        originalId: fallbackId ?? inseeCandidate ?? null,
        osmId: pickFirstString(feature, ["osm_id", "osmId"]) ?? null,
        wikidataId: pickFirstString(feature, ["wikidata"]) ?? null,
        placeClass,
        location: null
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

function hasReadableProperty(feature: MapGeoJSONFeature, field: string): boolean {
    return pickFirstString(feature, [field]) !== null;
}

function runIdentitySelfCheck(): void {
    const fakeFeature = {
        type: "Feature",
        properties: {
            name: "SelfCheckVille",
            osm_id: 12345
        }
    } as unknown as MapGeoJSONFeature;
    const identity = extractCityIdentity(fakeFeature);
    if (!identity?.osmId || identity.osmId !== "12345") {
        console.warn("[city-identity] Failed to normalize osm_id during self-check.");
    }
}

function readPlaceClass(feature: MapGeoJSONFeature): CityPlaceClass | null {
    const value = (feature.properties ?? {}).class;
    if (typeof value !== "string") {
        return null;
    }
    const normalized = value.toLowerCase();
    return PLACE_ALLOWED_CLASSES.includes(normalized as CityPlaceClass)
        ? (normalized as CityPlaceClass)
        : null;
}
