import assert from "node:assert/strict";
import test from "node:test";
import { bucketToNextDateTime, defaultBucket, normalizeBucket } from "../time-bucket.js";

test("defaultBucket returns Monday 08:30", () => {
  assert.equal(defaultBucket(), "mon_08:30");
});

test("normalizeBucket rounds to the nearest quarter hour", () => {
  assert.equal(normalizeBucket("mon_08:31"), "mon_08:30");
  assert.equal(normalizeBucket("mon_08:38"), "mon_08:45");
});

test("normalizeBucket handles hour/day rollover", () => {
  assert.equal(normalizeBucket("mon_08:53"), "mon_09:00");
  assert.equal(normalizeBucket("sun_23:53"), "mon_00:00");
});

test("bucketToNextDateTime returns the next occurrence in Europe/Paris", () => {
  const now = new Date("2026-01-18T07:00:00Z");
  const iso = bucketToNextDateTime("mon_08:30", now, "Europe/Paris");
  assert.equal(iso, "2026-01-19T07:30:00.000Z");
});

test("bucketToNextDateTime uses the same day if still ahead", () => {
  const now = new Date("2026-01-19T06:00:00Z");
  const iso = bucketToNextDateTime("mon_08:30", now, "Europe/Paris");
  assert.equal(iso, "2026-01-19T07:30:00.000Z");
});
