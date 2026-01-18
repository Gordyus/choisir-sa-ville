import type { FastifyPluginAsync } from "fastify";
import { GeocodeRequestSchema } from "@csv/core";
import type { GeocodeService } from "../services/geocode.service.js";

export function geocodeRoute(service: GeocodeService): FastifyPluginAsync {
  return async (app) => {
    app.post("/api/geocode", async (req) => {
      const body = GeocodeRequestSchema.parse(req.body);
      const startedAt = Date.now();
      const { response, cacheHit } = await service.geocode(body);
      app.log.info(
        {
          reqId: req.id,
          cacheHit,
          latencyMs: Date.now() - startedAt,
          candidatesCount: response.candidates.length,
          hasNear: Boolean(body.near),
          hasBbox: Boolean(body.bbox),
          queryLength: body.query.length
        },
        "Geocode request"
      );
      return response;
    });
  };
}
