import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";
import type { Database } from "./types.js";

export type Db = Kysely<Database>;

export type CreateDbOptions = {
  connectionString: string;
};

export function createDb(options: CreateDbOptions): Db;
export function createDb(connectionString: string): Db;
export function createDb(options: CreateDbOptions | string): Db {
  const connectionString =
    typeof options === "string" ? options : options.connectionString;
  const pool = new pg.Pool({ connectionString });
  const dialect = new PostgresDialect({ pool });
  return new Kysely<Database>({ dialect });
}
