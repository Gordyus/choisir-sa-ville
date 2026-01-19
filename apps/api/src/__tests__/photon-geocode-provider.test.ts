import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPhotonUrl,
  mapPhotonResponse
} from "../services/photon-geocode-provider.js";

test("buildPhotonUrl encodes near and bbox params", () => {
  const url = buildPhotonUrl("https://photon.example", {
    query: "  Rouen  ",
    near: { lat: 49.4431, lng: 1.0993 },
    bbox: { minLon: 1.0, minLat: 49.0, maxLon: 1.2, maxLat: 49.6 },
    limit: 5
  });

  assert.equal(url.pathname, "/api");
  assert.equal(url.searchParams.get("q"), "Rouen");
  assert.equal(url.searchParams.get("lang"), "fr");
  assert.equal(url.searchParams.get("lat"), "49.4431");
  assert.equal(url.searchParams.get("lon"), "1.0993");
  assert.equal(url.searchParams.get("bbox"), "1,49,1.2,49.6");
  assert.equal(url.searchParams.get("limit"), "5");
});

test("mapPhotonResponse maps candidates and skips invalid rows", () => {
  const response = mapPhotonResponse({
    features: [
      {
        geometry: { coordinates: [1.0993, 49.4431] },
        properties: { label: "Rouen, France", score: 0.9 }
      },
      {
        geometry: { coordinates: [2.3522, 48.8566] },
        properties: { name: "Paris", country: "France" }
      },
      {
        geometry: { coordinates: [-73.5673, 45.5017] },
        properties: { label: "Montreal, Quebec, Canada", countrycode: "ca" }
      },
      {
        geometry: { coordinates: [null as unknown as number, 0] },
        properties: { label: "Bad" }
      }
    ]
  });

  assert.equal(response.candidates.length, 2);
  assert.deepEqual(response.candidates[0], {
    label: "Rouen, France",
    lat: 49.4431,
    lng: 1.0993,
    score: 0.9,
    source: "photon"
  });
  assert.equal(response.candidates[1]?.label, "Paris, France");
});
