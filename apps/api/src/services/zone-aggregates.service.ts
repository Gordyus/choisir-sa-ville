import type { ZoneAggregateLogger, ZoneAggregateRecord, ZoneGeoMapStore, GeoAggregateStore, ZoneAggregateStore } from "@csv/core";
import { ZoneAggregatesService } from "@csv/core";
import type { Db } from "@csv/db";
import {
  getGeoAggregateValues,
  getLatestGeoAggregatePeriodYear,
  getZoneAggregate,
  getZoneGeoWeights,
  upsertGeoAggregateValuesBatch,
  upsertZoneAggregate,
  upsertZoneGeoWeightsBatch
} from "@csv/db";

export function createZoneAggregatesService(db: Db, logger?: ZoneAggregateLogger): ZoneAggregatesService {
  const aggregateStore: ZoneAggregateStore = {
    getAggregate: async (input) => {
      const row = await getZoneAggregate(db, input);
      if (!row) return null;
      return {
        zoneId: row.zoneId,
        aggregateId: row.aggregateId,
        periodYear: row.periodYear,
        paramsHash: row.paramsHash,
        coverage: row.coverage,
        source: row.source,
        sourceVersion: row.sourceVersion,
        computedAt: row.computedAt,
        payload: row.payloadJson
      } as ZoneAggregateRecord<unknown>;
    },
    upsertAggregate: async (record) => {
      await upsertZoneAggregate(db, {
        zoneId: record.zoneId,
        aggregateId: record.aggregateId,
        periodYear: record.periodYear,
        paramsHash: record.paramsHash,
        coverage: record.coverage,
        source: record.source,
        sourceVersion: record.sourceVersion,
        computedAt: record.computedAt,
        payloadJson: record.payload
      });
    }
  };

  const geoAggregateStore: GeoAggregateStore = {
    getGeoValues: async (input) => {
      const rows = await getGeoAggregateValues(db, input);
      return rows.map((row) => ({
        aggregateId: row.aggregateId,
        periodYear: row.periodYear,
        geoLevel: row.geoLevel,
        geoCode: row.geoCode,
        paramsHash: row.paramsHash,
        paramsFamilyHash: row.paramsFamilyHash,
        source: row.source,
        sourceVersion: row.sourceVersion,
        payload: row.payloadJson
      }));
    },
    getLatestPeriodYear: async (input) =>
      getLatestGeoAggregatePeriodYear(db, {
        aggregateId: input.aggregateId,
        paramsFamilyHash: input.paramsFamilyHash
      }),
    upsertGeoValuesBatch: async (records) => {
      await upsertGeoAggregateValuesBatch(
        db,
        records.map((record) => ({
          aggregateId: record.aggregateId,
          periodYear: record.periodYear,
          geoLevel: record.geoLevel,
          geoCode: record.geoCode,
          paramsHash: record.paramsHash,
          paramsFamilyHash: record.paramsFamilyHash,
          source: record.source ?? null,
          sourceVersion: record.sourceVersion ?? null,
          payloadJson: record.payload
        }))
      );
    }
  };

  const zoneGeoMapStore: ZoneGeoMapStore = {
    getZoneGeoWeights: async (input) => getZoneGeoWeights(db, input),
    upsertZoneGeoWeightsBatch: async (records) => upsertZoneGeoWeightsBatch(db, records)
  };

  return new ZoneAggregatesService({
    aggregateStore,
    geoAggregateStore,
    zoneGeoMapStore,
    logger
  });
}
