import type { CacheStore, GeocodeProvider, GeocodeRequest, GeocodeResponse } from "@csv/core";
import { getCachedGeocode, setCachedGeocode } from "@csv/core";

export type GeocodeService = {
  geocode: (input: GeocodeRequest) => Promise<GeocodeResponse>;
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
): Promise<GeocodeResponse> {
  const cached = await getCachedGeocode(cache, input);
  if (cached) {
    return cached;
  }

  const response = await provider.geocode(input);
  await setCachedGeocode(cache, input, response);
  return response;
}
