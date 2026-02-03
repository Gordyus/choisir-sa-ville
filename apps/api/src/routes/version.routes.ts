import type { FastifyInstance } from "fastify";

export const registerVersionRoutes = (app: FastifyInstance): void => {
    app.get("/version", async () => {
        return { name: "choisir-sa-ville", apiVersion: "0.1.0" };
    });
};
