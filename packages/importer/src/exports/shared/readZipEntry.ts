import { Readable } from "node:stream";

function toReadable(stream: unknown): Readable {
    return stream as Readable;
}

async function readStreamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
}

export async function readZipEntryText(zipPath: string, entryName: string): Promise<string> {
    const unzipperModule = await import("unzipper");
    const Open = (unzipperModule as any).Open ?? (unzipperModule as any).default?.Open;
    if (!Open?.file) {
        throw new Error("unzipper.Open.file is not available");
    }

    const directory = await Open.file(zipPath);
    const normalizedName = entryName.toLowerCase();
    const entry =
        directory.files.find((file: any) => String(file.path) === entryName) ??
        directory.files.find((file: any) => String(file.path).toLowerCase() === normalizedName);
    if (!entry) {
        throw new Error(`Zip entry not found: ${entryName}`);
    }

    const buffer = await readStreamToBuffer(toReadable(entry.stream()));
    return buffer.toString("utf8");
}

