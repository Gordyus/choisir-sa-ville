import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";
import type { Database } from "./types.js";

export type Db = Kysely<Database>;

export function createDb(connectionString: string): Db {
  const pool = new pg.Pool({ connectionString });
  const dialect = new PostgresDialect({ pool });
  return new Kysely<Database>({ dialect });
}
