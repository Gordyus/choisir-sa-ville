import type { FastifyPluginAsync } from "fastify";
import { RouteQuerySchema } from "@csv/core";
import type { TravelRouteService } from "../services/travel-route.service.js";

export function travelRoute(service: TravelRouteService): FastifyPluginAsync {
  return async (app) => {
    app.get("/api/route", async (req) => {
      const query = RouteQuerySchema.parse(req.query);
      return service.getRoute(query);
    });
  };
}
