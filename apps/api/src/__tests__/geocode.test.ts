import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { GeocodeRequestSchema, type GeocodeResponse } from "@csv/core";
import type { z } from "zod";
import { registerErrorHandler } from "../errors/error-handler.js";
import { geocodeRoute } from "../routes/geocode.js";
import type { GeocodeService } from "../services/geocode.service.js";

type GeocodeRequest = z.infer<typeof GeocodeRequestSchema>;

test("POST /api/geocode returns candidates", async () => {
  const app = Fastify();
  registerErrorHandler(app);

  let captured: GeocodeRequest | null = null;
  const service: GeocodeService = {
    geocode: async (input) => {
      captured = input;
      const response: GeocodeResponse = {
        candidates: [{ label: "Rouen, France", lat: 49.4431, lng: 1.0993 }]
      };
      return { response, cacheHit: false };
    }
  };

  await app.register(geocodeRoute(service));

  const response = await app.inject({
    method: "POST",
    url: "/api/geocode",
    payload: { query: "Rouen", limit: 3 }
  });

  assert.equal(response.statusCode, 200);
  const payload = response.json() as GeocodeResponse;
  assert.equal(payload.candidates.length, 1);
  assert.equal(payload.candidates[0]?.label, "Rouen, France");
  assert.equal(captured?.query, "Rouen");

  await app.close();
});

test("POST /api/geocode validates input", async () => {
  const app = Fastify();
  registerErrorHandler(app);

  const service: GeocodeService = {
    geocode: async () => ({ response: { candidates: [] }, cacheHit: false })
  };

  await app.register(geocodeRoute(service));

  const response = await app.inject({
    method: "POST",
    url: "/api/geocode",
    payload: { query: "" }
  });

  assert.equal(response.statusCode, 400);
  const payload = response.json() as {
    error: { code: string; details: { issues: Array<{ path: string[] }> } };
  };
  assert.equal(payload.error.code, "VALIDATION_ERROR");
  assert.ok(payload.error.details.issues.length > 0);

  await app.close();
});
