import type { Db } from "@choisir-sa-ville/db";
import type { ApiConfig } from "../server/config.js";

declare module "fastify" {
    interface FastifyInstance {
        config: ApiConfig;
        db?: Db | null;
    }
}
