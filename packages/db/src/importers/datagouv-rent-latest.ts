import { mkdir, writeFile, access, readFile } from "node:fs/promises";
import path from "node:path";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { ReadableStream } from "node:stream/web";
import unzipper from "unzipper";

const DATASET_QUERY =
  "Carte des loyers indicateurs de loyers d'annonce par commune";
const DATASET_API_URL = "https://www.data.gouv.fr/api/1/datasets/";

export type RentDataset = {
  datasetId: string;
  title: string;
  year: number;
  lastModified: string;
  resources: RentResource[];
};

export type RentResource = {
  resourceId: string;
  title: string;
  format: string;
  downloadUrl: string;
  lastModified: string | null;
};

export type CachedResource = {
  datasetId: string;
  resourceId: string;
  downloadUrl: string;
  lastModified: string | null;
  etag: string | null;
  filePath: string;
  extractedCsvPath: string | null;
  cached: boolean;
};

export type DiscoverOptions = {
  year?: number;
};

export async function discoverLatestRentDataset(
  options: DiscoverOptions = {}
): Promise<RentDataset> {
  const url = new URL(DATASET_API_URL);
  url.searchParams.set("q", DATASET_QUERY);
  url.searchParams.set("page_size", "50");

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Failed to query data.gouv datasets (${response.status}).`);
  }

  const payload = (await response.json()) as {
    data?: Array<{
      id: string;
      title?: string;
      last_modified?: string;
      resources?: Array<{
        id: string;
        title?: string;
        format?: string;
        url?: string;
        last_modified?: string;
      }>;
    }>;
  };

  const datasets = (payload.data ?? []).map((dataset) => {
    const title = dataset.title ?? "";
    const year = extractYear(title) ?? extractYear(dataset.last_modified ?? "") ?? 0;
    return {
      datasetId: dataset.id,
      title,
      year,
      lastModified: dataset.last_modified ?? "",
      resources: (dataset.resources ?? []).map((resource) => ({
        resourceId: resource.id,
        title: resource.title ?? "",
        format: (resource.format ?? "").toLowerCase(),
        downloadUrl: resource.url ?? "",
        lastModified: resource.last_modified ?? null
      }))
    };
  });

  const filtered = datasets.filter((dataset) => dataset.resources.length > 0);
  if (filtered.length === 0) {
    throw new Error("No rent datasets found in data.gouv response.");
  }

  if (options.year) {
    const match = filtered.find((dataset) => dataset.year === options.year);
    if (!match) {
      throw new Error(`No rent dataset found for year ${options.year}.`);
    }
    return match;
  }

  const withYear = filtered.filter((dataset) => dataset.year > 0);
  if (withYear.length > 0) {
    return withYear.sort((a, b) => b.year - a.year)[0];
  }

  return filtered.sort(
    (a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
  )[0];
}

export function chooseRentResource(dataset: RentDataset): RentResource {
  const scored = dataset.resources
    .filter((resource) => Boolean(resource.downloadUrl))
    .map((resource) => ({
      resource,
      score: scoreResource(resource)
    }))
    .sort((a, b) => b.score - a.score);

  const selected = scored[0]?.resource;
  if (!selected || !selected.downloadUrl) {
    throw new Error(`No downloadable resource found for dataset ${dataset.datasetId}.`);
  }
  return selected;
}

export async function downloadAndCacheRentResource(
  dataset: RentDataset,
  resource: RentResource
): Promise<CachedResource> {
  const baseDir = path.resolve(process.cwd(), "../../data/rent", String(dataset.year));
  const rawDir = path.join(baseDir, "raw");
  await mkdir(rawDir, { recursive: true });

  const extension = resolveExtension(resource);
  const filePath = path.join(rawDir, `${resource.resourceId}.${extension}`);
  const metaPath = path.join(rawDir, "meta.json");

  const cached = await readMeta(metaPath);
  const remoteMeta = await fetchRemoteMetadata(resource.downloadUrl);

  const sameResource =
    cached &&
    cached.datasetId === dataset.datasetId &&
    cached.resourceId === resource.resourceId &&
    cached.downloadUrl === resource.downloadUrl;
  const sameVersion =
    cached &&
    ((cached.etag && remoteMeta.etag && cached.etag === remoteMeta.etag) ||
      (cached.lastModified &&
        resource.lastModified &&
        cached.lastModified === resource.lastModified));

  let shouldDownload = true;
  if (sameResource && sameVersion) {
    try {
      await access(filePath);
      shouldDownload = false;
    } catch {
      shouldDownload = true;
    }
  }

  if (shouldDownload) {
    await downloadWithFallback(resource.resourceId, resource.downloadUrl, filePath);
    const meta = {
      datasetId: dataset.datasetId,
      resourceId: resource.resourceId,
      downloadUrl: resource.downloadUrl,
      lastModified: resource.lastModified ?? remoteMeta.lastModified ?? null,
      etag: remoteMeta.etag ?? null
    };
    await writeFile(metaPath, JSON.stringify(meta, null, 2), "utf-8");
  }

  const extractedCsvPath = await extractCsvIfNeeded(filePath, extension);

  return {
    datasetId: dataset.datasetId,
    resourceId: resource.resourceId,
    downloadUrl: resource.downloadUrl,
    lastModified: resource.lastModified ?? remoteMeta.lastModified ?? null,
    etag: remoteMeta.etag ?? null,
    filePath,
    extractedCsvPath,
    cached: !shouldDownload
  };
}

export function resolveDatasetQuery(): string {
  return DATASET_QUERY;
}

function scoreResource(resource: RentResource): number {
  const title = resource.title.toLowerCase();
  const format = resource.format.toLowerCase();
  const url = resource.downloadUrl.toLowerCase();

  let score = 0;
  if (format.includes("csv") || url.endsWith(".csv")) score += 100;
  if (format.includes("zip") || url.endsWith(".zip")) score += 40;
  if (title.includes("commune")) score += 30;
  if (title.includes("tous") || title.includes("toutes") || title.includes("all")) {
    score += 10;
  }
  if (title.includes("indicateur")) score += 5;
  return score;
}

function resolveExtension(resource: RentResource): string {
  const format = resource.format.toLowerCase();
  if (format.includes("csv")) return "csv";
  if (format.includes("zip")) return "zip";
  if (resource.downloadUrl.toLowerCase().endsWith(".zip")) return "zip";
  if (resource.downloadUrl.toLowerCase().endsWith(".csv")) return "csv";
  return "csv";
}

async function downloadResource(url: string, targetPath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download resource (${response.status}) from ${url}.`);
  }
  const stream = Readable.fromWeb(response.body as ReadableStream);
  await pipeline(stream, createWriteStream(targetPath));
}

