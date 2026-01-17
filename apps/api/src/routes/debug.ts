import type { FastifyPluginAsync } from "fastify";
import { domainError } from "../errors/domain-error.js";

export const debugRoute: FastifyPluginAsync = async (app) => {
  app.get("/debug/domain-error", async () => {
    throw domainError("DEBUG_DOMAIN_ERROR", "Debug domain error");
  });
};
