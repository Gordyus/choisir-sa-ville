import { createDb } from "@csv/db";
import dotenv from "dotenv";
import path from "node:path";
import { importPostalCodes } from "../postal-codes/importer.js";
import { parseArgs } from "./cli.js";
import { detectDelimiter } from "./csv-utils.js";
import { resolveSourceFile } from "./file-utils.js";
import {
  importCommunes,
  importDepartments,
  importInfraZones,
  importRegions
} from "./importers.js";
import type { ImportOptions, InfraZoneType } from "./types.js";

export async function runInseeImport(args: string[]): Promise<void> {
  const options = parseArgs(args);
  await executeImport(options);
}

async function executeImport(options: ImportOptions): Promise<void> {
  dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL is required.");
    process.exit(1);
  }

  const regionPath = await resolveSourceFile(options.regionSource, options.force);
  const regionDelimiter = await detectDelimiter(regionPath);

  const departmentPath = await resolveSourceFile(options.departmentSource, options.force);
  const departmentDelimiter = await detectDelimiter(departmentPath);

  const sourcePath = await resolveSourceFile(options.source, options.force);
  const delimiter = await detectDelimiter(sourcePath);

  let postalPath: string | null = null;
  let postalDelimiter: string | null = null;
  if (!options.skipPostal) {
    postalPath = await resolveSourceFile(options.postalSource, options.force);
    postalDelimiter = await detectDelimiter(postalPath);
  }

  const db = options.dryRun ? null : createDb(dbUrl);

  try {
    await importRegions(db, regionPath, regionDelimiter, options);
    await importDepartments(db, departmentPath, departmentDelimiter, options);

    const shouldImportCommunes = !options.onlyType || options.onlyType === "COM";
    const shouldImportInfra =
      options.includeInfra && (!options.onlyType || options.onlyType !== "COM");
    const shouldImportPostalCodes = shouldImportCommunes && !options.skipPostal;

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

    if (shouldImportPostalCodes && postalPath && postalDelimiter) {
      await importPostalCodes(db, {
        sourcePath: postalPath,
        delimiter: postalDelimiter,
        dryRun: options.dryRun,
        limit: options.postalLimit
      });
    }
  } finally {
    await db?.destroy();
  }
}
