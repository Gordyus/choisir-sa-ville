import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTravelTimeCacheKey,
  normalizeTimeBucketForCache,
  type CacheStore,
  type TravelMatrixOrigin,
  type TravelMatrixResult,
  type TravelMode,
  type TravelProvider
} from "@csv/core";
import { createTravelMatrixService } from "../services/travel-matrix.service.js";

class MemoryCacheStore implements CacheStore {
  private readonly store = new Map<
    string,
    {
      value: string;
      expiresAt: number;
    }
  >();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000
    });
  }
}

class CountingProvider implements TravelProvider {
  calls = 0;

  async matrixCar(
    origins: TravelMatrixOrigin[],
    _destination: { lat: number; lng: number }
  ): Promise<TravelMatrixResult[]> {
    this.calls += 1;
    return origins.map((origin, index) => ({
      zoneId: origin.zoneId,
      duration_s: 100 + index,
      distance_m: 1000 + index,
      status: "OK"
    }));
  }

  async matrixTransit(
    _origins: TravelMatrixOrigin[],
    _destination: { lat: number; lng: number },
    _arriveByIso: string
  ): Promise<TravelMatrixResult[]> {
    this.calls += 1;
    return [];
  }

  async routeCar(
    _origin: { lat: number; lng: number },
    _destination: { lat: number; lng: number }
  ): Promise<{ status: "ERROR" }> {
    return { status: "ERROR" };
  }

  async routeTransit(
    _origin: { lat: number; lng: number },
    _destination: { lat: number; lng: number },
    _arriveByIso: string
  ): Promise<{ status: "ERROR" }> {
    return { status: "ERROR" };
  }
}

function buildOrigins(count: number): TravelMatrixOrigin[] {
  return Array.from({ length: count }, (_value, index) => ({
    zoneId: `zone-${index + 1}`,
    lat: 48.8 + index * 0.001,
    lng: 2.3 + index * 0.001
  }));
}

test("travel matrix batches provider calls and preserves ordering", async () => {
  const cache = new MemoryCacheStore();
  const provider = new CountingProvider();
  const service = createTravelMatrixService(cache, provider);

  const origins = buildOrigins(60);
  const response = await service.getMatrix({
    mode: "car",
    destination: { lat: 48.9, lng: 2.4 },
    origins
  });

  assert.equal(response.results.length, 60);
  assert.equal(provider.calls, 3);
  assert.equal(response.results[0]?.zoneId, origins[0]?.zoneId);
  assert.equal(response.results[59]?.zoneId, origins[59]?.zoneId);
});

test("travel matrix uses cache for hits and calls provider only for misses", async () => {
  const cache = new MemoryCacheStore();
  const provider = new CountingProvider();
  const service = createTravelMatrixService(cache, provider);

  const destination = { lat: 48.9, lng: 2.4 };
  const origins = [
    { zoneId: "zone-1", lat: 48.8, lng: 2.3 },
    { zoneId: "zone-2", lat: 48.81, lng: 2.31 }
  ];

  const cacheKey = buildTravelTimeCacheKey({
    mode: "car",
    zoneId: origins[0].zoneId,
    destLat: destination.lat,
    destLng: destination.lng,
    timeBucket: normalizeTimeBucketForCache(undefined)
  });

  await cache.set(
    cacheKey,
    JSON.stringify({
      zoneId: origins[0].zoneId,
      duration_s: 123,
      distance_m: 456,
      status: "OK"
    }),
    3600
  );

  const response = await service.getMatrix({
    mode: "car",
    destination,
    origins
  });

  assert.equal(provider.calls, 1);
  assert.equal(response.results.length, 2);
  assert.equal(response.results[0]?.zoneId, "zone-1");
  assert.equal(response.results[0]?.duration_s, 123);
  assert.equal(response.results[1]?.zoneId, "zone-2");
});
