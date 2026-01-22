import type { Db } from "@csv/db";
import { parse } from "csv-parse";
import { sql } from "kysely";
import { BATCH_SIZE, LOG_EVERY } from "./constants.js";
import { openCsvStream } from "./csv-utils.js";
import {
  flushCommuneBatch,
  flushCommunePopulationReferenceBatch,
  flushDepartmentBatch,
  flushInfraBatch,
  flushRegionBatch
} from "./db.js";
import type {
  ChildCoordinateIndex,
  OfflineCoordinateIndex,
  PostalCoordinateIndex
} from "./geo-derivation.js";
import {
  deriveCommuneLocation,
  lookupOfflineCoordinates,
  lookupPostalCoordinates
} from "./geo-derivation.js";
import {
  mapToCommune,
  mapToCommunePopulationReference,
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

const MANDATORY_ARRONDISSEMENTS: Record<string, { min: number; max: number }> = {
  "75056": { min: 75101, max: 75120 },
  "69123": { min: 69381, max: 69389 },
  "13055": { min: 13201, max: 13216 }
};

function buildRange(min: number, max: number): string[] {
  const codes: string[] = [];
  for (let code = min; code <= max; code += 1) {
    codes.push(String(code).padStart(5, "0"));
  }
  return codes;
}

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
  options: ImportOptions,
  childIndex: ChildCoordinateIndex,
  postalIndex: PostalCoordinateIndex,
  offlineIndex: OfflineCoordinateIndex
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
  const missingCoordinates: Array<{ code: string; reason: string }> = [];
  const pendingParentInherit: Array<{ childCode: string; parentCode: string }> = [];

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
    const parentCode = mapped.parentCode;
    if (row.lat !== null && row.lon !== null) {
      row.geoSource = "insee";
      row.geoPrecision = "exact";
    } else {
      const derived = deriveCommuneLocation(row.inseeCode, childIndex);
      if (derived?.type === "derived") {
        row.lat = derived.lat;
        row.lon = derived.lon;
        row.geoSource = derived.geoSource;
        row.geoPrecision = derived.geoPrecision;
      } else if (derived?.type === "missing_children") {
        missingCoordinates.push({ code: row.inseeCode, reason: derived.reason });
      } else {
        const postalLookup = lookupPostalCoordinates(row.inseeCode, row.name, postalIndex);
        if (postalLookup.coords) {
          row.lat = postalLookup.coords.lat;
          row.lon = postalLookup.coords.lon;
          row.geoSource = "postal_csv";
          row.geoPrecision = "fallback";
        } else if (parentCode) {
          if (parentCode === row.inseeCode) {
            missingCoordinates.push({
              code: row.inseeCode,
              reason: "inherit_parent parent equals child"
            });
          } else {
            pendingParentInherit.push({ childCode: row.inseeCode, parentCode });
          }
        } else {
          const offlineLookup = lookupOfflineCoordinates(row.inseeCode, offlineIndex);
          if (offlineLookup.coords) {
            row.lat = offlineLookup.coords.lat;
            row.lon = offlineLookup.coords.lon;
            row.geoSource = offlineLookup.coords.source;
            row.geoPrecision = "fallback";
          } else {
            missingCoordinates.push({
              code: row.inseeCode,
              reason: `${postalLookup.reason}; ${offlineLookup.reason}`
            });
          }
        }
      }
    }
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

  if (pendingParentInherit.length > 0) {
    if (!db || options.dryRun) {
      throw new Error(
        `inherit_parent fallback requires a database connection. Pending children: ${pendingParentInherit
          .slice(0, 20)
          .map((item) => `${item.childCode}->${item.parentCode}`)
          .join(", ")}`
      );
    }

    const parentCodes = Array.from(
      new Set(pendingParentInherit.map((item) => item.parentCode))
    );
    const parents = await db
      .selectFrom("commune")
      .select(["inseeCode", "lat", "lon"])
      .where("inseeCode", "in", parentCodes)
      .execute();
    const parentMap = new Map(parents.map((row) => [row.inseeCode, row]));

    const missingParents = pendingParentInherit.filter(
      (item) => !parentMap.has(item.parentCode)
    );
    if (missingParents.length > 0) {
      throw new Error(
        `inherit_parent missing parents: ${missingParents
          .map((item) => `${item.childCode}->${item.parentCode}`)
          .join(", ")}`
      );
    }

    const parentsWithoutCoords = pendingParentInherit.filter((item) => {
      const parent = parentMap.get(item.parentCode);
      return !parent || parent.lat === null || parent.lon === null;
    });
    if (parentsWithoutCoords.length > 0) {
      throw new Error(
        `inherit_parent parents missing coords: ${parentsWithoutCoords
          .map((item) => `${item.childCode}->${item.parentCode}`)
          .join(", ")}`
      );
    }

    const updatesByParent = new Map<string, string[]>();
    for (const item of pendingParentInherit) {
      const list = updatesByParent.get(item.parentCode) ?? [];
      list.push(item.childCode);
      updatesByParent.set(item.parentCode, list);
    }

    for (const [parentCodeValue, childCodes] of updatesByParent) {
      const parent = parentMap.get(parentCodeValue);
      if (!parent || parent.lat === null || parent.lon === null) continue;
      await db
        .updateTable("commune")
        .set({
          lat: parent.lat,
          lon: parent.lon,
          geoSource: "inherit_parent",
          geoPrecision: "fallback",
          updatedAt: sql`now()`
        })
        .where("inseeCode", "in", childCodes)
        .execute();
    }
  }

  if (missingCoordinates.length > 0) {
    const details = missingCoordinates
      .map((item) => `${item.code} (${item.reason})`)
      .join(", ");
    throw new Error(
      `Missing commune coordinates for ${missingCoordinates.length} commune(s): ${details}`
    );
  }

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

export async function assertMandatoryArrondissements(
  db: Db | null,
  options: ImportOptions
): Promise<void> {
  if (!db || options.dryRun) return;

  const expectedCodes = Object.values(MANDATORY_ARRONDISSEMENTS).flatMap((range) =>
    buildRange(range.min, range.max)
  );

  const rows = await db
    .selectFrom("infra_zone")
    .select(["code"])
    .where("type", "=", "ARM")
    .where("code", "in", expectedCodes)
    .execute();

  const found = new Set(rows.map((row) => row.code));
  const missing = expectedCodes.filter((code) => !found.has(code));
  if (missing.length > 0) {
    const optionsInfo = `includeInfra=${options.includeInfra} onlyType=${options.onlyType ?? "all"} source=${options.source}`;
    throw new Error(
      `Missing mandatory arrondissement codes (${missing.length}): ${missing.join(
        ", "
      )}. ${optionsInfo}`
    );
  }
}

export async function importCommunePopulationsReference(
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

  const batch = new Map<string, number>();
  let seen = 0;
  let selected = 0;
  let skipped = 0;
  let written = 0;

  for await (const record of parser) {
    seen += 1;
    const mapped = mapToCommunePopulationReference(record as Record<string, string>);
    if ("skip" in mapped) {
      skipped += 1;
      continue;
    }

    selected += 1;
    batch.set(mapped.inseeCode, mapped.population);

    if (batch.size >= BATCH_SIZE) {
      written += await flushCommunePopulationReferenceBatch(db, batch, options.dryRun);
    }

    if (options.limit && selected >= options.limit) {
      parser.destroy();
      break;
    }

    if (seen % LOG_EVERY === 0) {
      console.log(
        `Population reference pass: ${seen} rows (selected ${selected}, written ${written}, skipped ${skipped})`
      );
    }
  }

  written += await flushCommunePopulationReferenceBatch(db, batch, options.dryRun);

  console.log(
    `Population reference pass done. Rows: ${seen}. Selected: ${selected}. Written: ${written}. Skipped: ${skipped}.`
  );
}
