import { toGeohash6 } from "./geohash.js";
import type { CacheStore } from "./cache.js";
import type { GeocodeRequest, GeocodeResponse } from "./geocode.js";
import { hashBbox, normalizeQuery } from "./geocode.js";

export const GEOCODE_TTL_SECONDS = 60 * 60 * 24 * 90;
const DEFAULT_LIMIT = 5;

export function buildGeocodeCacheKey(request: GeocodeRequest): string {
  const normalizedQuery = normalizeQuery(request.query).toLowerCase();
  const nearKey = request.near
    ? toGeohash6(request.near.lat, request.near.lng)
    : "none";
  const bboxKey = request.bbox ? hashBbox(request.bbox) : "none";
  const limit = request.limit ?? DEFAULT_LIMIT;
  return `geocode:v1:${normalizedQuery}:${nearKey}:${bboxKey}:${limit}`;
}

export async function getCachedGeocode(
  cache: CacheStore,
  request: GeocodeRequest
): Promise<GeocodeResponse | null> {
  const key = buildGeocodeCacheKey(request);
  const cached = await cache.get(key);
  if (!cached) return null;
  try {
    const parsed = JSON.parse(cached) as GeocodeResponse;
    if (!parsed || !Array.isArray(parsed.candidates)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function setCachedGeocode(
  cache: CacheStore,
  request: GeocodeRequest,
  response: GeocodeResponse
): Promise<void> {
  const key = buildGeocodeCacheKey(request);
  await cache.set(key, JSON.stringify(response), GEOCODE_TTL_SECONDS);
}
