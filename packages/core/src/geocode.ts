export type GeocodeNear = {
  lat: number;
  lng: number;
};

export type GeocodeBbox = {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
};

export type GeocodeRequest = {
  query: string;
  near?: GeocodeNear;
  bbox?: GeocodeBbox;
  limit?: number;
};

export type GeocodeCandidate = {
  label: string;
  lat: number;
  lng: number;
  score?: number;
  source?: string;
};

export type GeocodeResponse = {
  candidates: GeocodeCandidate[];
};

export type SearchArea = {
  bbox?: GeocodeBbox | null;
} | null;

export function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ");
}

export function hashBbox(bbox: GeocodeBbox): string {
  const parts = [
    bbox.minLon,
    bbox.minLat,
    bbox.maxLon,
    bbox.maxLat
  ].map((value) => value.toFixed(5));
  return parts.join(",");
}

export function computeNearFromSearchArea(area: SearchArea): GeocodeNear | undefined {
  const bbox = area?.bbox;
  if (!bbox) return undefined;
  return {
    lat: (bbox.minLat + bbox.maxLat) / 2,
    lng: (bbox.minLon + bbox.maxLon) / 2
  };
}

export function computeBboxFromSearchArea(area: SearchArea): GeocodeBbox | undefined {
  return area?.bbox ?? undefined;
}
