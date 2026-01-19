import assert from "node:assert/strict";
import test from "node:test";
import {
  computeBboxFromSearchArea,
  computeNearFromSearchArea,
  hashBbox,
  normalizeQuery
} from "../geocode.js";

test("normalizeQuery trims and collapses whitespace", () => {
  assert.equal(normalizeQuery("  hello   world "), "hello world");
});

test("hashBbox is stable and rounded", () => {
  const bbox = {
    minLon: -1.234567,
    minLat: 48.987654,
    maxLon: 2.345678,
    maxLat: 49.123456
  };
  assert.equal(hashBbox(bbox), "-1.23457,48.98765,2.34568,49.12346");
  assert.equal(hashBbox(bbox), "-1.23457,48.98765,2.34568,49.12346");
});

test("computeNearFromSearchArea returns the bbox center", () => {
  const near = computeNearFromSearchArea({
    bbox: { minLon: 0, minLat: 10, maxLon: 10, maxLat: 20 }
  });
  assert.deepEqual(near, { lat: 15, lng: 5 });
});

test("computeBboxFromSearchArea returns bbox or undefined", () => {
  const bbox = computeBboxFromSearchArea({
    bbox: { minLon: 0, minLat: 10, maxLon: 10, maxLat: 20 }
  });
  assert.deepEqual(bbox, { minLon: 0, minLat: 10, maxLon: 10, maxLat: 20 });
  assert.equal(computeBboxFromSearchArea(null), undefined);
});
