import assert from "node:assert/strict";
import test from "node:test";
import { encodeGeohash, toGeohash6 } from "../geohash.js";

test("toGeohash6 returns stable 6-char geohash", () => {
  const value = toGeohash6(57.64911, 10.40744);
  assert.equal(value.length, 6);
  assert.equal(value, "u4pruy");
});

test("encodeGeohash supports custom precision", () => {
  const value = encodeGeohash(42.6, -5.6, 6);
  assert.equal(value, "ezs42e");
});

test("geohash differs for distant points", () => {
  const first = toGeohash6(48.8566, 2.3522);
  const second = toGeohash6(43.6047, 1.4442);
  assert.notEqual(first, second);
});
