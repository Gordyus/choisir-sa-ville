import type {
    ExpressionSpecification,
    LegacyFilterSpecification,
    MapGeoJSONFeature,
    StyleSpecification
} from "maplibre-gl";

export type CityResolutionMethod = "feature" | "polygon" | "osm" | "wikidata" | "fallback";

export type CityPlaceClass = string;

export const BASE_COMMUNE_LABEL_LAYER_IDS = ["place_label_other", "place_label_city"] as const;
export const MANAGED_CITY_LABEL_LAYER_PREFIX = "custom-city-label::";
export const MANAGED_CITY_LABEL_METADATA_FLAG = "csv:managedCityLabel";
export const MANAGED_CITY_LABEL_METADATA_BASE_ID = "csv:managedCityBaseLayerId";

export function buildManagedCityLabelLayerId(layerId: string): string {
    return `${MANAGED_CITY_LABEL_LAYER_PREFIX}${layerId}`;
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
    rank?: number | null;
    capitalType?: string | null;
    propertiesSnapshot?: Record<string, unknown> | null;
};

export const COMMUNE_LABEL_LAYERS: string[] = [
    ...BASE_COMMUNE_LABEL_LAYER_IDS.map((layerId) => buildManagedCityLabelLayerId(layerId)),
    ...BASE_COMMUNE_LABEL_LAYER_IDS
];

const DEFAULT_PLACE_CLASSES = ["city", "town", "village"] as const;
let placeClassList: string[] = [...DEFAULT_PLACE_CLASSES];
let placeClassSet = new Set(placeClassList.map((value) => value.toLowerCase()));

export function setPlaceClassList(classes: readonly string[] | undefined): void {
    if (!classes || !classes.length) {
        placeClassList = [...DEFAULT_PLACE_CLASSES];
        placeClassSet = new Set(placeClassList.map((value) => value.toLowerCase()));
        return;
    }
    const normalized = classes
        .map((value) => (typeof value === "string" ? value.trim().toLowerCase() : ""))
        .filter((value) => value.length > 0);
    placeClassList = normalized.length ? Array.from(new Set(normalized)) : [...DEFAULT_PLACE_CLASSES];
    placeClassSet = new Set(placeClassList);
}

export function getPlaceClassList(): readonly string[] {
    return placeClassList;
}

export function buildPlaceClassFilter(): LegacyFilterSpecification {
    return ["in", "class", ...placeClassList] as LegacyFilterSpecification;
}

export function buildPlaceClassExcludeFilter(): LegacyFilterSpecification {
    return ["!in", "class", ...placeClassList] as LegacyFilterSpecification;
}

function normalizePlaceClassValue(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim().toLowerCase();
    return trimmed.length ? trimmed : null;
}

export const COMMUNE_POLYGON_SOURCE_ID = "communes";
export const COMMUNE_POLYGON_SOURCE_LAYER = "communes";
export const COMMUNE_FILL_LAYER_ID = "communes-fill";
export const COMMUNE_LINE_LAYER_ID = "communes-line";

export const ARR_MUNICIPAL_SOURCE_ID = "arr_municipal";
export const ARR_MUNICIPAL_SOURCE_LAYER = "arr_municipal";
export const ARR_MUNICIPAL_FILL_LAYER_ID = "arr-municipal-fill";
export const ARR_MUNICIPAL_LINE_LAYER_ID = "arr-municipal-line";

export const ADMIN_POLYGON_LAYER_SPECS = {
    communes: {
        sourceId: COMMUNE_POLYGON_SOURCE_ID,
        sourceLayer: COMMUNE_POLYGON_SOURCE_LAYER,
        fillLayerId: COMMUNE_FILL_LAYER_ID,
        lineLayerId: COMMUNE_LINE_LAYER_ID
    },
    arrMunicipal: {
        sourceId: ARR_MUNICIPAL_SOURCE_ID,
        sourceLayer: ARR_MUNICIPAL_SOURCE_LAYER,
        fillLayerId: ARR_MUNICIPAL_FILL_LAYER_ID,
        lineLayerId: ARR_MUNICIPAL_LINE_LAYER_ID
    }
} as const;


export const CITY_ID_FIELD = "insee";
export const CITY_ID_FALLBACK_FIELDS = ["osm_id", "osmId", "wikidata", "code", "id", "name:fr", "name"];
const CITY_NAME_FIELDS = ["name:fr", "name", "name:en"];
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
    const rawValue = normalizePlaceClassValue((feature.properties ?? {}).class);
    if (!rawValue) {
        return null;
    }
    return placeClassSet.has(rawValue) ? rawValue : null;
}

function readCityRank(feature: MapGeoJSONFeature): number | null {
    return pickFirstNumber(feature, CITY_RANK_FIELDS);
}

function readCapitalType(feature: MapGeoJSONFeature): string | null {
    const value = pickFirstString(feature, CITY_CAPITAL_FIELDS);
    return value ?? null;
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
