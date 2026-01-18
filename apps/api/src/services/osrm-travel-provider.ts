import type {
  RouteResult,
  TravelMatrixOrigin,
  TravelMatrixResult,
  TravelPoint,
  TravelProvider
} from "@csv/core";

type OsrmOptions = {
  baseUrl: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

type OsrmTableResponse = {
  code?: string;
  durations?: Array<Array<number | null>>;
  distances?: Array<Array<number | null>>;
};

type OsrmRouteResponse = {
  code?: string;
  routes?: Array<{
    duration?: number;
    distance?: number;
    geometry?: { type?: string; coordinates?: Array<[number, number]> };
  }>;
};

const DEFAULT_TIMEOUT_MS = 8000;

export class OsrmTravelProvider implements TravelProvider {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OsrmOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async matrixCar(
    origins: TravelMatrixOrigin[],
    destination: TravelPoint
  ): Promise<TravelMatrixResult[]> {
    if (origins.length === 0) return [];

    const url = buildTableUrl(this.baseUrl, origins, destination);
    const response = await fetchJson<OsrmTableResponse>(this.fetchImpl, url, this.timeoutMs);
    if (!response) {
      return origins.map((origin) => ({ zoneId: origin.zoneId, status: "ERROR" }));
    }

    return mapTableResponse(response, origins);
  }

  async matrixTransit(
    origins: TravelMatrixOrigin[],
    _destination: TravelPoint,
    _arriveByIso: string
  ): Promise<TravelMatrixResult[]> {
    return origins.map((origin) => ({ zoneId: origin.zoneId, status: "ERROR" }));
  }

  async routeCar(origin: TravelPoint, destination: TravelPoint): Promise<RouteResult> {
    const url = buildRouteUrl(this.baseUrl, origin, destination);
    const response = await fetchJson<OsrmRouteResponse>(this.fetchImpl, url, this.timeoutMs);
    if (!response) {
      return { status: "ERROR" };
    }
    return mapRouteResponse(response);
  }

  async routeTransit(
    _origin: TravelPoint,
    _destination: TravelPoint,
    _arriveByIso: string
  ): Promise<RouteResult> {
    return { status: "ERROR" };
  }
}

export function buildTableUrl(
  baseUrl: string,
  origins: TravelMatrixOrigin[],
  destination: TravelPoint
): URL {
  const coords = [...origins, destination].map((point) => formatCoord(point)).join(";");
  const url = new URL(`/table/v1/driving/${coords}`, `${baseUrl}/`);
  const sources = origins.map((_origin, index) => `${index}`).join(";");
  const destinationIndex = origins.length;
  url.searchParams.set("annotations", "duration,distance");
  url.searchParams.set("sources", sources);
  url.searchParams.set("destinations", `${destinationIndex}`);
  return url;
}

export function buildRouteUrl(
  baseUrl: string,
  origin: TravelPoint,
  destination: TravelPoint
): URL {
  const coords = `${formatCoord(origin)};${formatCoord(destination)}`;
  const url = new URL(`/route/v1/driving/${coords}`, `${baseUrl}/`);
  url.searchParams.set("overview", "full");
  url.searchParams.set("geometries", "geojson");
  return url;
}

export function mapTableResponse(
  response: OsrmTableResponse,
  origins: TravelMatrixOrigin[]
): TravelMatrixResult[] {
  if (response.code !== "Ok" || !response.durations) {
    return origins.map((origin) => ({ zoneId: origin.zoneId, status: "ERROR" }));
  }

  return origins.map((origin, index) => {
    const duration = response.durations?.[index]?.[0];
    const distance = response.distances?.[index]?.[0];
    if (duration === null || duration === undefined) {
      return { zoneId: origin.zoneId, status: "NO_ROUTE" };
    }
    if (typeof duration !== "number" || Number.isNaN(duration)) {
      return { zoneId: origin.zoneId, status: "ERROR" };
    }
    return {
      zoneId: origin.zoneId,
      status: "OK",
      duration_s: duration,
      distance_m: typeof distance === "number" ? distance : undefined
    };
  });
}

export function mapRouteResponse(response: OsrmRouteResponse): RouteResult {
  if (response.code === "NoRoute") {
    return { status: "NO_ROUTE" };
  }
  if (response.code !== "Ok") {
    return { status: "ERROR" };
  }
  const route = response.routes?.[0];
  if (!route?.geometry || route.geometry.type !== "LineString") {
    return { status: "ERROR" };
  }
  return {
    status: "OK",
    duration_s: route.duration,
    distance_m: route.distance,
    geometry: {
      type: "LineString",
      coordinates: route.geometry.coordinates ?? []
    }
  };
}

function formatCoord(point: TravelPoint): string {
  return `${point.lng},${point.lat}`;
}

async function fetchJson<T>(
  fetchImpl: typeof fetch,
  url: URL,
  timeoutMs: number
): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url.toString(), { signal: controller.signal });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
