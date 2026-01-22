import assert from "node:assert/strict";
import test from "node:test";
import { mapToCommune, mapToCommunePopulationReference } from "./mappers.js";

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

test("mapToCommunePopulationReference accepts CODGEO + PMUN", () => {
  const record = {
    CODGEO: "75056",
    PMUN: "2165039"
  } as Record<string, string>;

  const result = mapToCommunePopulationReference(record);
  assert.ok(!("skip" in result));
  if ("skip" in result) return;
  assert.equal(result.inseeCode, "75056");
  assert.equal(result.population, 2165039);
});

test("mapToCommunePopulationReference accepts com + population_municipale", () => {
  const record = {
    com: "13055",
    population_municipale: "870709"
  } as Record<string, string>;

  const result = mapToCommunePopulationReference(record);
  assert.ok(!("skip" in result));
  if ("skip" in result) return;
  assert.equal(result.inseeCode, "13055");
  assert.equal(result.population, 870709);
});

test("mapToCommunePopulationReference skips invalid when population missing", () => {
  const record = {
    CODGEO: "69123"
  } as Record<string, string>;

  const result = mapToCommunePopulationReference(record);
  assert.ok("skip" in result);
  assert.equal(result.skip, "invalid");
});

test("mapToCommunePopulationReference skips invalid when insee missing", () => {
  const record = {
    PMUN: "12345"
  } as Record<string, string>;

  const result = mapToCommunePopulationReference(record);
  assert.ok("skip" in result);
  assert.equal(result.skip, "invalid");
});
