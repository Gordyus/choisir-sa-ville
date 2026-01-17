import { z } from "zod";

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

export const CommuneByInseeCodeParams = z.object({
  inseeCode: z.string().length(5)
});

export const CityByCommuneCodeParams = z.object({
  communeCode: z.string().regex(/^\d{5}$/)
});

export const InfraZoneListQuery = z.object({
  type: z.enum(["ARM", "COMD", "COMA"]).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});
