import type { ZodType, ZodTypeDef } from "zod";

export type AggregateId = string;

export type PeriodYearParam = number | "latest" | undefined;

export type ZoneAggregateBase = {
  zoneId: string;
  aggregateId: AggregateId;
  periodYear: number;
  coverage: number;
  source: string;
  sourceVersion: string;
  computedAt: Date;
};

export type ZoneAggregateResult<TPayload> = {
  base: ZoneAggregateBase;
  payload: TPayload;
};

export type ZoneAggregateDisplay = {
  label: string;
  unit?: string;
  category?: string;
};

export type ZoneGeoWeight = {
  geoCode: string;
  weight: number;
  geoLevel?: string;
};

export type GeoAggregateValue<TPayload> = {
  aggregateId: AggregateId;
  periodYear: number;
  geoLevel: string;
  geoCode: string;
  paramsHash: string;
  paramsFamilyHash: string;
  source?: string | null;
  sourceVersion?: string | null;
  payload: TPayload;
};

export type ZoneAggregateRecord<TPayload> = {
  zoneId: string;
  aggregateId: AggregateId;
  periodYear: number;
  paramsHash: string;
  coverage: number;
  source: string;
  sourceVersion: string;
  computedAt: Date;
  payload: TPayload;
};

export type ZoneAggregateLogger = {
  debug?: (message: string, details?: Record<string, unknown>) => void;
  info?: (message: string, details?: Record<string, unknown>) => void;
  warn?: (message: string, details?: Record<string, unknown>) => void;
  error?: (message: string, details?: Record<string, unknown>) => void;
};

export type ZoneAggregateGeoStore = {
  getValues: (input: {
    aggregateId: AggregateId;
    periodYear: number;
    geoLevel: string;
    geoCodes: string[];
    paramsHash: string;
  }) => Promise<Array<GeoAggregateValue<unknown>>>;
};

export type ZoneAggregateStore = {
  getAggregate: (input: {
    zoneId: string;
    aggregateId: AggregateId;
    periodYear: number;
    paramsHash: string;
  }) => Promise<ZoneAggregateRecord<unknown> | null>;
  upsertAggregate: (record: ZoneAggregateRecord<unknown>) => Promise<void>;
};

export type GeoAggregateStore = {
  getGeoValues: (input: {
    aggregateId: AggregateId;
    periodYear: number;
    geoLevel: string;
    geoCodes: string[];
    paramsHash: string;
  }) => Promise<Array<GeoAggregateValue<unknown>>>;
  getLatestPeriodYear: (input: {
    aggregateId: AggregateId;
    paramsFamilyHash: string;
  }) => Promise<number | null>;
  upsertGeoValuesBatch: (records: Array<GeoAggregateValue<unknown>>) => Promise<void>;
};

export type ZoneGeoMapStore = {
  getZoneGeoWeights: (input: { zoneId: string; geoLevel?: string }) => Promise<ZoneGeoWeight[]>;
  upsertZoneGeoWeightsBatch: (records: Array<{
    zoneId: string;
    geoLevel: string;
    geoCode: string;
    weight: number;
  }>) => Promise<void>;
};

export type ZoneAggregateComputeContext<TParams> = {
  zoneId: string;
  periodYear: number;
  params: TParams;
  paramsHash: string;
  zoneGeoWeights: ZoneGeoWeight[];
  geoStore: ZoneAggregateGeoStore;
  logger?: ZoneAggregateLogger;
};

export type ZoneAggregatePlugin<TParams, TPayload> = {
  id: AggregateId;
  version: number;
  display: ZoneAggregateDisplay;
  paramsSchema: ZodType<TParams, ZodTypeDef, unknown>;
  outputSchema: ZodType<TPayload, ZodTypeDef, unknown>;
  compute: (ctx: ZoneAggregateComputeContext<TParams>) => Promise<ZoneAggregateResult<TPayload>>;
};

export type ZoneAggregateBatchRequest = {
  aggregateId: AggregateId;
  params: Record<string, unknown>;
};

export type ZoneAggregateBatchResult = {
  aggregateId: AggregateId;
  params: Record<string, unknown>;
  result: ZoneAggregateResult<unknown>;
};

export type ZoneAggregateBatchError = {
  aggregateId: AggregateId;
  params: Record<string, unknown>;
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

export type ZoneAggregateBatchResponse = {
  results: ZoneAggregateBatchResult[];
  errors: ZoneAggregateBatchError[];
};
