import type { Migration, MigrationProvider } from "kysely";
import { Migrator, sql } from "kysely";
import { existsSync, promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Db } from "./db.js";

class SqlFileMigrationProvider implements MigrationProvider {
  public constructor(private readonly migrationFolder: string) {}

  async getMigrations(): Promise<Record<string, Migration>> {
    const entries = await fs.readdir(this.migrationFolder);

    const migrationFiles = entries.filter((f) => f.endsWith(".sql") && !f.endsWith(".down.sql")).sort();

    const migrations: Record<string, Migration> = {};

    for (const fileName of migrationFiles) {
      const fullPath = path.join(this.migrationFolder, fileName);
      const downPath = fullPath.replace(/\.sql$/i, ".down.sql");

      migrations[fileName] = {
        up: async (db) => {
          const sqlText = await fs.readFile(fullPath, "utf8");
          await sql.raw(sqlText).execute(db);
        },
        down: async (db) => {
          try {
            const downSql = await fs.readFile(downPath, "utf8");
            await sql.raw(downSql).execute(db);
          } catch (error) {
            const code = (error as { code?: string } | null)?.code;
            if (code === "ENOENT") return;
            throw error;
          }
        }
      };
    }

    return migrations;
  }
}

export function createMigrator(db: Db) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const distFolder = path.join(here, "../dist/migrations");
  const sourceFolder = path.join(here, "../migrations");

  const migrationFolder = existsSync(distFolder) ? distFolder : sourceFolder;

  return new Migrator({
    db,
    provider: new SqlFileMigrationProvider(migrationFolder)
  });
}
