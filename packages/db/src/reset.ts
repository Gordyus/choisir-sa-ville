import dotenv from "dotenv";
import path from "node:path";
import { sql } from "kysely";
import { createDb } from "./db.js";

dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const db = createDb(url);

// Dev-only helper: drop and recreate the public schema.
await sql`DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;`.execute(db);

await db.destroy();
console.log("Schema reset. Run `pnpm db:migrate` next.");
