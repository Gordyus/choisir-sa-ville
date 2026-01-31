import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export function sha256FromBuffer(buffer: Buffer | ArrayBufferView): string {
    const view = Buffer.isBuffer(buffer)
        ? buffer
        : Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    return createHash("sha256").update(view).digest("hex");
}

export async function sha256FromFile(filePath: string): Promise<string> {
    const data = await readFile(filePath);
    return sha256FromBuffer(data);
}

export function sha256FromString(input: string): string {
    return createHash("sha256").update(input).digest("hex");
}
