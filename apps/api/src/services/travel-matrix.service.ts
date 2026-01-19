import {
  buildTravelTimeCacheKey,
  bucketToNextDateTime,
  normalizeBucket,
  normalizeTimeBucketForCache,
  type CacheStore,
  type TravelMatrixOrigin,
  type TravelMatrixResult,
  type TravelMode,
  type TravelProvider
} from "@csv/core";

export type TravelMatrixRequest = {
  mode: TravelMode;
  destination: { lat: number; lng: number };
  timeBucket?: string;
  origins: TravelMatrixOrigin[];
};

export type TravelMatrixResponse = {
  mode: TravelMode;
  timeBucket: string;
  results: TravelMatrixResult[];
};

export type TravelMatrixService = {
  getMatrix: (input: TravelMatrixRequest) => Promise<TravelMatrixResponse>;
};

const BATCH_SIZE = 25;
const TTL_CAR_SECONDS = 60 * 60 * 24 * 30;
const TTL_TRANSIT_SECONDS = 60 * 60 * 24 * 7;

const STATUS_VALUES = new Set(["OK", "NO_ROUTE", "ERROR"]);

export function createTravelMatrixService(
  cache: CacheStore,
  provider: TravelProvider
): TravelMatrixService {
  return {
    getMatrix: (input) => getMatrix(cache, provider, input)
  };
}

async function getMatrix(
  cache: CacheStore,
  provider: TravelProvider,
  input: TravelMatrixRequest
): Promise<TravelMatrixResponse> {
  const normalizedBucket = input.timeBucket
    ? normalizeBucket(input.timeBucket)
    : undefined;
  const timeBucketKey = normalizeTimeBucketForCache(normalizedBucket);
  const ttlSeconds = input.mode === "transit" ? TTL_TRANSIT_SECONDS : TTL_CAR_SECONDS;
  const cacheEntries = await Promise.all(
    input.origins.map(async (origin) => {
      const key = buildTravelTimeCacheKey({
        mode: input.mode,
        zoneId: origin.zoneId,
        destLat: input.destination.lat,
        destLng: input.destination.lng,
        timeBucket: timeBucketKey
      });
      const cached = await cache.get(key);
      return { origin, key, cached };
    })
  );

  const cachedResults = new Map<string, TravelMatrixResult>();
  const missingOrigins: Array<{ origin: TravelMatrixOrigin; key: string }> = [];

  for (const entry of cacheEntries) {
    if (entry.cached) {
      const parsed = parseCachedResult(entry.cached);
      if (parsed && parsed.zoneId === entry.origin.zoneId) {
        cachedResults.set(entry.key, parsed);
        continue;
      }
    }
    missingOrigins.push({ origin: entry.origin, key: entry.key });
  }

  const freshResults = await fetchMissingResults(
    provider,
    input,
    normalizedBucket,
    missingOrigins
  );

  await Promise.all(
    freshResults.map((item) => cache.set(item.key, JSON.stringify(item.result), ttlSeconds))
  );

  const allResults = new Map<string, TravelMatrixResult>();
  for (const [key, result] of cachedResults.entries()) {
    allResults.set(key, result);
  }
  for (const item of freshResults) {
    allResults.set(item.key, item.result);
  }

  const results = cacheEntries.map((entry) => {
    return (
      allResults.get(entry.key) ?? {
        zoneId: entry.origin.zoneId,
        status: "ERROR"
      }
    );
  });

  return {
    mode: input.mode,
    timeBucket: timeBucketKey,
    results
  };
}

async function fetchMissingResults(
  provider: TravelProvider,
  input: TravelMatrixRequest,
  normalizedBucket: string | undefined,
  missing: Array<{ origin: TravelMatrixOrigin; key: string }>
): Promise<Array<{ key: string; result: TravelMatrixResult }>> {
  if (missing.length === 0) return [];

  const arriveByIso =
    input.mode === "transit" && normalizedBucket
      ? bucketToNextDateTime(normalizedBucket, new Date(), "Europe/Paris")
      : undefined;

  const results: Array<{ key: string; result: TravelMatrixResult }> = [];
  for (const chunk of chunkOrigins(missing, BATCH_SIZE)) {
    const origins = chunk.map((item) => item.origin);
    try {
      const chunkResults =
        input.mode === "transit" && arriveByIso
          ? await provider.matrixTransit(origins, input.destination, arriveByIso)
          : await provider.matrixCar(origins, input.destination);

      const byZoneId = new Map(chunkResults.map((item) => [item.zoneId, item]));
      for (const item of chunk) {
        const result = byZoneId.get(item.origin.zoneId);
        results.push({
          key: item.key,
          result:
            result && STATUS_VALUES.has(result.status)
              ? result
              : { zoneId: item.origin.zoneId, status: "ERROR" }
        });
      }
    } catch {
      for (const item of chunk) {
        results.push({
          key: item.key,
          result: { zoneId: item.origin.zoneId, status: "ERROR" }
        });
      }
    }
  }

  return results;
}

function parseCachedResult(value: string): TravelMatrixResult | null {
  try {
    const parsed = JSON.parse(value) as TravelMatrixResult;
    if (
      parsed &&
      typeof parsed.zoneId === "string" &&
      typeof parsed.status === "string" &&
      STATUS_VALUES.has(parsed.status)
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function chunkOrigins<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}
