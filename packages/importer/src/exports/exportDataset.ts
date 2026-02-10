import { readFile } from "node:fs/promises";
import path from "node:path";

import { exportIndexLite } from "./communes/exportIndexLite.js";
import { exportMetricsCore } from "./communes/exportMetricsCore.js";
import { exportMetricsHousing } from "./communes/exportMetricsHousing.js";
import { exportPostalIndex } from "./communes/exportPostalIndex.js";
import { exportMetricsInsecurity } from "./communes/metrics/insecurity/exportMetricsInsecurity.js";
import { SOURCE_URLS, type SourceKey } from "./constants.js";
import { exportTransactions } from "./transactions/exportTransactions.js";
import { buildDvfSourceEntries } from "./transactions/dvfGeoDvfSources.js";
import { exportInfraZonesIndexLite } from "./infra-zones/exportIndexLite.js";
import { downloadFile } from "./shared/downloadFile.js";
import { ensureDir, writeJsonAtomic } from "./shared/fileSystem.js";
import { parseCsv, parseCsvFile, type CsvRecord } from "./shared/parseCsv.js";
import { readZipEntryText } from "./shared/readZipEntry.js";
import type { ExportCommune, ExportContext, ExportInfraZone, PostalRecord, SourceMeta, DvfSourceMeta } from "./shared/types.js";
import { writeManifest } from "./writeManifest.js";

async function main(): Promise<void> {
    const datasetVersion = computeDatasetVersion();
    const { datasetDir, currentManifestPath } = await resolveDatasetDir(datasetVersion);
    const context: ExportContext = { datasetDir, datasetVersion };

    console.info(`[dataset] Target directory: ${datasetDir}`);

    const { standardSources, dvfSources } = await downloadSources();
    const [communeRecords, regionRecords, departmentRecords, postalRecordsRaw] = await Promise.all([
        parseCsvFile(standardSources.communes.filePath),
        parseCsvFile(standardSources.regions.filePath),
        parseCsvFile(standardSources.departments.filePath),
        parseCsvFile(standardSources.postal.filePath)
    ]);
    const populationCsv = await readZipEntryText(standardSources.populationRef.filePath, "donnees_communes.csv");
    const populationRecords = parseCsv(populationCsv);

    const departmentRegionMap = buildDepartmentRegionMap(departmentRecords);
    const communes = mapCommunes(communeRecords, departmentRegionMap);
    const parentChildrenMap = buildParentChildrenMap(communeRecords);
    const infraZones = mapInfraZones(communeRecords);
    const postalRecords = mapPostalRecords(postalRecordsRaw);
    const populationByInsee = buildPopulationByInsee(populationRecords);

    console.info(
        `[dataset] Loaded ${communes.length} communes (${postalRecords.length} postal rows, ${departmentRegionMap.size} departments, ${populationByInsee.size} populations)`
    );

    const files: string[] = [];
    files.push(await exportIndexLite({ context, communes, postalRecords, parentChildrenMap, populationByInsee }));

    const communeCoordsByInsee = await readCommuneCoordsByInsee(context.datasetDir);
    files.push(
        await exportInfraZonesIndexLite({
            context,
            infraZones,
            postalRecords,
            populationByInsee,
            communeCoordsByInsee
        })
    );
    files.push(await exportPostalIndex({ context, postalRecords }));
    files.push(await exportMetricsCore({ context, communes }));
    files.push(await exportMetricsHousing({ context, communes }));
    files.push(
        ...(await exportMetricsInsecurity({
            context,
            communes,
            ssmsiSource: standardSources.ssmsi
        }))
    );

    // DVF transactions — per-department annual files from geo-dvf
    const communeNameByInsee = new Map<string, string>();
    for (const c of communes) {
        communeNameByInsee.set(c.insee, c.name);
    }
    files.push(
        ...(await exportTransactions({
            context,
            dvfSources,
            communeNameByInsee
        }))
    );

    const allSources: SourceMeta[] = [
        ...Object.values(standardSources),
        ...dvfSources
    ];
    await writeManifest({ datasetDir, datasetVersion, files, sources: allSources });
    await writeCurrentManifest({ currentManifestPath, datasetVersion, files });

    console.info(
        `[dataset] Completed static export (${files.length} files) for ${datasetVersion}`
    );
}

