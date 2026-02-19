/**
 * BAN Geocoding Client
 *
 * Client for the French national address database (Base Adresse Nationale).
 * https://api-adresse.data.gouv.fr/search/
 */

import type { BanSuggestion } from "@/lib/search/types";

const BAN_SEARCH_URL = "https://api-adresse.data.gouv.fr/search/";
const MAX_RESULTS = 5;

interface BanFeature {
    type: "Feature";
    geometry: {
        type: "Point";
        coordinates: [number, number]; // [lng, lat]
    };
    properties: {
        label: string;
        type: string;
        city: string;
        postcode: string;
    };
}

interface BanResponse {
    type: "FeatureCollection";
    features: BanFeature[];
}

type GeoBias = { lat: number; lng: number };

/**
 * Search for an address using the BAN API.
 * Returns up to 5 suggestions mapped to BanSuggestion type.
 * Returns an empty array on error.
 *
 * When geoBias is provided, results are biased towards that location
 * using the BAN API's native lat/lon proximity parameters.
 */
export async function searchAddress(
    query: string,
    signal?: AbortSignal,
    geoBias?: GeoBias
): Promise<BanSuggestion[]> {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
        return [];
    }

    try {
        const url = new URL(BAN_SEARCH_URL);
        url.searchParams.set("q", trimmed);
        url.searchParams.set("limit", String(MAX_RESULTS));
        if (geoBias !== undefined) {
            url.searchParams.set("lat", String(geoBias.lat));
            url.searchParams.set("lon", String(geoBias.lng));
        }

        const init: RequestInit = {};
        if (signal !== undefined) {
            init.signal = signal;
        }

        const response = await fetch(url.toString(), init);
        if (!response.ok) {
            return [];
        }

        const data = (await response.json()) as BanResponse;

        return data.features.map((feature): BanSuggestion => ({
            label: feature.properties.label,
            lat: feature.geometry.coordinates[1],
            lng: feature.geometry.coordinates[0],
            type: feature.properties.type,
            city: feature.properties.city,
            postcode: feature.properties.postcode,
        }));
    } catch {
        return [];
    }
}
