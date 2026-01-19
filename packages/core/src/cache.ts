import { toGeohash6 } from "./geohash.js";
import type { TravelMode } from "./travel.js";

export type CacheStore = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
};

export function buildTravelTimeCacheKey(params: {
  mode: TravelMode;
  zoneId: string;
  destLat: number;
  destLng: number;
  timeBucket?: string;
}): string {
  const timeBucket = normalizeTimeBucketForCache(params.timeBucket);
  const destGeohash6 = toGeohash6(params.destLat, params.destLng);
  return `tt:v1:${params.mode}:${params.zoneId}:${destGeohash6}:${timeBucket}`;
}

export function buildRouteCacheKey(params: {
  mode: TravelMode;
  originKey: string;
  destLat: number;
  destLng: number;
  timeBucket?: string;
}): string {
  const timeBucket = normalizeTimeBucketForCache(params.timeBucket);
  const destGeohash6 = toGeohash6(params.destLat, params.destLng);
  return `route:v1:${params.mode}:${params.originKey}:${destGeohash6}:${timeBucket}`;
}

export function normalizeTimeBucketForCache(timeBucket?: string): string {
  const trimmed = timeBucket?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "none";
}
