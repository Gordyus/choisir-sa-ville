import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { CACHE_DIR } from "./constants.js";

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

export async function resolveSourceFile(source: string, force: boolean): Promise<string> {
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
