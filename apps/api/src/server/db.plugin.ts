import type { FastifyInstance } from "fastify";

import { createDb, type Db } from "@choisir-sa-ville/db";

export type DbPluginOptions = {
    databaseUrl?: string;
};

export const registerDbPlugin = async (
    app: FastifyInstance,
    options: DbPluginOptions
): Promise<void> => {
    const databaseUrl = options.databaseUrl;

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
};
