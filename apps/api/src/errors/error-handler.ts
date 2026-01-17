import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { isDomainError } from "./domain-error.js";

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, _request, reply) => {
    app.log.error({ err: error }, "Request error");

    if (error instanceof ZodError) {
      const details = {
        issues: error.issues.map((issue) => ({
          path: issue.path,
          message: issue.message
        }))
      };
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request",
          details
        }
      });
    }

    if (isDomainError(error)) {
      return reply.status(error.httpStatus).send({
        error: {
          code: error.code,
          message: error.message,
          details: error.details ?? {}
        }
      });
    }

    return reply.status(500).send({
      error: {
        code: "INTERNAL_ERROR",
        message: "Internal server error",
        details: {}
      }
    });
  });
}
