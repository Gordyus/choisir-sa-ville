import assert from "node:assert/strict";
import test from "node:test";
import { BehaviorSubject, of } from "rxjs";
import type { ZoneAggregateResult } from "@csv/core";
import type { ZoneAggregatesApiService } from "../../../core/api/zone-aggregates.service";
import { formatAggregateCard } from "../aggregate-formatters";
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

test("zone aggregate card formats rent values", () => {
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
  assert.ok(content.value.includes("EUR/m2"));
});
