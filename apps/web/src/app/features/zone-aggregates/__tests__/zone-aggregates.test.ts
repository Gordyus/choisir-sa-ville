import assert from "node:assert/strict";
import test from "node:test";
import { BehaviorSubject, of } from "rxjs";
import type { ZoneAggregateResult } from "@csv/core";
import type { ZoneAggregatesApiService } from "../../../core/api/zone-aggregates.service";
import { formatAggregateCard } from "../aggregate-formatters";
import { ATTRIBUTION_TEXT, PREDICTION_TOOLTIP, QUARTILE_TOOLTIP } from "../aggregate-copy";
import { createSelectedAggregateStateStream } from "../zone-aggregates.state";

test("zone aggregates stream fetches selected aggregate", async () => {
  const selection$ = new BehaviorSubject<string | null>(null);
  const api: ZoneAggregatesApiService = {
    getAggregate: () =>
      of({
        base: {
          zoneId: "75056",
          aggregateId: "rent.v1",
          periodYear: 2023,
          coverage: 1,
          source: "fixture",
          sourceVersion: "2023",
          computedAt: new Date("2026-01-20T10:00:00Z")
        },
        payload: { rentMedianPerM2: 30.5 }
      }),
    batch: () => of({ results: [], errors: [] })
  } as ZoneAggregatesApiService;

  const states: string[] = [];

  const sub = createSelectedAggregateStateStream(
    selection$,
    api,
    "rent.v1",
    { year: 2023, segmentKey: "ALL_ALL" }
  )
    .subscribe((state) => states.push(state.status));

  selection$.next("75056");

  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.ok(states.includes("loading"));
  assert.ok(states.includes("loaded"));

  sub.unsubscribe();
});

test("zone aggregate card formats rent median", () => {
  const result: ZoneAggregateResult<unknown> = {
    base: {
      zoneId: "75056",
      aggregateId: "rent.v1",
      periodYear: 2023,
      coverage: 0.82,
      source: "fixture",
      sourceVersion: "2023",
      computedAt: new Date("2026-01-20T10:00:00Z")
    },
    payload: { rentMedianPerM2: 31.2 }
  };

  const content = formatAggregateCard(result);
  assert.ok(content);
  assert.equal(content.title, "Rent");
  assert.ok(content.value.startsWith("Median:"));
  assert.ok(content.yearTooltip.includes("Data year: 2023"));
});

test("zone aggregate card formats quartiles and min/max when available", () => {
  const result: ZoneAggregateResult<unknown> = {
    base: {
      zoneId: "75056",
      aggregateId: "rent.v1",
      periodYear: 2023,
      coverage: 0.9,
      source: "public.rent",
      sourceVersion: "2023",
      computedAt: new Date("2026-01-20T10:00:00Z")
    },
    payload: {
      rentMedianPerM2: 31.2,
      rentP25PerM2: 24.5,
      rentP75PerM2: 42,
      rentMinPerM2: 18.1,
      rentMaxPerM2: 56.4,
      _meta: { attribution: ATTRIBUTION_TEXT }
    }
  };

  const content = formatAggregateCard(result);
  assert.ok(content);
  assert.ok(content.range?.startsWith("P25-P75:"));
  assert.equal(content.rangeTooltip, QUARTILE_TOOLTIP);
  assert.ok(content.minMax?.startsWith("Min-Max:"));
  assert.ok(content.yearTooltip.includes(ATTRIBUTION_TEXT));
});

test("zone aggregate card formats prediction interval when quartiles are missing", () => {
  const result: ZoneAggregateResult<unknown> = {
    base: {
      zoneId: "75056",
      aggregateId: "rent.v1",
      periodYear: 2025,
      coverage: 0.75,
      source: "anil.rent.ads",
      sourceVersion: "2025",
      computedAt: new Date("2026-01-20T10:00:00Z")
    },
    payload: {
      rentMedianPerM2: 28.4,
      rentPredLowerPerM2: 22.1,
      rentPredUpperPerM2: 36.8
    }
  };

  const content = formatAggregateCard(result);
  assert.ok(content);
  assert.ok(content.range?.startsWith("Prediction interval:"));
  assert.equal(content.rangeTooltip, PREDICTION_TOOLTIP);
});

test("zone aggregate card adds mesh and caution badges from meta", () => {
  const result: ZoneAggregateResult<unknown> = {
    base: {
      zoneId: "75056",
      aggregateId: "rent.v1",
      periodYear: 2025,
      coverage: 0.7,
      source: "anil.rent.ads",
      sourceVersion: "2025",
      computedAt: new Date("2026-01-20T10:00:00Z")
    },
    payload: {
      rentMedianPerM2: 28.4,
      rentPredLowerPerM2: 15,
      rentPredUpperPerM2: 45,
      _meta: {
        typPred: "maille",
        nbobs_com: 10,
        r2_adj: 0.4
      }
    }
  };

  const content = formatAggregateCard(result);
  assert.ok(content);
  const badges = content.badges?.map((badge) => badge.label) ?? [];
  assert.ok(badges.includes("Estimated (mesh)"));
  assert.ok(badges.includes("Use with caution"));
});