main().catch((error) => {
    console.error("[dataset] Export failed", error);
    process.exitCode = 1;
});

async function resolveDatasetDir(datasetVersion: string): Promise<{
    datasetDir: string;
    currentManifestPath: string;
}> {
    const packageRoot = path.resolve(process.cwd());
    const repoRoot = path.resolve(packageRoot, "../..");
    const datasetDir = path.join(repoRoot, "apps", "web", "public", "data", datasetVersion);
    const currentManifestPath = path.join(repoRoot, "apps", "web", "public", "data", "current", "manifest.json");
    await ensureDir(datasetDir);
    return { datasetDir, currentManifestPath };
}

async function downloadSources(): Promise<{
    standardSources: Record<SourceKey, SourceMeta>;
    dvfSources: DvfSourceMeta[];
}> {
    // Standard sources (INSEE, postal, SSMSI)
    console.info("[download] Fetching standard sources...");
    const entries = Object.entries(SOURCE_URLS) as [SourceKey, string][];
    const pairs = await Promise.all(
        entries.map(async ([key, url]) => {
            const cacheTtlMs = key === "ssmsi" ? 90 * 24 * 60 * 60 * 1000 : undefined;
            if (typeof cacheTtlMs === "number") {
                return [key, await downloadFile(url, { cacheTtlMs })] as const;
            }
            return [key, await downloadFile(url)] as const;
        })
    );
    const standardSources = Object.fromEntries(pairs) as unknown as Record<SourceKey, SourceMeta>;

    // DVF geo-dvf sources (per-department, per-year)
    const dvfEntries = await buildDvfSourceEntries();
    console.info(`[download] Fetching ${dvfEntries.length} DVF geo-dvf files...`);
    const dvfSources: DvfSourceMeta[] = await Promise.all(
        dvfEntries.map(async ({ year, department, url, cacheTtlMs }) => {
            const destinationPath = path.join(process.cwd(), "dvf-source", String(year), "departements", `${department}.csv.gz`);
            const meta = await downloadFile(url, { cacheTtlMs, destinationPath });
            const cached = meta.fromCache ? " (cached)" : "";
            console.info(`  ✓ DVF ${year} dept ${department}${cached}`);
            return { ...meta, year, department };
        })
    );

    console.info(`[download] All sources downloaded (${entries.length} standard + ${dvfSources.length} DVF)`);
    return { standardSources, dvfSources };
}

function computeDatasetVersion(referenceDate = new Date()): string {
    const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Paris",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    });

    let year = "";
    let month = "";
    let day = "";
    for (const part of formatter.formatToParts(referenceDate)) {
        if (part.type === "year") year = part.value;
        if (part.type === "month") month = part.value;
        if (part.type === "day") day = part.value;
    }

    return `v${year}-${month}-${day}`;
}

async function writeCurrentManifest(params: {
    currentManifestPath: string;
    datasetVersion: string;
    files: string[];
}): Promise<void> {
    await writeJsonAtomic(params.currentManifestPath, {
        datasetVersion: params.datasetVersion,
        files: params.files.slice().sort()
    });
}

