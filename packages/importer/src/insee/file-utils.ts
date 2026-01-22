import { spawn } from "node:child_process";
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

async function extractZip(zipPath: string, extractDir: string): Promise<void> {
  const isWindows = process.platform === "win32";

  return new Promise((resolve, reject) => {
    let proc;
    let stderr = "";

    if (isWindows) {
      // Windows: use PowerShell Expand-Archive
      // Note: Expand-Archive requires absolute paths and doesn't like existing directories
      const absZipPath = path.resolve(zipPath);
      const absExtractDir = path.resolve(extractDir);

      proc = spawn(
        "powershell.exe",
        [
          "-NoProfile",
          "-Command",
          `Expand-Archive -Path '${absZipPath}' -DestinationPath '${absExtractDir}' -Force`
        ],
        { shell: false }
      );
    } else {
      // Unix-like: use unzip
      proc = spawn("unzip", ["-o", zipPath, "-d", extractDir]);
    }

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        const tool = isWindows ? "PowerShell Expand-Archive" : "unzip";
        reject(new Error(`${tool} failed with code ${code}: ${stderr}`));
      }
    });

    proc.on("error", (err) => {
      const tool = isWindows ? "powershell.exe" : "unzip";
      reject(new Error(`Failed to spawn ${tool}: ${err.message}`));
    });
  });
}

async function findCsvInZip(extractDir: string): Promise<string> {
  const files = await fsPromises.readdir(extractDir, { recursive: true });
  const csvFiles = files.filter((file) => typeof file === "string" && file.endsWith(".csv"));

  if (csvFiles.length === 0) {
    throw new Error(`No CSV files found in extracted directory: ${extractDir}`);
  }

  if (csvFiles.includes("ensemble.csv")) {
    return path.join(extractDir, "ensemble.csv");
  }

  // Find largest CSV file
  let largestFile = csvFiles[0]!;
  let largestSize = 0;

  for (const file of csvFiles) {
    const filePath = path.join(extractDir, file as string);
    const stats = await fsPromises.stat(filePath);
    if (stats.size > largestSize) {
      largestSize = stats.size;
      largestFile = file;
    }
  }

  return path.join(extractDir, largestFile as string);
}

export async function resolveSourceFile(source: string, force: boolean): Promise<string> {
  if (isHttpUrl(source)) {
    await fsPromises.mkdir(CACHE_DIR, { recursive: true });
    const url = new URL(source);
    const fileName = path.basename(url.pathname) || "insee-source.csv";
    const cachedPath = path.join(CACHE_DIR, fileName);

    // Handle ZIP files
    if (fileName.endsWith(".zip")) {
      const extractDirName = `${fileName}__extracted`;
      const extractDir = path.join(CACHE_DIR, extractDirName);

      if (!force && (await fileExists(extractDir))) {
        console.log(`Using extracted ZIP: ${extractDir}`);
        return await findCsvInZip(extractDir);
      }

      if (!force && (await fileExists(cachedPath))) {
        console.log(`Using cached ZIP file: ${cachedPath}`);
      } else {
        console.log(`Downloading ${source}`);
        await downloadFile(source, cachedPath);
      }

      // Extract ZIP
      await fsPromises.mkdir(extractDir, { recursive: true });
      console.log(`Extracting ZIP to: ${extractDir}`);
      await extractZip(cachedPath, extractDir);

      return await findCsvInZip(extractDir);
    }

    // Handle regular CSV files
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
