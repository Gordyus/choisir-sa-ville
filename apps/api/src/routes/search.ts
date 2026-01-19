import type { FastifyPluginAsync } from "fastify";
import { SearchRequestSchema } from "@csv/core";
import type { SearchService } from "../services/search.service.js";

export function searchRoute(service: SearchService): FastifyPluginAsync {
  return async (app) => {
    app.post("/api/search", async (req) => {
      const body = SearchRequestSchema.parse(req.body);
      const result = await service.searchZones(body);

      return {
        items: result.items,
        meta: {
          limit: body.limit,
          offset: body.offset,
          total: result.total
        }
      };
    });
  };
}
