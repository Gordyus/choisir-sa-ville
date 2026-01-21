import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import type { ZoneAggregatePlugin } from "../zone-aggregates/types.js";
import {
  ZoneAggregateError,
  ZoneAggregatesService,
  hashAggregateParamsFamily,
  registerZoneAggregatePlugin
} from "../zone-aggregates/index.js";

const TestParamsSchema = z.object({
  year: z.number(),
  segmentKey: z.string().default("ALL_ALL")
});

const TestOutputSchema = z.object({
  value: z.number()
});

const testPlugin: ZoneAggregatePlugin<z.infer<typeof TestParamsSchema>, z.infer<typeof TestOutputSchema>> =
  {
    id: "test.latest",
    version: 1,
    display: { label: "Test" },
    paramsSchema: TestParamsSchema,
    outputSchema: TestOutputSchema,
    compute: async (ctx) => ({
      base: {
        zoneId: ctx.zoneId,
        aggregateId: "test.latest",
        periodYear: ctx.periodYear,
        coverage: 1,
        source: "test",
        sourceVersion: "1",
        computedAt: new Date(0)
      },
      payload: { value: ctx.periodYear }
    })
  };

try {
  registerZoneAggregatePlugin(testPlugin);
} catch (error) {
  if (!String(error).includes("already registered")) {
    throw error;
  }
}

function createService(latestByHash: Map<string, number>): ZoneAggregatesService {
  return new ZoneAggregatesService({
    aggregateStore: {
      getAggregate: async () => null,
      upsertAggregate: async () => {}
    },
    geoAggregateStore: {
      getGeoValues: async () => [],
      getLatestPeriodYear: async (input) => latestByHash.get(input.paramsFamilyHash) ?? null,
      upsertGeoValuesBatch: async () => {}
    },
    zoneGeoMapStore: {
      getZoneGeoWeights: async () => [{ geoCode: "00000", weight: 1 }],
      upsertZoneGeoWeightsBatch: async () => {}
    }
  });
}

test("service resolves latest when year is missing", async () => {
  const paramsFamilyHash = await hashAggregateParamsFamily({ year: 2000, segmentKey: "ALL_ALL" });
  const service = createService(new Map([[paramsFamilyHash, 2025]]));

  const result = await service.getAggregate("zone-1", "test.latest", { segmentKey: "ALL_ALL" });
  assert.equal(result.base.periodYear, 2025);
  assert.equal(result.payload.value, 2025);
});

test("service resolves latest when year=latest", async () => {
  const paramsFamilyHash = await hashAggregateParamsFamily({ year: 2000, segmentKey: "ALL_ALL" });
  const service = createService(new Map([[paramsFamilyHash, 2024]]));

  const result = await service.getAggregate("zone-1", "test.latest", {
    year: "latest",
    segmentKey: "ALL_ALL"
  });
  assert.equal(result.base.periodYear, 2024);
});

test("service resolves latest when periodYear=latest", async () => {
  const paramsFamilyHash = await hashAggregateParamsFamily({ year: 2000, segmentKey: "ALL_ALL" });
  const service = createService(new Map([[paramsFamilyHash, 2023]]));

  const result = await service.getAggregate("zone-1", "test.latest", {
    periodYear: "latest",
    segmentKey: "ALL_ALL"
  });
  assert.equal(result.base.periodYear, 2023);
});

test("service resolves latest per params family", async () => {
  const hashA = await hashAggregateParamsFamily({ year: 2000, segmentKey: "A" });
  const hashB = await hashAggregateParamsFamily({ year: 2000, segmentKey: "B" });
  const service = createService(
    new Map([
      [hashA, 2024],
      [hashB, 2025]
    ])
  );

  const result = await service.getAggregate("zone-1", "test.latest", { segmentKey: "A" });
  assert.equal(result.base.periodYear, 2024);
});

test("service returns NO_DATA when no geo values exist", async () => {
  const service = createService(new Map());

  await assert.rejects(
    () => service.getAggregate("zone-1", "test.latest", { segmentKey: "ALL_ALL" }),
    (error) => error instanceof ZoneAggregateError && error.code === "NO_DATA"
  );
});
