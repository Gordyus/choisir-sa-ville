import {
  buildRouteCacheKey,
  bucketToNextDateTime,
  normalizeBucket,
  normalizeTimeBucketForCache,
  type CacheStore,
  type RouteGeometry,
  type RouteResult,
  type TravelMode,
  type TravelPoint,
  type TravelProvider,
  type TravelStatus
} from "@csv/core";
import type { Db } from "@csv/db";
import { domainError, notFound } from "../errors/domain-error.js";
import { getCityByInseeCode } from "./commune.service.js";

export type TravelRouteRequest = {
  mode: TravelMode;
  zoneId?: string;
  originLatLng?: string;
  dest: string;
  timeBucket?: string;
};

export type TravelRouteResponse = {
  zoneId: string | null;
  origin: TravelPoint;
  destination: TravelPoint;
  mode: TravelMode;
  timeBucket: string;
  duration_s?: number;
  distance_m?: number;
  status: TravelStatus;
  geometry?: RouteGeometry;
  transitDetails?: RouteResult["transitDetails"];
};

export type TravelRouteService = {
  getRoute: (input: TravelRouteRequest) => Promise<TravelRouteResponse>;
};

const TTL_CAR_SECONDS = 60 * 60 * 24 * 30;
const TTL_TRANSIT_SECONDS = 60 * 60 * 24 * 7;

const STATUS_VALUES = new Set<TravelStatus>(["OK", "NO_ROUTE", "ERROR"]);

export function createTravelRouteService(
  db: Db,
  cache: CacheStore,
  provider: TravelProvider
): TravelRouteService {
  return {
    getRoute: (input) => getRoute(db, cache, provider, input)
  };
}

async function getRoute(
  db: Db,
  cache: CacheStore,
  provider: TravelProvider,
  input: TravelRouteRequest
): Promise<TravelRouteResponse> {
  const destination = parseLatLng(input.dest);
  const originInfo = await resolveOrigin(db, input);
  const normalizedBucket = input.timeBucket ? normalizeBucket(input.timeBucket) : undefined;
  const timeBucketKey = normalizeTimeBucketForCache(normalizedBucket);
  const cacheKey = buildRouteCacheKey({
    mode: input.mode,
    originKey: originInfo.originKey,
    destLat: destination.lat,
    destLng: destination.lng,
    timeBucket: timeBucketKey
  });
  const ttlSeconds = input.mode === "transit" ? TTL_TRANSIT_SECONDS : TTL_CAR_SECONDS;

  const cached = await cache.get(cacheKey);
  if (cached) {
    const parsed = parseCachedRoute(cached);
    if (parsed) {
      return buildResponse(
        input.zoneId ?? null,
        originInfo.point,
        destination,
        input.mode,
        timeBucketKey,
        parsed
      );
    }
  }

  const result = await fetchRoute(provider, input, originInfo.point, destination, normalizedBucket);
  await cache.set(cacheKey, JSON.stringify(result), ttlSeconds);

  return buildResponse(
    input.zoneId ?? null,
    originInfo.point,
    destination,
    input.mode,
    timeBucketKey,
    result
  );
}

async function resolveOrigin(
  db: Db,
  input: TravelRouteRequest
): Promise<{ point: TravelPoint; originKey: string }> {
  if (input.zoneId) {
    const city = await getCityByInseeCode(db, input.zoneId);
    if (!city) {
      throw notFound("Zone not found", { zoneId: input.zoneId });
    }
    if (city.lat === null || city.lon === null) {
      throw domainError("ORIGIN_UNAVAILABLE", "Origin coordinates unavailable", {
        zoneId: input.zoneId
      });
    }
    return {
      point: { lat: city.lat, lng: city.lon, label: city.name },
      originKey: input.zoneId
    };
  }

  if (input.originLatLng) {
    const origin = parseLatLng(input.originLatLng);
    const originKey = `${origin.lat.toFixed(5)},${origin.lng.toFixed(5)}`;
    return { point: origin, originKey };
  }

  throw domainError("ORIGIN_REQUIRED", "zoneId or originLatLng is required");
}

async function fetchRoute(
  provider: TravelProvider,
  input: TravelRouteRequest,
  origin: TravelPoint,
  destination: TravelPoint,
  normalizedBucket?: string
): Promise<RouteResult> {
  try {
    if (input.mode === "transit") {
      if (!normalizedBucket) {
        return { status: "ERROR" };
      }
      const arriveByIso = bucketToNextDateTime(normalizedBucket, new Date(), "Europe/Paris");
      return sanitizeRoute(await provider.routeTransit(origin, destination, arriveByIso));
    }

    return sanitizeRoute(await provider.routeCar(origin, destination));
  } catch {
    return { status: "ERROR" };
  }
}

function sanitizeRoute(result: RouteResult): RouteResult {
  if (!STATUS_VALUES.has(result.status)) {
    return { status: "ERROR" };
  }
  return result;
}

function parseLatLng(value: string): TravelPoint {
  const [latRaw, lngRaw] = value.split(",");
  const lat = Number.parseFloat(latRaw?.trim() ?? "");
  const lng = Number.parseFloat(lngRaw?.trim() ?? "");
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw domainError("INVALID_COORDS", "Invalid coordinates", { value });
  }
  return { lat, lng };
}

function parseCachedRoute(value: string): RouteResult | null {
  try {
    const parsed = JSON.parse(value) as RouteResult;
    if (parsed && typeof parsed.status === "string" && STATUS_VALUES.has(parsed.status)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function buildResponse(
  zoneId: string | null,
  origin: TravelPoint,
  destination: TravelPoint,
  mode: TravelMode,
  timeBucket: string,
  result: RouteResult
): TravelRouteResponse {
  return {
    zoneId,
    origin,
    destination,
    mode,
    timeBucket,
    duration_s: result.duration_s,
    distance_m: result.distance_m,
    status: result.status,
    geometry: result.geometry,
    transitDetails: result.transitDetails
  };
}
