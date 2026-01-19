import type { FastifyPluginAsync } from "fastify";
import { TravelMatrixRequestSchema } from "@csv/core";
import type { TravelMatrixService } from "../services/travel-matrix.service.js";

export function travelMatrixRoute(service: TravelMatrixService): FastifyPluginAsync {
  return async (app) => {
    app.post("/api/travel/matrix", async (req) => {
      const body = TravelMatrixRequestSchema.parse(req.body);
      const result = await service.getMatrix(body);
      return result;
    });
  };
}
