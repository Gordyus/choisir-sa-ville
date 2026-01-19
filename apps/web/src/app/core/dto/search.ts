export type SearchResultItem = {
  zoneId: string;
  zoneName: string;
  type: string;
  centroid: { lat: number; lng: number };
  attributes: Record<string, number | string | boolean | null>;
  travel?: { status: string } | null;
};

export type SearchResponse = {
  items: SearchResultItem[];
  meta: { limit: number; offset: number; total: number };
};

export type SearchRequest = {
  area: { bbox: { minLat: number; minLon: number; maxLat: number; maxLon: number } };
  filters: Record<string, string>;
  limit: number;
  offset: number;
};
