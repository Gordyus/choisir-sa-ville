import type { CacheStore, GeocodeProvider, GeocodeRequest, GeocodeResponse } from "@csv/core";
import { getCachedGeocode, setCachedGeocode } from "@csv/core";

export type GeocodeServiceResult = {
  response: GeocodeResponse;
  cacheHit: boolean;
};

export type GeocodeService = {
  geocode: (input: GeocodeRequest) => Promise<GeocodeServiceResult>;
};

export function createGeocodeService(
  cache: CacheStore,
  provider: GeocodeProvider
): GeocodeService {
  return {
    geocode: (input) => geocode(cache, provider, input)
  };
}

async function geocode(
  cache: CacheStore,
  provider: GeocodeProvider,
  input: GeocodeRequest
): Promise<GeocodeServiceResult> {
  const cached = await getCachedGeocode(cache, input);
  if (cached) {
    return { response: cached, cacheHit: true };
  }

  try {
    const response = await provider.geocode(input);
    await setCachedGeocode(cache, input, response);
    return { response, cacheHit: false };
  } catch {
    return { response: { candidates: [] }, cacheHit: false };
  }
}
