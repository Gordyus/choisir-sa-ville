import { ZodError } from "zod";
import { getZoneAggregatePlugin } from "./registry.js";
import { hashAggregateParams, hashAggregateParamsFamily } from "./params-hash.js";
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
  PeriodYearParam,
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

    const normalized = normalizeAggregateQueryParams(params);
    if (normalized.invalidYear) {
      plugin.paramsSchema.parse({
        ...normalized.paramsWithoutYear,
        year: normalized.rawYearValue,
        periodYear: normalized.rawYearValue
      });
      throw new ZoneAggregateError("VALIDATION_ERROR", "Invalid year parameter.", {
        fields: ["year", "periodYear"]
      });
    }

    const parsedParams = plugin.paramsSchema.parse({
      ...normalized.paramsWithoutYear,
      year: DEFAULT_PLACEHOLDER_YEAR,
      periodYear: DEFAULT_PLACEHOLDER_YEAR
    }) as Record<string, unknown>;
    const paramsFamilyHash = await hashAggregateParamsFamily(parsedParams);
    const periodYear = await resolvePeriodYearOrLatest(
      this.geoAggregateStore,
      aggregateId,
      paramsFamilyHash,
      normalized.requestedPeriodYear
    );
    const resolvedParams = plugin.paramsSchema.parse({
      ...parsedParams,
      year: periodYear,
      periodYear
    }) as Record<string, unknown>;
    const paramsHash = await hashAggregateParams(resolvedParams);

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
      params: resolvedParams,
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

const DEFAULT_PLACEHOLDER_YEAR = 2000;

type NormalizedParams = {
  paramsWithoutYear: Record<string, unknown>;
  requestedPeriodYear?: PeriodYearParam;
  rawYearValue?: unknown;
  invalidYear: boolean;
};

function normalizeAggregateQueryParams(input: Record<string, unknown>): NormalizedParams {
  const paramsWithoutYear = { ...input };
  delete paramsWithoutYear.year;
  delete paramsWithoutYear.periodYear;

  const rawYearValue = input.periodYear ?? input.year;
  const { value, invalid } = parsePeriodYearToken(rawYearValue);

  return {
    paramsWithoutYear,
    requestedPeriodYear: value,
    rawYearValue,
    invalidYear: invalid
  };
}

function parsePeriodYearToken(
  value: unknown
): { value?: PeriodYearParam; invalid: boolean } {
  if (value === undefined || value === null) {
    return { value: undefined, invalid: false };
  }

  if (typeof value === "number") {
    return Number.isFinite(value)
      ? { value, invalid: false }
      : { value: undefined, invalid: true };
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return { value: undefined, invalid: false };
    if (trimmed.toLowerCase() === "latest") return { value: "latest", invalid: false };
    if (/^\d+$/.test(trimmed)) {
      return { value: Number.parseInt(trimmed, 10), invalid: false };
    }
    return { value: undefined, invalid: true };
  }

  return { value: undefined, invalid: true };
}

async function resolvePeriodYearOrLatest(
  geoAggregateStore: GeoAggregateStore,
  aggregateId: AggregateId,
  paramsFamilyHash: string,
  requestedPeriodYear: PeriodYearParam
): Promise<number> {
  if (typeof requestedPeriodYear === "number") {
    return requestedPeriodYear;
  }

  const latest = await geoAggregateStore.getLatestPeriodYear({
    aggregateId,
    paramsFamilyHash
  });

  if (!latest) {
    throw noData("No aggregate data available.", { aggregateId, paramsFamilyHash });
  }

  return latest;
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
