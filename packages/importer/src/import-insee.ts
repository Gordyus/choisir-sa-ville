import { createDb, type Database, type Db } from "@csv/db";
import { parse } from "csv-parse";
import dotenv from "dotenv";
import { sql, type Insertable } from "kysely";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import unzipper from "unzipper";

type InfraZoneType = "ARM" | "COMD" | "COMA";
type ImportOnlyType = "COM" | InfraZoneType;

type ImportOptions = {
  source: string;
  force: boolean;
  limit?: number;
  dryRun: boolean;
  onlyType?: ImportOnlyType;
  includeInfra: boolean;
};

type CommuneInsert = Insertable<Database["commune"]>;
type InfraZoneInsert = Insertable<Database["infra_zone"]>;

const DEFAULT_SOURCE_URL =
  "https://www.insee.fr/fr/statistiques/fichier/8377162/v_commune_2025.csv";
const CACHE_DIR = ".cache";
const BATCH_SIZE = 500;
const LOG_EVERY = 1000;

function printUsage(): void {
  console.log(`Usage: pnpm -C packages/importer import:insee [options]

Options:
  --source <url>              Override dataset URL
  --force                     Redownload source file
  --limit <n>                 Stop after N valid rows per phase
  --dry-run                   Parse and report stats without DB writes
  --only-type COM|ARM|COMD|COMA  Import only one INSEE type
  --include-infra true|false  Include infra zones (default: true)
`);
}

function parseArgs(args: string[]): ImportOptions {
  const options: ImportOptions = {
    source: DEFAULT_SOURCE_URL,
    force: false,
    dryRun: false,
    includeInfra: true
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--source") {
      const value = args[i + 1];
      if (!value) throw new Error("Missing value for --source");
      options.source = value;
      i += 1;
      continue;
    }
    if (arg === "--force") {
      options.force = true;
      continue;
    }
    if (arg === "--limit") {
      const value = args[i + 1];
      if (!value) throw new Error("Missing value for --limit");
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error("Invalid --limit value");
      }
      options.limit = parsed;
      i += 1;
      continue;
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--only-type") {
      const value = args[i + 1]?.toUpperCase();
      if (!value) throw new Error("Missing value for --only-type");
      if (!["COM", "ARM", "COMD", "COMA"].includes(value)) {
        throw new Error("Invalid --only-type value");
      }
      options.onlyType = value as ImportOnlyType;
      i += 1;
      continue;
    }
    if (arg === "--include-infra") {
      const value = args[i + 1];
      if (!value) throw new Error("Missing value for --include-infra");
      const normalized = value.toLowerCase();
      if (normalized !== "true" && normalized !== "false") {
        throw new Error("Invalid --include-infra value (use true|false)");
      }
      options.includeInfra = normalized === "true";
      i += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function isHttpUrl(source: string): boolean {
  return source.startsWith("http://") || source.startsWith("https://");
}

function isFileUrl(source: string): boolean {
  return source.startsWith("file://");
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fsPromises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function downloadFile(url: string, destination: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }
  if (!response.body) {
    throw new Error("Download failed: empty response body");
  }

  await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(destination));
}

async function resolveSourceFile(source: string, force: boolean): Promise<string> {
  if (isHttpUrl(source)) {
    await fsPromises.mkdir(CACHE_DIR, { recursive: true });
    const url = new URL(source);
    const fileName = path.basename(url.pathname) || "insee-source.csv";
    const cachedPath = path.join(CACHE_DIR, fileName);

    if (!force && (await fileExists(cachedPath))) {
      console.log(`Using cached file: ${cachedPath}`);
      return cachedPath;
    }

    console.log(`Downloading ${source}`);
    await downloadFile(source, cachedPath);
    return cachedPath;
  }

  if (isFileUrl(source)) {
    const localPath = fileURLToPath(source);
    if (!(await fileExists(localPath))) {
      throw new Error(`Source file not found: ${localPath}`);
    }
    return localPath;
  }

  const localPath = path.resolve(source);
  if (!(await fileExists(localPath))) {
    throw new Error(`Source file not found: ${localPath}`);
  }
  return localPath;
}

