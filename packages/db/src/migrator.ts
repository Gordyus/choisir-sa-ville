import type { Migration, MigrationProvider } from "kysely";
import { Migrator } from "kysely";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Db } from "./db.js";

// ESM-safe migration provider (Windows-safe)
class ESMFileMigrationProvider implements MigrationProvider {
  public constructor(private readonly migrationFolder: string) { }

  async getMigrations(): Promise<Record<string, Migration>> {
    const entries = await fs.readdir(this.migrationFolder);

    const migrationFiles = entries.filter((f) => f.endsWith(".js")).sort();

    const migrations: Record<string, Migration> = {};

    for (const fileName of migrationFiles) {
      const fullPath = path.join(this.migrationFolder, fileName);

      // IMPORTANT: convert Windows absolute path to file:// URL
      const moduleUrl = pathToFileURL(fullPath).href;

      const mod = await import(moduleUrl);
      migrations[fileName] = {
        up: mod.up,
        down: mod.down
      };
    }

    return migrations;
  }
}

export function createMigrator(db: Db) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const migrationFolder = path.join(here, "../dist/migrations");
  return new Migrator({
    db,
    provider: new ESMFileMigrationProvider(migrationFolder)
  });
}