function mapCommunes(records: CsvRecord[], departmentRegionMap: Map<string, string | null>): ExportCommune[] {
    const communes = new Map<string, ExportCommune>();
    for (const record of records) {
        const normalized = normalizeRecord(record);
        const typecom = (normalized.get("typecom") ?? "").toUpperCase();
        if (typecom !== "COM") continue;

        const insee = normalizeInseeCode(pickFirst(normalized, ["com", "codgeo", "code", "insee"]));
        if (!insee) continue;

        const name = pickFirst(normalized, ["libelle", "nccenr", "ncc", "nom"]);
        if (!name) continue;

        const departmentCode = normalizeCode(pickFirst(normalized, ["dep", "departement", "department"]));
        let regionCode = normalizeCode(pickFirst(normalized, ["reg", "region", "region_code"]));
        if (!regionCode && departmentCode && departmentRegionMap.has(departmentCode)) {
            regionCode = departmentRegionMap.get(departmentCode) ?? null;
        }

        communes.set(insee, {
            insee,
            name,
            departmentCode,
            regionCode
        });
    }
    return Array.from(communes.values());
}

function mapInfraZones(records: CsvRecord[]): ExportInfraZone[] {
    const infraZones = new Map<string, ExportInfraZone>();

    for (const record of records) {
        const normalized = normalizeRecord(record);
        const typecom = (normalized.get("typecom") ?? "").toUpperCase();
        if (!["ARM", "COMD", "COMA"].includes(typecom)) continue;

        const code = normalizeInseeCode(pickFirst(normalized, ["com", "codgeo", "code", "insee"]));
        if (!code) continue;

        const parentCommuneCode = normalizeInseeCode(
            pickFirst(normalized, ["comparent", "parent", "parent_commune", "parentcommune"])
        );
        if (!parentCommuneCode) continue;

        const name = pickFirst(normalized, ["libelle", "libelle_geo", "nccenr", "ncc", "nom"]);
        if (!name) continue;

        const id = `${typecom}:${code}`;
        infraZones.set(id, {
            id,
            type: typecom as ExportInfraZone["type"],
            code,
            parentCommuneCode,
            name
        });
    }

    return Array.from(infraZones.values());
}

function buildDepartmentRegionMap(records: CsvRecord[]): Map<string, string | null> {
    const map = new Map<string, string | null>();
    for (const record of records) {
        const normalized = normalizeRecord(record);
        const departmentCode = normalizeCode(pickFirst(normalized, ["dep", "code", "department_code"]));
        if (!departmentCode) continue;
        const regionCode = normalizeCode(pickFirst(normalized, ["reg", "region", "region_code"]));
        map.set(departmentCode, regionCode);
    }
    return map;
}

function buildParentChildrenMap(records: CsvRecord[]): Map<string, string[]> {
    const map = new Map<string, string[]>();

    for (const record of records) {
        const normalized = normalizeRecord(record);
        const typecom = (normalized.get("typecom") ?? "").toUpperCase();
        if (!["ARM", "COMD", "COMA"].includes(typecom)) continue;

        const childCode = normalizeInseeCode(pickFirst(normalized, ["com", "codgeo", "code", "insee"]));
        if (!childCode) continue;

        const parentCode = normalizeInseeCode(
            pickFirst(normalized, ["comparent", "parent", "parent_commune", "parentcommune"])
        );
        if (!parentCode) continue;

        const list = map.get(parentCode) ?? [];
        list.push(childCode);
        map.set(parentCode, list);
    }

    for (const [parent, children] of map) {
        children.sort((a, b) => a.localeCompare(b));
        map.set(parent, Array.from(new Set(children)));
    }

    return map;
}

function mapPostalRecords(records: CsvRecord[]): PostalRecord[] {
    const mapped: PostalRecord[] = [];
    for (const record of records) {
        const normalized = normalizeRecord(record);
        const insee = normalizeInseeCode(pickFirst(normalized, ["code_commune_insee", "insee", "com", "codgeo"]));
        if (!insee) continue;
        const postalCode = normalizePostalCode(pickFirst(normalized, ["code_postal", "postal", "codepostal"]));
        if (!postalCode) continue;

        const { lat, lng } = extractCoordinates(normalized);
        mapped.push({
            insee,
            postalCode,
            lat,
            lng
        });
    }
    return mapped;
}

