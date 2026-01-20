import { ZodError } from "zod";
import { getZoneAggregatePlugin } from "./registry.js";
import { hashAggregateParams } from "./params-hash.js";
import { noData, unknownAggregate, ZoneAggregateError } from "./errors.js";
import type {
  AggregateId,
  GeoAggregateStore,
  ZoneAggregateBatchError,
  ZoneAggregateBatchRequest,
  ZoneAggregateBatchResponse,
  ZoneAggregateBatchResult,
  ZoneAggregateLogger,
  ZoneAggregateRecord,
  ZoneAggregateResult,
  ZoneAggregateStore,
  ZoneGeoMapStore
} from "./types.js";

export type ZoneAggregatesServiceDeps = {
  aggregateStore: ZoneAggregateStore;
  geoAggregateStore: GeoAggregateStore;
  zoneGeoMapStore: ZoneGeoMapStore;
  logger?: ZoneAggregateLogger;
};

export class ZoneAggregatesService {
  private readonly aggregateStore: ZoneAggregateStore;
  private readonly geoAggregateStore: GeoAggregateStore;
  private readonly zoneGeoMapStore: ZoneGeoMapStore;
  private readonly logger?: ZoneAggregateLogger;

  constructor(deps: ZoneAggregatesServiceDeps) {
    this.aggregateStore = deps.aggregateStore;
    this.geoAggregateStore = deps.geoAggregateStore;
    this.zoneGeoMapStore = deps.zoneGeoMapStore;
    this.logger = deps.logger;
  }

  async getAggregate(
    zoneId: string,
    aggregateId: AggregateId,
    params: Record<string, unknown>
  ): Promise<ZoneAggregateResult<unknown>> {
    const plugin = getZoneAggregatePlugin(aggregateId);
    if (!plugin) {
      throw unknownAggregate(aggregateId);
    }

    const parsedParams = plugin.paramsSchema.parse(params) as Record<string, unknown>;
    const periodYear = resolvePeriodYear(parsedParams);
    const paramsHash = await hashAggregateParams(parsedParams);

    const cached = await this.aggregateStore.getAggregate({
      zoneId,
      aggregateId,
      periodYear,
      paramsHash
    });

    if (cached) {
      const parsedPayload = plugin.outputSchema.safeParse(cached.payload);
      if (parsedPayload.success) {
        return {
          base: {
            zoneId: cached.zoneId,
            aggregateId: cached.aggregateId,
            periodYear: cached.periodYear,
            coverage: cached.coverage,
            source: cached.source,
            sourceVersion: cached.sourceVersion,
            computedAt: cached.computedAt
          },
          payload: parsedPayload.data
        };
      }
      this.logger?.warn?.("Aggregate payload failed validation, recomputing.", {
        aggregateId,
        zoneId
      });
    }

    const zoneGeoWeights = await this.zoneGeoMapStore.getZoneGeoWeights({ zoneId });
    if (zoneGeoWeights.length === 0) {
      throw noData("No geo weights found for zone.", { zoneId, aggregateId });
    }

    const result = await plugin.compute({
      zoneId,
      periodYear,
      params: parsedParams,
      paramsHash,
      zoneGeoWeights,
      geoStore: {
        getValues: (input) => this.geoAggregateStore.getGeoValues(input)
      },
      logger: this.logger
    });

    const payload = plugin.outputSchema.parse(result.payload);
    if (result.base.coverage <= 0) {
      throw noData("Aggregate coverage is zero.", {
        zoneId,
        aggregateId,
        periodYear
      });
    }

    const base = {
      zoneId,
      aggregateId,
      periodYear,
      coverage: result.base.coverage,
      source: result.base.source,
      sourceVersion: result.base.sourceVersion,
      computedAt: result.base.computedAt
    };

    const record: ZoneAggregateRecord<unknown> = {
      ...base,
      paramsHash,
      payload
    };

    await this.aggregateStore.upsertAggregate(record);

    return {
      base,
      payload
    };
  }

  async getMany(
    zoneId: string,
    requests: ZoneAggregateBatchRequest[]
  ): Promise<ZoneAggregateBatchResponse> {
    const results: ZoneAggregateBatchResult[] = [];
    const errors: ZoneAggregateBatchError[] = [];

    for (const request of requests) {
      try {
        const result = await this.getAggregate(zoneId, request.aggregateId, request.params);
        results.push({
          aggregateId: request.aggregateId,
          params: request.params,
          result
        });
      } catch (error) {
        errors.push(mapError(request, error));
      }
    }

    return { results, errors };
  }
}

function resolvePeriodYear(params: Record<string, unknown>): number {
  const year = params["year"];
  if (typeof year === "number" && Number.isFinite(year)) {
    return year;
  }
  const periodYear = params["periodYear"];
  if (typeof periodYear === "number" && Number.isFinite(periodYear)) {
    return periodYear;
  }
  throw new ZoneAggregateError("VALIDATION_ERROR", "Missing year parameter.", {
    fields: ["year", "periodYear"]
  });
}

function mapError(
  request: ZoneAggregateBatchRequest,
  error: unknown
): ZoneAggregateBatchError {
  if (error instanceof ZoneAggregateError) {
    return {
      aggregateId: request.aggregateId,
      params: request.params,
      code: error.code,
      message: error.message,
      details: error.details
    };
  }

  if (error instanceof ZodError) {
    return {
      aggregateId: request.aggregateId,
      params: request.params,
      code: "VALIDATION_ERROR",
      message: "Invalid request parameters.",
      details: { issues: error.issues }
    };
  }

  return {
    aggregateId: request.aggregateId,
    params: request.params,
    code: "INTERNAL_ERROR",
    message: "Unexpected aggregate error."
  };
}
