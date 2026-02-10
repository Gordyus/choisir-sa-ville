import { copyFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ensureDir } from "./fileSystem.js";
import { sha256FromBuffer, sha256FromFile, sha256FromString } from "./hash.js";
import type { SourceMeta } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "../../..");
const cacheDir = path.resolve(packageRoot, ".cache");

type DownloadFileOptions = {
    cacheTtlMs?: number;
    /** Absolute or package-root-relative destination path. Defaults to .cache/{hash}-{basename}. */
    destinationPath?: string;
};

export async function downloadFile(
    url: string,
    { cacheTtlMs, destinationPath }: DownloadFileOptions = {}
): Promise<SourceMeta & { fromCache: boolean }> {
    const urlObj = new URL(url);
    const hashPrefix = sha256FromString(url).slice(0, 16);
    const basename = path.basename(urlObj.pathname) || "download";
    const legacyCachePath = path.join(cacheDir, `${hashPrefix}-${basename}`);
    const filePath = destinationPath
        ? (path.isAbsolute(destinationPath) ? destinationPath : path.resolve(packageRoot, destinationPath))
        : legacyCachePath;

    await ensureDir(path.dirname(filePath));
    await ensureDir(cacheDir);

    try {
        const fileStat = await stat(filePath);
        if (cacheTtlMs === undefined || Date.now() - fileStat.mtimeMs <= cacheTtlMs) {
            const checksumSha256 = await sha256FromFile(filePath);
            return {
                url,
                filePath,
                retrievedAtUtc: fileStat.mtime.toISOString(),
                checksumSha256,
                fromCache: true
            };
        }
        console.info(`[downloadFile] Cache expired for ${basename} (TTL ${cacheTtlMs}ms) — re-downloading.`);
    } catch {
        // Cache miss, fall through to download.
    }

    if (destinationPath) {
        try {
            const legacyStat = await stat(legacyCachePath);
            if (cacheTtlMs === undefined || Date.now() - legacyStat.mtimeMs <= cacheTtlMs) {
                await copyFile(legacyCachePath, filePath);
                const checksumSha256 = await sha256FromFile(filePath);
                return {
                    url,
                    filePath,
                    retrievedAtUtc: legacyStat.mtime.toISOString(),
                    checksumSha256,
                    fromCache: true
                };
            }
        } catch {
            // No legacy cache available, continue with network download.
        }
    }

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const checksumSha256 = sha256FromBuffer(buffer);
    await writeFile(filePath, buffer);

    return {
        url,
        filePath,
        retrievedAtUtc: new Date().toISOString(),
        checksumSha256,
        fromCache: false
    };
}
