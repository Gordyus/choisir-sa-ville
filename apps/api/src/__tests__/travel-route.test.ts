import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { RouteQuerySchema } from "@csv/core";
import type { z } from "zod";
import { registerErrorHandler } from "../errors/error-handler.js";
import { travelRoute } from "../routes/travel-route.js";
import type { TravelRouteService } from "../services/travel-route.service.js";

type RouteQuery = z.infer<typeof RouteQuerySchema>;

test("GET /api/route returns route details", async () => {
  const app = Fastify();
  registerErrorHandler(app);

  let captured: RouteQuery | null = null;
  const service: TravelRouteService = {
    getRoute: async (input) => {
      captured = input;
      return {
        zoneId: input.zoneId ?? null,
        origin: { lat: 48.8566, lng: 2.3522, label: "Paris" },
        destination: { lat: 48.9, lng: 2.4, label: "Office" },
        mode: "car",
        timeBucket: "none",
        duration_s: 1200,
        distance_m: 8000,
        status: "OK",
        geometry: {
          type: "LineString",
          coordinates: [
            [2.3522, 48.8566],
            [2.4, 48.9]
          ]
        }
      };
    }
  };

  await app.register(travelRoute(service));

  const response = await app.inject({
    method: "GET",
    url: "/api/route?mode=car&zoneId=75056&dest=48.9,2.4"
  });

  assert.equal(response.statusCode, 200);
  const payload = response.json() as { zoneId: string; status: string };
  assert.equal(payload.zoneId, "75056");
  assert.equal(payload.status, "OK");
  assert.equal(captured?.zoneId, "75056");

  await app.close();
});

test("GET /api/route validates input", async () => {
  const app = Fastify();
  registerErrorHandler(app);

  const service: TravelRouteService = {
    getRoute: async () => {
      return {
        zoneId: null,
        origin: { lat: 0, lng: 0 },
        destination: { lat: 0, lng: 0 },
        mode: "car",
        timeBucket: "none",
        status: "ERROR"
      };
    }
  };

  await app.register(travelRoute(service));

  const response = await app.inject({
    method: "GET",
    url: "/api/route?mode=car"
  });

  assert.equal(response.statusCode, 400);
  const payload = response.json() as {
    error: { code: string; details: { issues: Array<{ path: string[] }> } };
  };
  assert.equal(payload.error.code, "VALIDATION_ERROR");
  assert.ok(payload.error.details.issues.length > 0);

  await app.close();
});
