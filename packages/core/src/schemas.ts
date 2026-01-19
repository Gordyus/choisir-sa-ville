import { z } from "zod";

export const TimeBucketSchema = z
  .string()
  .regex(/^(mon|tue|wed|thu|fri|sat|sun)_(?:[01]\d|2[0-3]):(?:00|15|30|45)$/);

export const TimeBucketInputSchema = z
  .string()
  .regex(/^(mon|tue|wed|thu|fri|sat|sun)_(?:[01]\d|2[0-3]):[0-5]\d$/);

const ZonePointSchema = z.object({
  lat: z.number(),
  lng: z.number()
});

const ZonePoiHubSchema = ZonePointSchema.extend({
  label: z.string().optional(),
  kind: z.string().optional()
});

export const ZoneSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  centroid: ZonePointSchema,
  poiHub: ZonePoiHubSchema.optional(),
  geometry: z.unknown().optional(),
  attributes: z.record(z.union([z.number(), z.string(), z.boolean(), z.null()]))
});

/**
 * Common query schema for searching cities.
 * Keep it domain-level, not tied to Fastify.
 */
export const CommuneSearchQuery = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  offset: z.coerce.number().int().min(0).default(0)
});

export const CitySearchQuery = CommuneSearchQuery;

export const CityBBoxQuery = z
  .object({
    minLat: z.coerce.number(),
    minLon: z.coerce.number(),
    maxLat: z.coerce.number(),
    maxLon: z.coerce.number(),
    limit: z.coerce.number().int().min(1).max(500).default(200),
    offset: z.coerce.number().int().min(0).default(0)
  })
  .refine((values) => values.minLat <= values.maxLat, {
    message: "minLat must be <= maxLat",
    path: ["minLat"]
  })
  .refine((values) => values.minLon <= values.maxLon, {
    message: "minLon must be <= maxLon",
    path: ["minLon"]
  });

export const SearchAreaSchema = z.object({
  bbox: z
    .object({
      minLat: z.number(),
      minLon: z.number(),
      maxLat: z.number(),
      maxLon: z.number()
    })
    .refine((values) => values.minLat <= values.maxLat, {
      message: "minLat must be <= maxLat",
      path: ["minLat"]
    })
    .refine((values) => values.minLon <= values.maxLon, {
      message: "minLon must be <= maxLon",
      path: ["minLon"]
    })
});

export const SearchRequestSchema = z.object({
  area: SearchAreaSchema,
  filters: z
    .record(z.union([z.number(), z.string(), z.boolean(), z.null()]))
    .default({}),
  sort: z
    .object({
      key: z.string(),
      direction: z.enum(["asc", "desc"]).default("asc")
    })
    .optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  travel: z
    .object({
      enabled: z.boolean().default(false),
      destinationAddress: z.string().optional(),
      destination: z
        .object({
          lat: z.number(),
          lng: z.number()
        })
        .optional(),
      mode: z.enum(["car", "transit"]).optional(),
      timeBucket: TimeBucketSchema.optional()
    })
    .optional()
});

export const TravelMatrixOriginSchema = z.object({
  zoneId: z.string(),
  lat: z.number(),
  lng: z.number()
});

export const TravelMatrixRequestSchema = z
  .object({
    mode: z.enum(["car", "transit"]),
    destination: z.object({
      lat: z.number(),
      lng: z.number()
    }),
    timeBucket: TimeBucketInputSchema.optional(),
    origins: z.array(TravelMatrixOriginSchema).min(1).max(1000)
  })
  .refine(
    (value) => (value.mode === "transit" ? Boolean(value.timeBucket) : true),
    {
      message: "timeBucket is required for transit",
      path: ["timeBucket"]
    }
  );

export const GeocodeRequestSchema = z
  .object({
    query: z.string().min(1).max(200),
    near: z
      .object({
        lat: z.number(),
        lng: z.number()
      })
      .optional(),
    bbox: z
      .object({
        minLon: z.number(),
        minLat: z.number(),
        maxLon: z.number(),
        maxLat: z.number()
      })
      .optional(),
    limit: z.coerce.number().int().min(1).max(10).optional()
  })
  .refine(
    (values) => {
      if (!values.bbox) return true;
      return values.bbox.minLat <= values.bbox.maxLat;
    },
    { message: "minLat must be <= maxLat", path: ["bbox", "minLat"] }
  )
  .refine(
    (values) => {
      if (!values.bbox) return true;
      return values.bbox.minLon <= values.bbox.maxLon;
    },
    { message: "minLon must be <= maxLon", path: ["bbox", "minLon"] }
  );

export const AreaSuggestQuery = z.object({
  q: z.string().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(20).default(6)
});

const LatLngStringSchema = z
  .string()
  .regex(/^-?\d+(?:\.\d+)?,\s*-?\d+(?:\.\d+)?$/);

export const RouteQuerySchema = z
  .object({
    mode: z.enum(["car", "transit"]),
    zoneId: z.string().optional(),
    originLatLng: LatLngStringSchema.optional(),
    dest: LatLngStringSchema,
    timeBucket: TimeBucketInputSchema.optional()
  })
  .refine((value) => Boolean(value.zoneId || value.originLatLng), {
    message: "zoneId or originLatLng is required",
    path: ["zoneId"]
  })
  .refine((value) => (value.mode === "transit" ? Boolean(value.timeBucket) : true), {
    message: "timeBucket is required for transit",
    path: ["timeBucket"]
  });

export const CommuneByInseeCodeParams = z.object({
  inseeCode: z.string().length(5)
});

export const CityByCommuneCodeParams = z.object({
  communeCode: z.string().regex(/^\d{5}$/)
});

export const CityByIdParams = z.object({
  id: z.string().regex(/^(\d{5}|[a-z0-9]+(?:-[a-z0-9]+)*)$/)
});

export const InfraZoneListQuery = z.object({
  type: z.enum(["ARM", "COMD", "COMA"]).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});