async function readCommuneCoordsByInsee(
    datasetDir: string
): Promise<Map<string, { lat: number; lng: number } | null>> {
    const filePath = path.join(datasetDir, "communes", "indexLite.json");
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as { columns: string[]; rows: unknown[][] };

    const inseeIndex = parsed.columns.indexOf("insee");
    const latIndex = parsed.columns.indexOf("lat");
    const lngIndex = parsed.columns.indexOf("lng");
    if (inseeIndex === -1 || latIndex === -1 || lngIndex === -1) {
        throw new Error("[dataset] communes/indexLite.json is missing required columns (insee/lat/lng)");
    }

    const map = new Map<string, { lat: number; lng: number } | null>();
    for (const row of parsed.rows) {
        const insee = row[inseeIndex] as string;
        const lat = row[latIndex] as number | null;
        const lng = row[lngIndex] as number | null;
        map.set(insee, lat != null && lng != null ? { lat, lng } : null);
    }

    return map;
}

function buildPopulationByInsee(records: CsvRecord[]): Map<string, number> {
    const map = new Map<string, number>();

    for (const record of records) {
        const normalized = normalizeRecord(record);
        const insee = normalizeInseeCode(pickFirst(normalized, ["com", "insee", "codgeo"]));
        if (!insee) continue;

        const rawPopulation = pickFirst(normalized, ["pmun", "ptot", "population"]);
        const population = parseInteger(rawPopulation);
        if (population == null) continue;

        map.set(insee, population);
    }

    return map;
}

type NormalizedRecord = Map<string, string>;

function normalizeRecord(record: CsvRecord): NormalizedRecord {
    const normalized = new Map<string, string>();
    for (const [key, value] of Object.entries(record)) {
        if (!key) continue;
        const normalizedKey = key.trim().toLowerCase();
        const normalizedValue = value?.trim() ?? "";
        normalized.set(normalizedKey, normalizedValue);
    }
    return normalized;
}

function pickFirst(record: NormalizedRecord, keys: string[]): string | null {
    for (const key of keys) {
        const value = record.get(key);
        if (value) {
            return value;
        }
    }
    return null;
}

function normalizeCode(value: string | null): string | null {
    if (!value) return null;
    return value.trim().toUpperCase() || null;
}

function normalizePostalCode(value: string | null): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    return trimmed || null;
}

function normalizeInseeCode(value: string | null): string | null {
    if (!value) return null;
    const trimmed = value.trim().toUpperCase();
    if (!trimmed) return null;
    if (/^\d+$/.test(trimmed) && trimmed.length < 5) {
        return trimmed.padStart(5, "0");
    }
    return trimmed;
}

function extractCoordinates(record: NormalizedRecord): { lat: number | null; lng: number | null } {
    const latRaw = pickFirst(record, ["latitude", "lat"]);
    const lngRaw = pickFirst(record, ["longitude", "lon"]);

    if (latRaw && lngRaw) {
        return { lat: parseNumber(latRaw), lng: parseNumber(lngRaw) };
    }

    const combined = pickFirst(record, ["coordonnees_gps", "coordinates"]);
    if (combined && combined.includes(",")) {
        const parts = combined.split(",");
        const latPart = parts[0]?.trim() ?? null;
        const lngPart = parts[1]?.trim() ?? null;
        return { lat: parseNumber(latPart), lng: parseNumber(lngPart) };
    }

    return { lat: null, lng: null };
}

function parseNumber(value: string | null): number | null {
    if (!value) return null;
    const normalized = value.replace(",", ".");
    const result = Number.parseFloat(normalized);
    return Number.isFinite(result) ? result : null;
}

function parseInteger(value: string | null): number | null {
    if (!value) return null;
    const cleaned = value.replace(/\s/g, "");
    const result = Number.parseInt(cleaned, 10);
    return Number.isFinite(result) ? result : null;
}
