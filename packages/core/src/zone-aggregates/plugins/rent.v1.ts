import { z } from "zod";
import { noData } from "../errors.js";
import type { ZoneAggregatePlugin, ZoneGeoWeight } from "../types.js";

const RentParamsSchema = z.object({
  year: z.coerce.number().int().min(1900).max(2100),
  segmentKey: z.string().default("ALL_ALL")
});

const RentOutputSchema = z.object({
  rentMedianPerM2: z.number(),
  rentP25PerM2: z.number().nullable().optional(),
  rentP75PerM2: z.number().nullable().optional()
});

type RentParams = z.infer<typeof RentParamsSchema>;

const DEFAULT_SOURCE = "fixture.rent";
const DEFAULT_SOURCE_VERSION = "2023-01";

export const rentV1Plugin: ZoneAggregatePlugin<RentParams, z.infer<typeof RentOutputSchema>> = {
  id: "rent.v1",
  version: 1,
  display: {
    label: "Rent",
    unit: "EUR/m2",
    category: "housing"
  },
  paramsSchema: RentParamsSchema,
  outputSchema: RentOutputSchema,
  compute: async (ctx) => {
    const geoLevel = resolveGeoLevel(ctx.zoneGeoWeights);
    const geoCodes = ctx.zoneGeoWeights.map((item) => item.geoCode);
    const values = await ctx.geoStore.getValues({
      aggregateId: "rent.v1",
      periodYear: ctx.periodYear,
      geoLevel,
      geoCodes,
      paramsHash: ctx.paramsHash
    });

    const valueMap = new Map<string, z.infer<typeof RentOutputSchema>>();
    for (const value of values) {
      const parsed = RentOutputSchema.safeParse(value.payload);
      if (!parsed.success) {
        ctx.logger?.warn?.("Invalid rent payload for geo value.", {
          geoCode: value.geoCode
        });
        continue;
      }
      valueMap.set(value.geoCode, parsed.data);
    }

    const totalWeight = ctx.zoneGeoWeights.reduce((sum, item) => sum + item.weight, 0);
    if (totalWeight <= 0) {
      throw noData("No geo weights available for rent.", { zoneId: ctx.zoneId });
    }

    let coveredWeight = 0;
    let medianSum = 0;
    let p25Sum = 0;
    let p25Weight = 0;
    let p75Sum = 0;
    let p75Weight = 0;

    for (const weight of ctx.zoneGeoWeights) {
      const payload = valueMap.get(weight.geoCode);
      if (!payload) continue;

      if (typeof payload.rentMedianPerM2 === "number") {
        medianSum += payload.rentMedianPerM2 * weight.weight;
        coveredWeight += weight.weight;
      }

      if (typeof payload.rentP25PerM2 === "number") {
        p25Sum += payload.rentP25PerM2 * weight.weight;
        p25Weight += weight.weight;
      }

      if (typeof payload.rentP75PerM2 === "number") {
        p75Sum += payload.rentP75PerM2 * weight.weight;
        p75Weight += weight.weight;
      }
    }

    if (coveredWeight <= 0) {
      throw noData("No rent data available for zone.", { zoneId: ctx.zoneId });
    }

    const payload = {
      rentMedianPerM2: round(medianSum / coveredWeight),
      rentP25PerM2: p25Weight > 0 ? round(p25Sum / p25Weight) : null,
      rentP75PerM2: p75Weight > 0 ? round(p75Sum / p75Weight) : null
    };

    return {
      base: {
        zoneId: ctx.zoneId,
        aggregateId: "rent.v1",
        periodYear: ctx.periodYear,
        coverage: coveredWeight / totalWeight,
        source: DEFAULT_SOURCE,
        sourceVersion: DEFAULT_SOURCE_VERSION,
        computedAt: new Date()
      },
      payload
    };
  }
};

function resolveGeoLevel(weights: ZoneGeoWeight[]): string {
  const level = weights.find((item) => item.geoLevel)?.geoLevel;
  return level ?? "commune";
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
