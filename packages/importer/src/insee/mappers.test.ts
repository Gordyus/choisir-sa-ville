import assert from "node:assert/strict";
import test from "node:test";
import { mapToCommune } from "./mappers.js";

type MapCase = {
  code: string;
  dep: string;
  parentRaw: string;
  expectedParent: string;
};

const CASES: MapCase[] = [
  { code: "76601", dep: "76D", parentRaw: "7612", expectedParent: "76012" },
  { code: "85165", dep: "85D", parentRaw: "8503", expectedParent: "85003" },
  { code: "85212", dep: "85D", parentRaw: "8503", expectedParent: "85003" }
];

test("mapToCommune picks parent code from trailing numeric field", () => {
  for (const entry of CASES) {
    const record = {
      TYPECOM: "COM",
      COM: entry.code,
      DEP: entry.dep,
      LIBELLE: "Test Commune",
      EXTRA: "foo",
      TRAILER: entry.parentRaw
    };

    const result = mapToCommune(record);
    assert.ok("row" in result, `Expected mapped row for ${entry.code}`);
    assert.equal(result.parentCode, entry.expectedParent);
  }
});
