import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { ZoneAggregatesService } from "@csv/core";
import { ZoneAggregateError } from "@csv/core";
import { domainError } from "../errors/domain-error.js";

const ParamsSchema = z.object({
  zoneId: z.string().min(1),
  aggregateId: z.string().min(1)
});

const BatchBodySchema = z.object({
  requests: z
    .array(
      z.object({
        aggregateId: z.string().min(1),
        params: z.record(z.unknown()).default({})
      })
    )
    .min(1)
});

export function zoneAggregatesRoute(service: ZoneAggregatesService): FastifyPluginAsync {
  return async (app) => {
    app.get("/api/zones/:zoneId/aggregates/:aggregateId", async (req) => {
      const params = ParamsSchema.parse(req.params);
      const query = (req.query ?? {}) as Record<string, unknown>;

      try {
        return await service.getAggregate(params.zoneId, params.aggregateId, query);
      } catch (error) {
        throw mapAggregateError(error);
      }
    });

    app.post("/api/zones/:zoneId/aggregates:batch", async (req) => {
      const params = ParamsSchema.pick({ zoneId: true }).parse(req.params);
      const body = BatchBodySchema.parse(req.body);

      const response = await service.getMany(params.zoneId, body.requests);
      return response;
    });
  };
}

function mapAggregateError(error: unknown): unknown {
  if (error instanceof ZoneAggregateError) {
    const httpStatus = error.code === "UNKNOWN_AGGREGATE" ? 404 : 422;
    return domainError(error.code, error.message, error.details, httpStatus);
  }

  return error;
}
