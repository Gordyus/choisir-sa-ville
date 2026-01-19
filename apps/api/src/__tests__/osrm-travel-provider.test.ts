import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRouteUrl,
  buildTableUrl,
  mapRouteResponse,
  mapTableResponse
} from "../services/osrm-travel-provider.js";

test("buildTableUrl uses lon,lat order and indices", () => {
  const url = buildTableUrl(
    "https://router.project-osrm.org",
    [
      { zoneId: "a", lat: 48.8, lng: 2.3 },
      { zoneId: "b", lat: 48.81, lng: 2.31 }
    ],
    { lat: 48.9, lng: 2.4 }
  );

  assert.equal(
    url.pathname,
    "/table/v1/driving/2.3,48.8;2.31,48.81;2.4,48.9"
  );
  assert.equal(url.searchParams.get("sources"), "0;1");
  assert.equal(url.searchParams.get("destinations"), "2");
  assert.equal(url.searchParams.get("annotations"), "duration,distance");
});

test("buildRouteUrl uses lon,lat order and geojson params", () => {
  const url = buildRouteUrl(
    "https://router.project-osrm.org",
    { lat: 48.8, lng: 2.3 },
    { lat: 48.9, lng: 2.4 }
  );

  assert.equal(
    url.pathname,
    "/route/v1/driving/2.3,48.8;2.4,48.9"
  );
  assert.equal(url.searchParams.get("overview"), "full");
  assert.equal(url.searchParams.get("geometries"), "geojson");
});

test("mapTableResponse maps ok and no-route rows", () => {
  const results = mapTableResponse(
    {
      code: "Ok",
      durations: [[120], [null]],
      distances: [[1000], [null]]
    },
    [
      { zoneId: "a", lat: 0, lng: 0 },
      { zoneId: "b", lat: 0, lng: 0 }
    ]
  );

  assert.equal(results[0]?.status, "OK");
  assert.equal(results[0]?.duration_s, 120);
  assert.equal(results[0]?.distance_m, 1000);
  assert.equal(results[1]?.status, "NO_ROUTE");
});

test("mapRouteResponse maps ok route geometry", () => {
  const result = mapRouteResponse({
    code: "Ok",
    routes: [
      {
        duration: 1800,
        distance: 12000,
        geometry: {
          type: "LineString",
          coordinates: [
            [2.3, 48.8],
            [2.4, 48.9]
          ]
        }
      }
    ]
  });

  assert.equal(result.status, "OK");
  assert.equal(result.duration_s, 1800);
  assert.equal(result.distance_m, 12000);
});

test("mapRouteResponse maps no-route", () => {
  const result = mapRouteResponse({ code: "NoRoute" });
  assert.equal(result.status, "NO_ROUTE");
});
