import { parse } from "csv-parse";
import type { Db } from "@csv/db";
import { BATCH_SIZE, LOG_EVERY } from "./constants.js";
import {
  flushCommuneBatch,
  flushDepartmentBatch,
  flushInfraBatch,
  flushRegionBatch
} from "./db.js";
import { openCsvStream } from "./csv-utils.js";
import {
  mapToCommune,
  mapToDepartment,
  mapToInfraZone,
  mapToRegion
} from "./mappers.js";
import type {
  CommuneInsert,
  DepartmentInsert,
  ImportOptions,
  InfraZoneInsert,
  InfraZoneType,
  RegionInsert
} from "./types.js";

export async function importRegions(
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

  const batch = new Map<string, RegionInsert>();
  let seen = 0;
  let selected = 0;
  let skipped = 0;
  let written = 0;

  for await (const record of parser) {
    seen += 1;
    const mapped = mapToRegion(record as Record<string, string>);
    if ("skip" in mapped) {
      skipped += 1;
      continue;
    }

    selected += 1;
    batch.set(mapped.row.code, mapped.row);

    if (batch.size >= BATCH_SIZE) {
      written += await flushRegionBatch(db, batch, options.dryRun);
    }

    if (options.limit && selected >= options.limit) {
      parser.destroy();
      break;
    }

    if (seen % LOG_EVERY === 0) {
      console.log(
        `Region pass: ${seen} rows (selected ${selected}, written ${written}, skipped ${skipped})`
      );
    }
  }

  written += await flushRegionBatch(db, batch, options.dryRun);

  console.log(
    `Region pass done. Rows: ${seen}. Selected: ${selected}. Written: ${written}. Skipped: ${skipped}.`
  );
}

export async function importDepartments(
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

  const batch = new Map<string, DepartmentInsert>();
  let seen = 0;
  let selected = 0;
  let skipped = 0;
  let written = 0;

  for await (const record of parser) {
    seen += 1;
    const mapped = mapToDepartment(record as Record<string, string>);
    if ("skip" in mapped) {
      skipped += 1;
      continue;
    }

    selected += 1;
    batch.set(mapped.row.code, mapped.row);

    if (batch.size >= BATCH_SIZE) {
      written += await flushDepartmentBatch(db, batch, options.dryRun);
    }

    if (options.limit && selected >= options.limit) {
      parser.destroy();
      break;
    }

    if (seen % LOG_EVERY === 0) {
      console.log(
        `Department pass: ${seen} rows (selected ${selected}, written ${written}, skipped ${skipped})`
      );
    }
  }

  written += await flushDepartmentBatch(db, batch, options.dryRun);

  console.log(
    `Department pass done. Rows: ${seen}. Selected: ${selected}. Written: ${written}. Skipped: ${skipped}.`
  );
}

export async function importCommunes(
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

export async function importInfraZones(
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
