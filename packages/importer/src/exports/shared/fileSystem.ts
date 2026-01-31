import { randomUUID } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export async function ensureDir(path: string): Promise<void> {
    await mkdir(path, { recursive: true });
}

export async function writeJsonAtomic(filePath: string, data: unknown): Promise<void> {
    const dir = dirname(filePath);
    await ensureDir(dir);
    const tempFile = join(dir, `${randomUUID()}.tmp`);
    await writeFile(tempFile, JSON.stringify(data, null, 2), "utf8");
    await rename(tempFile, filePath);
}
