import type { FastifyPluginAsync } from "fastify";
import { AreaSuggestQuery } from "@csv/core";
import type { AreaSuggestService } from "../services/area-suggest.service.js";

export function areaSuggestRoute(service: AreaSuggestService): FastifyPluginAsync {
  return async (app) => {
    app.get("/api/areas/suggest", async (req) => {
      const query = AreaSuggestQuery.parse(req.query);
      return service.suggest({ query: query.q, limit: query.limit });
    });
  };
}
