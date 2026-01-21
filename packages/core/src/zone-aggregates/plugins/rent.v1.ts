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
  rentP75PerM2: z.number().nullable().optional(),
  rentMinPerM2: z.number().nullable().optional(),
  rentMaxPerM2: z.number().nullable().optional(),
  rentPredLowerPerM2: z.number().nullable().optional(),
  rentPredUpperPerM2: z.number().nullable().optional(),
  _meta: z
    .object({
      attribution: z.string().optional(),
      nbobs_com: z.number().optional(),
      nbobs_mail: z.number().optional(),
      r2_adj: z.number().optional(),
      typPred: z.union([z.string(), z.number()]).optional()
    })
    .optional()
});

type RentParams = z.infer<typeof RentParamsSchema>;

const DEFAULT_SOURCE = "public.rent";
const DEFAULT_SOURCE_VERSION = "2023";

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

    const resolvedSource = resolveSourceMetadata(values, ctx.logger);
    const attribution = resolveAttribution(values, ctx.logger);
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
    let predLowerSum = 0;
    let predLowerWeight = 0;
    let predUpperSum = 0;
    let predUpperWeight = 0;
    let minValue = Number.POSITIVE_INFINITY;
    let maxValue = Number.NEGATIVE_INFINITY;

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

      if (typeof payload.rentPredLowerPerM2 === "number") {
        predLowerSum += payload.rentPredLowerPerM2 * weight.weight;
        predLowerWeight += weight.weight;
      }

      if (typeof payload.rentPredUpperPerM2 === "number") {
        predUpperSum += payload.rentPredUpperPerM2 * weight.weight;
        predUpperWeight += weight.weight;
      }

      if (typeof payload.rentMinPerM2 === "number") {
        minValue = Math.min(minValue, payload.rentMinPerM2);
      }

      if (typeof payload.rentMaxPerM2 === "number") {
        maxValue = Math.max(maxValue, payload.rentMaxPerM2);
      }
    }

    if (coveredWeight <= 0) {
      throw noData("No rent data available for zone.", { zoneId: ctx.zoneId });
    }

    const payload = {
      rentMedianPerM2: round(medianSum / coveredWeight),
      rentP25PerM2: p25Weight > 0 ? round(p25Sum / p25Weight) : null,
      rentP75PerM2: p75Weight > 0 ? round(p75Sum / p75Weight) : null,
      rentPredLowerPerM2: predLowerWeight > 0 ? round(predLowerSum / predLowerWeight) : null,
      rentPredUpperPerM2: predUpperWeight > 0 ? round(predUpperSum / predUpperWeight) : null,
      rentMinPerM2: Number.isFinite(minValue) ? round(minValue) : null,
      rentMaxPerM2: Number.isFinite(maxValue) ? round(maxValue) : null,
      ...(attribution ? { _meta: { attribution } } : {})
    };

    return {
      base: {
        zoneId: ctx.zoneId,
        aggregateId: "rent.v1",
        periodYear: ctx.periodYear,
        coverage: coveredWeight / totalWeight,
        source: resolvedSource.source,
        sourceVersion: resolvedSource.sourceVersion,
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

function resolveSourceMetadata(
  values: Array<{ source?: string | null; sourceVersion?: string | null }>,
  logger?: { warn?: (message: string, details?: Record<string, unknown>) => void }
): { source: string; sourceVersion: string } {
  const sources = new Set<string>();
  const versions = new Set<string>();

  for (const value of values) {
    if (value.source) sources.add(value.source);
    if (value.sourceVersion) versions.add(value.sourceVersion);
  }

  if (sources.size > 1) {
    logger?.warn?.("Multiple rent sources detected, using the first.", {
      sources: Array.from(sources)
    });
  }
  if (versions.size > 1) {
    logger?.warn?.("Multiple rent source versions detected, using the first.", {
      sourceVersions: Array.from(versions)
    });
  }

  return {
    source: sources.values().next().value ?? DEFAULT_SOURCE,
    sourceVersion: versions.values().next().value ?? DEFAULT_SOURCE_VERSION
  };
}

function resolveAttribution(
  values: Array<{ payload?: unknown }>,
  logger?: { warn?: (message: string, details?: Record<string, unknown>) => void }
): string | null {
  const attributions = new Set<string>();

  for (const value of values) {
    if (!value.payload || typeof value.payload !== "object") continue;
    const meta = (value.payload as { _meta?: { attribution?: string } })._meta;
    if (meta?.attribution) {
      attributions.add(meta.attribution);
    }
  }

  if (attributions.size > 1) {
    logger?.warn?.("Multiple rent attributions detected, using the first.", {
      attributions: Array.from(attributions)
    });
  }

  return attributions.values().next().value ?? null;
}