async function downloadWithFallback(
  resourceId: string,
  url: string,
  targetPath: string
): Promise<void> {
  try {
    await downloadResource(url, targetPath);
  } catch (error) {
    const fallbackUrl = `https://tabular-api.data.gouv.fr/api/resources/${resourceId}/data/?format=csv`;
    console.warn(`Direct download failed, trying tabular API: ${fallbackUrl}`);
    await downloadResource(fallbackUrl, targetPath);
  }
}

async function extractCsvIfNeeded(
  filePath: string,
  extension: string
): Promise<string | null> {
  if (extension !== "zip") return null;
  const directory = path.dirname(filePath);
  const extractedPath = path.join(directory, `${path.parse(filePath).name}.csv`);
  try {
    await access(extractedPath);
    return extractedPath;
  } catch {
    // continue with extraction
  }

  const directoryEntries = await unzipper.Open.file(filePath);
  const csvEntries = directoryEntries.files.filter((file) =>
    file.path.toLowerCase().endsWith(".csv")
  );
  if (csvEntries.length === 0) {
    throw new Error(`No CSV file found inside ${filePath}.`);
  }

  const chosen = chooseCsvEntry(csvEntries);

  await pipeline(chosen.stream(), createWriteStream(extractedPath));
  return extractedPath;
}

function chooseCsvEntry(entries: unzipper.CentralDirectory["files"]): unzipper.File {
  const scored = entries
    .map((entry) => ({
      entry,
      score: scoreCsvEntry(entry)
    }))
    .sort((a, b) => b.score - a.score);
  return scored[0]?.entry ?? entries[0];
}

function scoreCsvEntry(entry: unzipper.File): number {
  const name = entry.path.toLowerCase();
  let score = 0;
  if (name.includes("commune")) score += 20;
  if (name.includes("indic")) score += 10;
  if (name.includes("loyer") || name.includes("loyers")) score += 10;
  const size =
    (entry as unknown as { uncompressedSize?: number; vars?: { uncompressedSize?: number } })
      .uncompressedSize ??
    entry.vars?.uncompressedSize ??
    0;
  score += Math.min(size, 10_000_000) / 1_000_000;
  return score;
}

async function fetchRemoteMetadata(
  url: string
): Promise<{ etag: string | null; lastModified: string | null }> {
  try {
    const response = await fetch(url, { method: "HEAD" });
    if (!response.ok) return { etag: null, lastModified: null };
    return {
      etag: response.headers.get("etag"),
      lastModified: response.headers.get("last-modified")
    };
  } catch {
    return { etag: null, lastModified: null };
  }
}

async function readMeta(
  metaPath: string
): Promise<{
  datasetId: string;
  resourceId: string;
  downloadUrl: string;
  lastModified: string | null;
  etag: string | null;
} | null> {
  try {
    const raw = await readFile(metaPath, "utf-8");
    return JSON.parse(raw) as {
      datasetId: string;
      resourceId: string;
      downloadUrl: string;
      lastModified: string | null;
      etag: string | null;
    };
  } catch {
    return null;
  }
}

function extractYear(text: string): number | null {
  const matches = text.match(/\b(19|20)\d{2}\b/g);
  if (!matches || matches.length === 0) return null;
  const years = matches
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isFinite(value));
  if (years.length === 0) return null;
  return Math.max(...years);
}