async function openCsvStream(filePath: string): Promise<{
  stream: Readable;
  isZip: boolean;
  entryName?: string;
}> {
  if (filePath.toLowerCase().endsWith(".zip")) {
    const directory = await unzipper.Open.file(filePath);
    const entry = directory.files.find(
      (file) => file.type === "File" && file.path.toLowerCase().endsWith(".csv")
    );
    if (!entry) {
      throw new Error("No CSV file found in zip archive");
    }
    return { stream: entry.stream() as Readable, isZip: true, entryName: entry.path };
  }
  return { stream: fs.createReadStream(filePath), isZip: false };
}

async function readFirstLineFromStream(stream: Readable): Promise<string> {
  let buffer = "";
  for await (const chunk of stream) {
    buffer += chunk.toString("utf8");
    const newlineIndex = buffer.indexOf("\n");
    if (newlineIndex !== -1) {
      stream.destroy();
      return buffer.slice(0, newlineIndex);
    }
    if (buffer.length > 4096) {
      stream.destroy();
      return buffer;
    }
  }
  return buffer;
}

async function detectDelimiter(filePath: string): Promise<string> {
  if (!filePath.toLowerCase().endsWith(".zip")) {
    const handle = await fsPromises.open(filePath, "r");
    const buffer = Buffer.alloc(4096);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    await handle.close();

    const sample = buffer.toString("utf8", 0, bytesRead);
    const firstLine = sample.split(/\r?\n/)[0] ?? "";
    const semicolons = (firstLine.match(/;/g) ?? []).length;
    const commas = (firstLine.match(/,/g) ?? []).length;

    return semicolons >= commas ? ";" : ",";
  }

  const { stream } = await openCsvStream(filePath);
  const line = await readFirstLineFromStream(stream);
  const semicolons = (line.match(/;/g) ?? []).length;
  const commas = (line.match(/,/g) ?? []).length;
  return semicolons >= commas ? ";" : ",";
}

function normalizeRecord(record: Record<string, string>): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    normalized[key.trim().toLowerCase()] = typeof value === "string" ? value.trim() : value;
  }
  return normalized;
}

function pickValue(record: Record<string, string>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return undefined;
}

function normalizeCode(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().toUpperCase();
  return trimmed.length === 0 ? null : trimmed;
}

function normalizeInseeCode(value: string | undefined): string | null {
  const trimmed = normalizeCode(value);
  if (!trimmed || trimmed.length !== 5) return null;
  return trimmed;
}

