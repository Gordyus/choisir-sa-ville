import type { Db } from "@choisir-sa-ville/db";

declare module "fastify" {
    interface FastifyInstance {
        db: Db | null;
    }
}
