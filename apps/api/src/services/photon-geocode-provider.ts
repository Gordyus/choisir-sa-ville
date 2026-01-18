import type {
  GeocodeCandidate,
  GeocodeProvider,
  GeocodeRequest,
  GeocodeResponse
} from "@csv/core";
import { normalizeQuery } from "@csv/core";

type PhotonOptions = {
  baseUrl: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    label?: string;
    city?: string;
    state?: string;
    country?: string;
    countrycode?: string;
    postcode?: string;
    score?: number;
  };
};

type PhotonResponse = {
  features?: PhotonFeature[];
};

const DEFAULT_TIMEOUT_MS = 4000;

export class PhotonGeocodeProvider implements GeocodeProvider {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: PhotonOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async geocode(request: GeocodeRequest): Promise<GeocodeResponse> {
    const url = buildPhotonUrl(this.baseUrl, request);
    const response = await fetchJson<PhotonResponse>(this.fetchImpl, url, this.timeoutMs);
    if (!response) {
      return { candidates: [] };
    }
    return mapPhotonResponse(response);
  }
}

export function buildPhotonUrl(baseUrl: string, request: GeocodeRequest): URL {
  const url = new URL("/api", `${baseUrl}/`);
  url.searchParams.set("q", normalizeQuery(request.query));
  url.searchParams.set("lang", "fr");

  if (typeof request.limit === "number") {
    url.searchParams.set("limit", String(request.limit));
  }
  if (request.near) {
    url.searchParams.set("lat", String(request.near.lat));
    url.searchParams.set("lon", String(request.near.lng));
  }
  if (request.bbox) {
    url.searchParams.set(
      "bbox",
      [
        request.bbox.minLon,
        request.bbox.minLat,
        request.bbox.maxLon,
        request.bbox.maxLat
      ].join(",")
    );
  }

  return url;
}

export function mapPhotonResponse(payload: PhotonResponse): GeocodeResponse {
  const features = Array.isArray(payload.features) ? payload.features : [];
  const candidates: GeocodeCandidate[] = [];

  for (const feature of features) {
    const coords = feature.geometry?.coordinates;
    if (!coords || coords.length < 2) continue;
    const [lng, lat] = coords;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const label = buildLabel(feature.properties);
    if (!label) continue;
    if (!isFrance(feature.properties, label)) continue;

    const score =
      typeof feature.properties?.score === "number" ? feature.properties.score : undefined;

    candidates.push({
      label,
      lat,
      lng,
      score,
      source: "photon"
    });
  }

  return { candidates };
}

function buildLabel(props: PhotonFeature["properties"]): string {
  if (!props) return "";
  if (props.label && props.label.trim().length > 0) return props.label.trim();

  const parts = [props.name, props.city, props.state, props.country]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value && value.length > 0));

  if (parts.length === 0) return "";
  const label = parts.join(", ");
  if (props.postcode && props.postcode.trim().length > 0) {
    return `${label} ${props.postcode.trim()}`;
  }
  return label;
}

function isFrance(props: PhotonFeature["properties"], label: string): boolean {
  if (!props) return false;
  const countryCode = props.countrycode?.trim().toLowerCase();
  if (countryCode === "fr") return true;

  const country = props.country?.trim().toLowerCase();
  if (country && country.includes("france")) return true;

  const normalizedLabel = label.trim().toLowerCase();
  if (normalizedLabel.includes("france")) return true;

  return false;
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
