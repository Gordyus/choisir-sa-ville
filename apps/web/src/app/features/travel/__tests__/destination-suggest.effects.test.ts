import assert from "node:assert/strict";
import test from "node:test";
import { Observable } from "rxjs";
import type { GeocodeRequest } from "@csv/core";
import { DestinationSuggestEffects } from "../destination-suggest.effects";
import type { GeocodeService } from "../../../core/api/geocode.service";

type FakeGeocodeService = {
  geocode: (request: GeocodeRequest) => Observable<{ candidates: { label: string; lat: number; lng: number }[] }>;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("destination suggest cancels stale requests and toggles loading", async () => {
  const geocodeService: FakeGeocodeService = {
    geocode: (request) =>
      new Observable((subscriber) => {
        const delay = request.query === "par" ? 400 : 20;
        const timeout = setTimeout(() => {
          if (!subscriber.closed) {
            subscriber.next({
              candidates: [{ label: request.query, lat: 48.0, lng: 2.0 }]
            });
            subscriber.complete();
          }
        }, delay);
        return () => clearTimeout(timeout);
      })
  };

  const effects = new DestinationSuggestEffects(geocodeService as unknown as GeocodeService);
  const suggestions: string[] = [];
  const loading: boolean[] = [];

  const suggestionsSub = effects.suggestions$.subscribe((values) => {
    const label = values[0]?.label;
    if (label) suggestions.push(label);
  });
  const loadingSub = effects.isSuggesting$.subscribe((value) => loading.push(value));

  effects.setQuery({ query: "par", enabled: true, selectedLabel: null, viewport: null });
  await sleep(350);
  effects.setQuery({ query: "pari", enabled: true, selectedLabel: null, viewport: null });

  await sleep(500);

  assert.equal(suggestions.at(-1), "pari");
  assert.ok(loading.includes(true));
  assert.equal(loading.at(-1), false);

  suggestionsSub.unsubscribe();
  loadingSub.unsubscribe();
});
