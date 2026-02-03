import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(root, "migrations");
const outDir = path.join(root, "dist", "migrations");

await fs.mkdir(outDir, { recursive: true });

const existing = await fs.readdir(outDir);
await Promise.all(
  existing
    .filter((name) => name.endsWith(".js") || name.endsWith(".d.ts") || name.endsWith(".map"))
    .map((name) => fs.rm(path.join(outDir, name)))
);

const entries = await fs.readdir(sourceDir);
const sqlFiles = entries.filter((name) => name.endsWith(".sql")).sort();
await Promise.all(
  sqlFiles.map(async (name) => {
    await fs.copyFile(path.join(sourceDir, name), path.join(outDir, name));
  })
);
