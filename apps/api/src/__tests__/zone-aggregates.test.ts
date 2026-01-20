import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import type { ZoneAggregatesService } from "@csv/core";
import { registerErrorHandler } from "../errors/error-handler.js";
import { zoneAggregatesRoute } from "../routes/zone-aggregates.js";

const base = {
  zoneId: "75056",
  aggregateId: "rent.v1",
  periodYear: 2023,
  coverage: 1,
  source: "fixture.rent",
  sourceVersion: "2023-01",
  computedAt: new Date("2026-01-20T10:00:00Z")
};

const payload = {
  rentMedianPerM2: 32.1,
  rentP25PerM2: 24.5,
  rentP75PerM2: 42.0
};

test("GET /api/zones/:zoneId/aggregates/:aggregateId returns aggregate", async () => {
  const app = Fastify();
  registerErrorHandler(app);

  let captured: { zoneId: string; aggregateId: string; params: Record<string, unknown> } | null = null;

  const service = {
    getAggregate: async (zoneId: string, aggregateId: string, params: Record<string, unknown>) => {
      captured = { zoneId, aggregateId, params };
      return { base, payload };
    },
    getMany: async () => ({ results: [], errors: [] })
  } as unknown as ZoneAggregatesService;

  await app.register(zoneAggregatesRoute(service));

  const response = await app.inject({
    method: "GET",
    url: "/api/zones/75056/aggregates/rent.v1?year=2023&segmentKey=ALL_ALL"
  });

  assert.equal(response.statusCode, 200);
  const body = response.json() as { base: typeof base; payload: typeof payload };
  assert.equal(body.base.aggregateId, "rent.v1");
  assert.equal(body.payload.rentMedianPerM2, 32.1);
  assert.equal(captured?.zoneId, "75056");
  assert.equal(captured?.aggregateId, "rent.v1");
  assert.equal(captured?.params.year, "2023");

  await app.close();
});

test("POST /api/zones/:zoneId/aggregates:batch returns results and errors", async () => {
  const app = Fastify();
  registerErrorHandler(app);

  const service = {
    getAggregate: async () => ({ base, payload }),
    getMany: async () => ({
      results: [{ aggregateId: "rent.v1", params: { year: 2023 }, result: { base, payload } }],
      errors: [{ aggregateId: "missing.v1", params: { year: 2023 }, code: "UNKNOWN_AGGREGATE", message: "Missing" }]
    })
  } as unknown as ZoneAggregatesService;

  await app.register(zoneAggregatesRoute(service));

  const response = await app.inject({
    method: "POST",
    url: "/api/zones/75056/aggregates:batch",
    payload: {
      requests: [
        { aggregateId: "rent.v1", params: { year: 2023 } },
        { aggregateId: "missing.v1", params: { year: 2023 } }
      ]
    }
  });

  assert.equal(response.statusCode, 200);
  const body = response.json() as {
    results: Array<{ aggregateId: string }>;
    errors: Array<{ aggregateId: string; code: string }>;
  };
  assert.equal(body.results.length, 1);
  assert.equal(body.errors.length, 1);
  assert.equal(body.errors[0]?.code, "UNKNOWN_AGGREGATE");

  await app.close();
});
