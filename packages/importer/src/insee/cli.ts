import {
  DEFAULT_DEPARTMENT_SOURCE_URL,
  DEFAULT_POSTAL_SOURCE_URL,
  DEFAULT_REGION_SOURCE_URL,
  DEFAULT_SOURCE_URL
} from "./constants.js";
import type { ImportOnlyType, ImportOptions } from "./types.js";

function printUsage(): void {
  console.log(`Usage: pnpm -C packages/importer import:insee [options]

Options:
  --source <url>              Override dataset URL
  --region-source <url>       Override regions dataset URL
  --department-source <url>   Override departments dataset URL
  --postal-source <url>       Override postal codes dataset URL
  --skip-postal               Skip postal codes import
  --postal-limit <n>          Stop after N valid postal pairs
  --force                     Redownload source file
  --limit <n>                 Stop after N valid rows per phase
  --dry-run                   Parse and report stats without DB writes
  --only-type COM|ARM|COMD|COMA  Import only one INSEE type
  --include-infra true|false  Include infra zones (default: true)
`);
}

export function parseArgs(args: string[]): ImportOptions {
  const options: ImportOptions = {
    source: DEFAULT_SOURCE_URL,
    regionSource: DEFAULT_REGION_SOURCE_URL,
    departmentSource: DEFAULT_DEPARTMENT_SOURCE_URL,
    postalSource: DEFAULT_POSTAL_SOURCE_URL,
    skipPostal: false,
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
    if (arg === "--region-source") {
      const value = args[i + 1];
      if (!value) throw new Error("Missing value for --region-source");
      options.regionSource = value;
      i += 1;
      continue;
    }
    if (arg === "--department-source") {
      const value = args[i + 1];
      if (!value) throw new Error("Missing value for --department-source");
      options.departmentSource = value;
      i += 1;
      continue;
    }
    if (arg === "--postal-source") {
      const value = args[i + 1];
      if (!value) throw new Error("Missing value for --postal-source");
      options.postalSource = value;
      i += 1;
      continue;
    }
    if (arg === "--skip-postal") {
      const value = args[i + 1];
      if (value && !value.startsWith("--")) {
        const normalized = value.toLowerCase();
        if (normalized !== "true" && normalized !== "false") {
          throw new Error("Invalid --skip-postal value (use true|false)");
        }
        options.skipPostal = normalized === "true";
        i += 1;
      } else {
        options.skipPostal = true;
      }
      continue;
    }
    if (arg === "--postal-limit") {
      const value = args[i + 1];
      if (!value) throw new Error("Missing value for --postal-limit");
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error("Invalid --postal-limit value");
      }
      options.postalLimit = parsed;
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
