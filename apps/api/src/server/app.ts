import fastify, { type FastifyInstance } from "fastify";

import { registerHealthRoutes } from "../routes/health.routes.js";
import { registerVersionRoutes } from "../routes/version.routes.js";

export const createApp = (): FastifyInstance => {
    const app = fastify();

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
        },
        { prefix: "/api" }
    );

    return app;
};
