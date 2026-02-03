import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";

import { createDb, type Db } from "@choisir-sa-ville/db";

export const dbPlugin = fp(async (app: FastifyInstance): Promise<void> => {
    const databaseUrl = app.config.databaseUrl;

    if (!databaseUrl) {
        app.decorate("db", null);
        return;
    }

    const db: Db = createDb({ connectionString: databaseUrl });
    app.decorate("db", db);

    app.addHook("onClose", async (instance) => {
        if (instance.db) {
            await instance.db.destroy();
        }
    });
});
