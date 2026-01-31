import type { ExpressionSpecification, MapGeoJSONFeature, StyleSpecification } from "maplibre-gl";

export type CityIdentity = {
    id: string;
    name: string;
};

export const CITY_LABEL_LAYERS: string[] = [
    // OpenMapTiles / MapLibre default style IDs (underscores)
    "place_label_city",
    "place_label_capital",
    "place_label_major",
    "place_label_town",
    // Some styles use hyphens
    "place-label-city",
    "place-label-capital",
    "place-label-major",
    "place-label-town"
];

export const CITY_ID_FIELD = "insee";
export const CITY_ID_FALLBACK_FIELDS = ["code", "id", "name:fr", "name"];
const CITY_NAME_FIELDS = ["name:fr", "name", "name:en"];
const CITY_ID_SENTINEL = "__none__";

export const CITY_ID_EXPRESSION: ExpressionSpecification = [
    "coalesce",
    ["get", CITY_ID_FIELD],
    ...CITY_ID_FALLBACK_FIELDS.map((field) => ["get", field])
] as unknown as ExpressionSpecification;

let hasLoggedSymbolHints = false;

export function createCityIdMatchExpression(cityId: string | null): ExpressionSpecification {
    return ["==", CITY_ID_EXPRESSION, cityId ?? CITY_ID_SENTINEL];
}

export function extractCityIdentity(feature: MapGeoJSONFeature): CityIdentity | null {
    const id = pickFirstString(feature, [CITY_ID_FIELD, ...CITY_ID_FALLBACK_FIELDS]);
    if (!id) {
        return null;
    }
    const name = pickFirstString(feature, CITY_NAME_FIELDS) ?? id;
    return { id, name };
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
