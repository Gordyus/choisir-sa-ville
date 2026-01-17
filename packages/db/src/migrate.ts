import dotenv from "dotenv";
import path from "node:path";
import { createDb } from "./db.js";
import { createMigrator } from "./migrator.js";

dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const db = createDb(url);
const migrator = createMigrator(db);

const { error, results } = await migrator.migrateToLatest();

results?.forEach((r) => {
  if (r.status === "Success") console.log(`✅ ${r.migrationName}`);
  if (r.status === "Error") console.log(`❌ ${r.migrationName}`);
});

if (error) {
  console.error(error);
  await db.destroy();
  process.exit(1);
}

await db.destroy();
console.log("Done.");
