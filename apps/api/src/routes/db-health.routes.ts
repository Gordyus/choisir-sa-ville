import type { FastifyInstance } from "fastify";
import { sql } from "kysely";

export const registerDbHealthRoutes = (app: FastifyInstance): void => {
    app.get("/db/health", async (_request, reply) => {
        if (!app.config.databaseUrl) {
            reply.status(500).send({
                error: {
                    code: "DB_UNAVAILABLE",
                    message: "Database not configured"
                }
            });
            return;
        }

        if (!app.db) {
            reply.status(500).send({
                error: {
                    code: "DB_UNAVAILABLE",
                    message: "Database not initialized"
                }
            });
            return;
        }

        try {
            await sql`select 1`.execute(app.db);
            reply.status(200).send({ ok: true });
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Unknown error";

            reply.status(503).send({
                error: {
                    code: "DB_UNAVAILABLE",
                    message: "Database unavailable",
                    details: {
                        reason: message
                    }
                }
            });
        }
    });
};
