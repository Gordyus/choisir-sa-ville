import assert from "node:assert/strict";
import test from "node:test";
import {
  bestMatchRank,
  computeMatchRank,
  computeCandidateRank,
  normalizeSlugQuery,
  sortRankedCandidates,
  type RankedCandidate
} from "../services/area-suggest.service.js";

test("computeMatchRank orders exact, startsWith, contains", () => {
  assert.equal(computeMatchRank("rouen", "Rouen"), 0);
  assert.equal(computeMatchRank("rou", "Rouen"), 1);
  assert.equal(computeMatchRank("uen", "Rouen"), 2);
  assert.equal(computeMatchRank("paris", "Rouen"), 3);
});

test("bestMatchRank picks the best field match", () => {
  const rank = bestMatchRank("76", ["Seine-Maritime", "76", "76000"]);
  assert.equal(rank, 0);
});

test("normalizeSlugQuery handles common separators", () => {
  assert.equal(normalizeSlugQuery("seine maritime"), "seine-maritime");
  assert.equal(normalizeSlugQuery("cote d or"), "cote-d-or");
  assert.equal(normalizeSlugQuery("ile de france"), "ile-de-france");
  assert.equal(normalizeSlugQuery("cote-d'or"), "cote-d-or");
  assert.equal(normalizeSlugQuery("Île de France"), "ile-de-france");
});

test("computeCandidateRank matches slug-normalized values", () => {
  const rank = computeCandidateRank("cote d or", "cote-d-or", {
    values: ["Cote-d'Or"],
    slugValues: ["cote-d-or"]
  });
  assert.equal(rank, 0);
});

test("numeric query matches department and postal code by relevance", () => {
  const deptRank = bestMatchRank("76", ["76"]);
  const postalRank = bestMatchRank("76", ["76000"]);
  assert.equal(deptRank, 0);
  assert.equal(postalRank, 1);
});

test("sortRankedCandidates ranks by relevance then population", () => {
  const candidates: RankedCandidate[] = [
    {
      key: "commune:1",
      rank: 1,
      population: 1000,
      candidate: { label: "Alpha", lat: 1, lng: 1, source: "commune" }
    },
    {
      key: "commune:2",
      rank: 1,
      population: 5000,
      candidate: { label: "Beta", lat: 2, lng: 2, source: "commune" }
    },
    {
      key: "commune:3",
      rank: 0,
      population: 200,
      candidate: { label: "Exact", lat: 3, lng: 3, source: "commune" }
    },
    {
      key: "bad",
      rank: 0,
      population: 100,
      candidate: { label: "Invalid", lat: Number.NaN, lng: 4, source: "commune" }
    }
  ];

  const ordered = sortRankedCandidates(candidates);
  assert.equal(ordered.length, 3);
  assert.equal(ordered[0]?.label, "Exact");
  assert.equal(ordered[1]?.label, "Beta");
  assert.equal(ordered[2]?.label, "Alpha");
});
