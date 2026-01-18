import fs from "node:fs";
import fsPromises from "node:fs/promises";
import { Readable } from "node:stream";
import unzipper from "unzipper";

export async function openCsvStream(filePath: string): Promise<{
  stream: Readable;
  isZip: boolean;
  entryName?: string;
}> {
  if (filePath.toLowerCase().endsWith(".zip")) {
    const directory = await unzipper.Open.file(filePath);
    const entry = directory.files.find(
      (file) => file.type === "File" && file.path.toLowerCase().endsWith(".csv")
    );
    if (!entry) {
      throw new Error("No CSV file found in zip archive");
    }
    return { stream: entry.stream() as Readable, isZip: true, entryName: entry.path };
  }
  return { stream: fs.createReadStream(filePath), isZip: false };
}

async function readFirstLineFromStream(stream: Readable): Promise<string> {
  let buffer = "";
  for await (const chunk of stream) {
    buffer += chunk.toString("utf8");
    const newlineIndex = buffer.indexOf("\n");
    if (newlineIndex !== -1) {
      stream.destroy();
      return buffer.slice(0, newlineIndex);
    }
    if (buffer.length > 4096) {
      stream.destroy();
      return buffer;
    }
  }
  return buffer;
}

export async function detectDelimiter(filePath: string): Promise<string> {
  if (!filePath.toLowerCase().endsWith(".zip")) {
    const handle = await fsPromises.open(filePath, "r");
    const buffer = Buffer.alloc(4096);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    await handle.close();

    const sample = buffer.toString("utf8", 0, bytesRead);
    const firstLine = sample.split(/\r?\n/)[0] ?? "";
    const semicolons = (firstLine.match(/;/g) ?? []).length;
    const commas = (firstLine.match(/,/g) ?? []).length;

    return semicolons >= commas ? ";" : ",";
  }

  const { stream } = await openCsvStream(filePath);
  const line = await readFirstLineFromStream(stream);
  const semicolons = (line.match(/;/g) ?? []).length;
  const commas = (line.match(/,/g) ?? []).length;
  return semicolons >= commas ? ";" : ",";
}
