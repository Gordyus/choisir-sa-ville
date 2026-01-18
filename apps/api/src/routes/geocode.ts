import type { FastifyPluginAsync } from "fastify";
import { GeocodeRequestSchema } from "@csv/core";
import type { GeocodeService } from "../services/geocode.service.js";

export function geocodeRoute(service: GeocodeService): FastifyPluginAsync {
  return async (app) => {
    app.post("/api/geocode", async (req) => {
      const body = GeocodeRequestSchema.parse(req.body);
      return service.geocode(body);
    });
  };
}
