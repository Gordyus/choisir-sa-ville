import assert from "node:assert/strict";
import test from "node:test";
import {
  getZoneAggregatePlugin,
  hashAggregateParams,
  listZoneAggregatePlugins
} from "../zone-aggregates/index.js";

test("aggregate params hash is stable", async () => {
  const first = await hashAggregateParams({ year: 2023, segmentKey: "ALL_ALL" });
  const second = await hashAggregateParams({ segmentKey: "ALL_ALL", year: 2023 });
  assert.equal(first, second);
});

test("registry exposes rent.v1 plugin", () => {
  const plugin = getZoneAggregatePlugin("rent.v1");
  assert.ok(plugin);
  const ids = listZoneAggregatePlugins().map((item) => item.id);
  assert.ok(ids.includes("rent.v1"));
});
