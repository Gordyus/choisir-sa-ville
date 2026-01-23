import fastify, { type FastifyInstance } from "fastify";

import { dbPlugin } from "../plugins/db.plugin.js";
import { registerDbHealthRoutes } from "../routes/db-health.routes.js";
import { registerHealthRoutes } from "../routes/health.routes.js";
import { registerVersionRoutes } from "../routes/version.routes.js";
import type { ApiConfig } from "./config.js";

export const createApp = (config: ApiConfig): FastifyInstance => {
    const app = fastify();

    app.decorate("config", config);
    app.register(dbPlugin);

    app.setNotFoundHandler((_request, reply) => {
        reply.status(404).send({
            error: {
                code: "NOT_FOUND",
                message: "Not found"
            }
        });
    });

    app.setErrorHandler((_error, _request, reply) => {
        reply.status(500).send({
            error: {
                code: "INTERNAL_ERROR",
                message: "Internal error"
            }
        });
    });

    app.register(
        async (api) => {
            registerHealthRoutes(api);
            registerVersionRoutes(api);
            registerDbHealthRoutes(api);
        },
        { prefix: "/api" }
    );

    return app;
};
