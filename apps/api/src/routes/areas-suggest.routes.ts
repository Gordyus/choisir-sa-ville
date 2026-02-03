import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { searchAreas } from "@choisir-sa-ville/db";

const areasSuggestQuerySchema = z.object({
    q: z.string().min(1),
    limit: z.coerce.number().int().min(1).max(20).default(10)
});

type AreasSuggestQuery = z.infer<typeof areasSuggestQuerySchema>;

type ValidationErrorPayload = {
    error: {
        code: "VALIDATION_ERROR";
        message: string;
        details: {
            issues: Array<{ path: (string | number)[]; message: string }>;
        };
    };
};

export const registerAreasSuggestRoutes = (app: FastifyInstance): void => {
    app.get("/areas/suggest", async (request, reply) => {
        const parsed = areasSuggestQuerySchema.safeParse(request.query);

        if (!parsed.success) {
            const payload: ValidationErrorPayload = {
                error: {
                    code: "VALIDATION_ERROR",
                    message: "Invalid request",
                    details: {
                        issues: parsed.error.issues.map((issue) => ({
                            path: issue.path,
                            message: issue.message
                        }))
                    }
                }
            };

            reply.status(400).send(payload);
            return;
        }

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
            reply.status(503).send({
                error: {
                    code: "DB_UNAVAILABLE",
                    message: "Database unavailable"
                }
            });
            return;
        }

        try {
            const params: AreasSuggestQuery = parsed.data;
            const items = await searchAreas(app.db, {
                q: params.q,
                limit: params.limit
            });

            reply.status(200).send({ items });
        } catch (_error) {
            console.error(_error);
            reply.status(503).send({
                error: {
                    code: "DB_UNAVAILABLE",
                    message: "Database unavailable"
                }
            });
        }
    });
};
