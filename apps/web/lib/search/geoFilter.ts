/**
 * Geographic Pre-Filter
 *
 * Filters communes by bounding box around a destination,
 * then applies security and living preference filters.
 */

import type { CommuneIndexLiteEntry } from "@/lib/data/communesIndexLite";
import type { InsecurityMetricsRow } from "@/lib/data/insecurityMetrics";
import type { Destination, LivingPreference } from "@/lib/search/types";

const KM_PER_DEGREE_LAT = 111;
const DEG_TO_RAD = Math.PI / 180;

const URBAN_MIN_POPULATION = 50_000;
const RURAL_MAX_POPULATION = 10_000;

interface FilterParams {
    communes: Map<string, CommuneIndexLiteEntry>;
    destination: Destination;
    radiusKm: number;
    minSecurityLevel: number | null;
    livingPreference: LivingPreference;
    insecurityData: Map<string, InsecurityMetricsRow> | null;
}

/**
 * Pre-filter communes by geographic bounding box, security, and living preference.
 *
 * Bounding box radius: radiusKm param (caller-supplied).
 * Uses Haversine approximation for degree-to-km conversion.
 */
export function filterCommunesByGeo(params: FilterParams): CommuneIndexLiteEntry[] {
    const {
        communes,
        destination,
        radiusKm,
        minSecurityLevel,
        livingPreference,
        insecurityData,
    } = params;
    const deltaLat = radiusKm / KM_PER_DEGREE_LAT;
    const kmPerDegreeLng = KM_PER_DEGREE_LAT * Math.cos(destination.lat * DEG_TO_RAD);
    const deltaLng = kmPerDegreeLng > 0 ? radiusKm / kmPerDegreeLng : 360;

    const minLat = destination.lat - deltaLat;
    const maxLat = destination.lat + deltaLat;
    const minLng = destination.lng - deltaLng;
    const maxLng = destination.lng + deltaLng;

    const results: CommuneIndexLiteEntry[] = [];

    for (const commune of communes.values()) {
        // Bounding box filter (CommuneIndexLiteEntry uses `lon` for longitude)
        if (commune.lat < minLat || commune.lat > maxLat) {
            continue;
        }
        if (commune.lon < minLng || commune.lon > maxLng) {
            continue;
        }

        // Security filter
        if (minSecurityLevel !== null && insecurityData !== null) {
            const metrics = insecurityData.get(commune.inseeCode);
            if (metrics !== undefined && metrics.levelCategory > minSecurityLevel) {
                continue;
            }
        }

        // Living preference filter
        if (livingPreference !== "any" && commune.population !== null) {
            if (livingPreference === "urban" && commune.population < URBAN_MIN_POPULATION) {
                continue;
            }
            if (livingPreference === "rural" && commune.population > RURAL_MAX_POPULATION) {
                continue;
            }
        }

        results.push(commune);
    }

    return results;
}
