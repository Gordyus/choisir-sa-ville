import assert from "node:assert/strict";
import test from "node:test";
import type { CacheStore, GeocodeProvider } from "@csv/core";
import { createGeocodeService } from "../services/geocode.service.js";

class MemoryCacheStore implements CacheStore {
  private readonly store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string, _ttlSeconds: number): Promise<void> {
    this.store.set(key, value);
  }
}

test("geocode service returns cached value without calling provider", async () => {
  let calls = 0;
  const provider: GeocodeProvider = {
    geocode: async () => {
      calls += 1;
      return { candidates: [{ label: "Rouen", lat: 49.44, lng: 1.09 }] };
    }
  };

  const cache = new MemoryCacheStore();
  const service = createGeocodeService(cache, provider);

  const first = await service.geocode({ query: "Rouen" });
  const second = await service.geocode({ query: "Rouen" });

  assert.equal(calls, 1);
  assert.equal(first.candidates.length, 1);
  assert.equal(second.candidates.length, 1);
});