function parseInteger(value: string | undefined): number | null {
  if (!value) return null;
  const cleaned = value.replace(/\s/g, "").replace(",", ".");
  const parsed = Number.parseInt(cleaned, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const cleaned = value.replace(/\s/g, "").replace(",", ".");
  const parsed = Number.parseFloat(cleaned);
  return Number.isNaN(parsed) ? null : parsed;
}

function isInfraZoneType(type: string | null): type is InfraZoneType {
  return type === "ARM" || type === "COMD" || type === "COMA";
}

type CommuneMapResult = { row: CommuneInsert } | { skip: "ignored" | "invalid" };

function mapToCommune(record: Record<string, string>): CommuneMapResult {
  const normalized = normalizeRecord(record);
  const typecom = normalizeCode(pickValue(normalized, ["typecom"]));
  if (typecom !== "COM") return { skip: "ignored" };

  const inseeCode = normalizeInseeCode(
    pickValue(normalized, ["com", "insee_code", "code_insee", "codgeo"])
  );
  const name = pickValue(normalized, ["libelle", "libelle_geo", "nccenr", "ncc", "nom"]);

  if (!inseeCode || !name) return { skip: "invalid" };

  return {
    row: {
      inseeCode,
      name: name.trim(),
      population: parseInteger(
        pickValue(normalized, ["population", "pop_total", "pmun"])
      ),
      departmentCode: normalizeCode(
        pickValue(normalized, ["dep", "departement", "department_code"])
      ),
      regionCode: normalizeCode(pickValue(normalized, ["reg", "region", "region_code"])),
      lat: parseNumber(pickValue(normalized, ["lat", "latitude", "latitude_deg"])),
      lon: parseNumber(pickValue(normalized, ["lon", "longitude", "longitude_deg"]))
    }
  };
}

type InfraZoneMapResult =
  | { row: InfraZoneInsert }
  | { skip: "ignored" | "invalid" | "missing_parent" };

function mapToInfraZone(record: Record<string, string>): InfraZoneMapResult {
  const normalized = normalizeRecord(record);
  const typecom = normalizeCode(pickValue(normalized, ["typecom"]));
  if (!typecom || typecom === "COM") return { skip: "ignored" };
  if (!isInfraZoneType(typecom)) return { skip: "ignored" };

  const code = normalizeInseeCode(
    pickValue(normalized, ["com", "insee_code", "code_insee", "codgeo"])
  );
  const parentCommuneCode = normalizeInseeCode(
    pickValue(normalized, ["comparent", "parent", "parent_commune"])
  );
  const name = pickValue(normalized, ["libelle", "libelle_geo", "nccenr", "ncc", "nom"]);

  if (!code || !name) return { skip: "invalid" };
  if (!parentCommuneCode) return { skip: "missing_parent" };

  return {
    row: {
      id: `${typecom}:${code}`,
      type: typecom,
      code,
      parentCommuneCode,
      name: name.trim()
    }
  };
}

async function flushCommuneBatch(
  db: Db | null,
  batch: Map<string, CommuneInsert>,
  dryRun: boolean
): Promise<number> {
  if (batch.size === 0) return 0;

  const values = Array.from(batch.values());
  batch.clear();

  if (dryRun) return values.length;
  if (!db) throw new Error("Database connection is not initialized.");

  await db
    .insertInto("commune")
    .values(values)
    .onConflict((oc) =>
      oc.column("inseeCode").doUpdateSet((eb) => ({
        name: eb.ref("excluded.name"),
        population: eb.ref("excluded.population"),
        departmentCode: eb.ref("excluded.departmentCode"),
        regionCode: eb.ref("excluded.regionCode"),
        lat: eb.ref("excluded.lat"),
        lon: eb.ref("excluded.lon"),
        updatedAt: sql`now()`
      }))
    )
    .execute();

  return values.length;
}

async function flushInfraBatch(
  db: Db | null,
  batch: Map<string, InfraZoneInsert>,
  dryRun: boolean
): Promise<number> {
  if (batch.size === 0) return 0;

  const values = Array.from(batch.values());
  batch.clear();

  if (dryRun) return values.length;
  if (!db) throw new Error("Database connection is not initialized.");

  await db
    .insertInto("infra_zone")
    .values(values)
    .onConflict((oc) =>
      oc.columns(["type", "code"]).doUpdateSet((eb) => ({
        parentCommuneCode: eb.ref("excluded.parentCommuneCode"),
        name: eb.ref("excluded.name"),
        updatedAt: sql`now()`
      }))
    )
    .execute();

  return values.length;
}

async function importCommunes(
  db: Db | null,
  sourcePath: string,
  delimiter: string,
  options: ImportOptions
): Promise<void> {
  const { stream, entryName } = await openCsvStream(sourcePath);
  if (entryName) {
    console.log(`Using CSV entry: ${entryName}`);
  }

  const parser = parse({
    columns: true,
    delimiter,
    bom: true,
    trim: true,
    relax_column_count: true,
    skip_empty_lines: true
  });

  stream.pipe(parser);

  const batch = new Map<string, CommuneInsert>();
  let seen = 0;
  let selected = 0;
  let skipped = 0;
  let ignored = 0;
  let written = 0;

  for await (const record of parser) {
    seen += 1;
    const mapped = mapToCommune(record as Record<string, string>);
    if ("skip" in mapped) {
      if (mapped.skip === "invalid") {
        skipped += 1;
      } else {
        ignored += 1;
      }
      continue;
    }

    const row = mapped.row;
    selected += 1;
    batch.set(row.inseeCode, row);

    if (batch.size >= BATCH_SIZE) {
      written += await flushCommuneBatch(db, batch, options.dryRun);
    }

    if (options.limit && selected >= options.limit) {
      parser.destroy();
      break;
    }

    if (seen % LOG_EVERY === 0) {
      console.log(
        `Commune pass: ${seen} rows (selected ${selected}, written ${written}, skipped ${skipped}, ignored ${ignored})`
      );
    }
  }

  written += await flushCommuneBatch(db, batch, options.dryRun);

  console.log(
    `Commune pass done. Rows: ${seen}. Selected: ${selected}. Written: ${written}. Skipped: ${skipped}. Ignored: ${ignored}.`
  );
}

async function importInfraZones(
  db: Db | null,
  sourcePath: string,
  delimiter: string,
  options: ImportOptions,
  onlyType?: InfraZoneType
): Promise<void> {
  const { stream, entryName } = await openCsvStream(sourcePath);
  if (entryName) {
    console.log(`Using CSV entry: ${entryName}`);
  }

  const parser = parse({
    columns: true,
    delimiter,
    bom: true,
    trim: true,
    relax_column_count: true,
    skip_empty_lines: true
  });

  stream.pipe(parser);

  const batch = new Map<string, InfraZoneInsert>();
  let seen = 0;
  let selected = 0;
  let skipped = 0;
  let missingParent = 0;
  let ignored = 0;
  let written = 0;

  for await (const record of parser) {
    seen += 1;
    const result = mapToInfraZone(record as Record<string, string>);
    if ("skip" in result) {
      if (result.skip === "missing_parent") {
        missingParent += 1;
      } else if (result.skip === "invalid") {
        skipped += 1;
      } else {
        ignored += 1;
      }
      continue;
    }

    if (onlyType && result.row.type !== onlyType) {
      ignored += 1;
      continue;
    }

    selected += 1;
    batch.set(`${result.row.type}:${result.row.code}`, result.row);

    if (batch.size >= BATCH_SIZE) {
      written += await flushInfraBatch(db, batch, options.dryRun);
    }

    if (options.limit && selected >= options.limit) {
      parser.destroy();
      break;
    }

    if (seen % LOG_EVERY === 0) {
      console.log(
        `Infra pass: ${seen} rows (selected ${selected}, written ${written}, skipped ${skipped}, missingParent ${missingParent}, ignored ${ignored})`
      );
    }
  }

  written += await flushInfraBatch(db, batch, options.dryRun);

  console.log(
    `Infra pass done. Rows: ${seen}. Selected: ${selected}. Written: ${written}. Skipped: ${skipped}. Missing parent: ${missingParent}. Ignored: ${ignored}.`
  );
}

async function run(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL is required.");
    process.exit(1);
  }

  const sourcePath = await resolveSourceFile(options.source, options.force);
  const delimiter = await detectDelimiter(sourcePath);

  const db = options.dryRun ? null : createDb(dbUrl);

  try {
    const shouldImportCommunes =
      !options.onlyType || options.onlyType === "COM";
    const shouldImportInfra =
      options.includeInfra &&
      (!options.onlyType || options.onlyType !== "COM");

    if (shouldImportCommunes) {
      await importCommunes(db, sourcePath, delimiter, options);
    }

    if (shouldImportInfra) {
      const infraOnlyType =
        options.onlyType && options.onlyType !== "COM"
          ? (options.onlyType as InfraZoneType)
          : undefined;
      await importInfraZones(db, sourcePath, delimiter, options, infraOnlyType);
    }
  } finally {
    await db?.destroy();
  }
}

try {
  await run();
} catch (error) {
  console.error(error);
  process.exit(1);
}
