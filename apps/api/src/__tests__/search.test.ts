import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { registerErrorHandler } from "../errors/error-handler.js";
import { searchRoute } from "../routes/search.js";
import type { SearchService } from "../services/search.service.js";
import { SearchRequestSchema } from "@csv/core";
import type { z } from "zod";

type SearchRequest = z.infer<typeof SearchRequestSchema>;

test("POST /api/search returns items and meta", async () => {
  const app = Fastify();
  registerErrorHandler(app);

  let captured: SearchRequest | null = null;
  const service: SearchService = {
    searchZones: async (input) => {
      captured = input;
      return {
        items: [
          {
            zoneId: "75056",
            zoneName: "Paris",
            type: "city",
            centroid: { lat: 48.8566, lng: 2.3522 },
            attributes: { population: 2165423 },
            travel: null
          }
        ],
        total: 1
      };
    }
  };

  await app.register(searchRoute(service));

  const response = await app.inject({
    method: "POST",
    url: "/api/search",
    payload: {
      area: {
        bbox: {
          minLat: 48,
          minLon: 2,
          maxLat: 49,
          maxLon: 3
        }
      },
      limit: 5,
      offset: 10
    }
  });

  assert.equal(response.statusCode, 200);
  const payload = response.json() as {
    items: Array<{ zoneId: string }>;
    meta: { limit: number; offset: number; total: number };
  };
  assert.equal(payload.items.length, 1);
  assert.equal(payload.items[0]?.zoneId, "75056");
  assert.equal(payload.meta.limit, 5);
  assert.equal(payload.meta.offset, 10);
  assert.equal(payload.meta.total, 1);
  assert.equal(captured?.limit, 5);
  assert.equal(captured?.offset, 10);

  await app.close();
});

test("POST /api/search validates input", async () => {
  const app = Fastify();
  registerErrorHandler(app);

  const service: SearchService = {
    searchZones: async () => ({ items: [], total: 0 })
  };

  await app.register(searchRoute(service));

  const response = await app.inject({
    method: "POST",
    url: "/api/search",
    payload: {}
  });

  assert.equal(response.statusCode, 400);
  const payload = response.json() as {
    error: { code: string; message: string; details: { issues: Array<{ path: string[] }> } };
  };
  assert.equal(payload.error.code, "VALIDATION_ERROR");
  assert.ok(payload.error.details.issues.length > 0);

  await app.close();
});
