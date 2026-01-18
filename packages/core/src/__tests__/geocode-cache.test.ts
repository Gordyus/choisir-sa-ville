import assert from "node:assert/strict";
import test from "node:test";
import type { CacheStore } from "../cache.js";
import { toGeohash6 } from "../geohash.js";
import type { GeocodeRequest } from "../geocode.js";
import { hashBbox } from "../geocode.js";
import {
  buildGeocodeCacheKey,
  GEOCODE_TTL_SECONDS,
  getCachedGeocode,
  setCachedGeocode
} from "../geocode-cache.js";

class MemoryCacheStore implements CacheStore {
  readonly entries = new Map<string, { value: string; ttl: number }>();

  async get(key: string): Promise<string | null> {
    return this.entries.get(key)?.value ?? null;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.entries.set(key, { value, ttl: ttlSeconds });
  }
}

test("buildGeocodeCacheKey normalizes query and hashes near/bbox", () => {
  const bbox = { minLon: 2, minLat: 48, maxLon: 3, maxLat: 49 };
  const request: GeocodeRequest = {
    query: "  Rue   de  Paris ",
    near: { lat: 48.8566, lng: 2.3522 },
    bbox,
    limit: 7
  };

  const key = buildGeocodeCacheKey(request);
  const expected = [
    "geocode:v1",
    "rue de paris",
    toGeohash6(48.8566, 2.3522),
    hashBbox(bbox),
    "7"
  ].join(":");

  assert.equal(key, expected);
});

test("setCachedGeocode uses the default TTL", async () => {
  const cache = new MemoryCacheStore();
  const request: GeocodeRequest = { query: "Rouen" };

  await setCachedGeocode(cache, request, {
    candidates: [{ label: "Rouen", lat: 49.4431, lng: 1.0993 }]
  });

  const entry = cache.entries.values().next().value as { ttl: number };
  assert.equal(entry.ttl, GEOCODE_TTL_SECONDS);
});

test("getCachedGeocode parses cached JSON response", async () => {
  const cache = new MemoryCacheStore();
  const request: GeocodeRequest = { query: "Rouen" };
  const value = {
    candidates: [{ label: "Rouen", lat: 49.4431, lng: 1.0993 }]
  };

  await cache.set(buildGeocodeCacheKey(request), JSON.stringify(value), 123);

  const cached = await getCachedGeocode(cache, request);
  assert.deepEqual(cached, value);
});
