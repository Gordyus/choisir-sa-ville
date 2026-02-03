import { parse } from "csv-parse/sync";
import { readFile } from "node:fs/promises";

export type CsvRecord = Record<string, string>;

export type ParseCsvOptions = {
    delimiter?: string;
};

const BASE_OPTIONS = {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true
};

export function parseCsv(content: string, options?: ParseCsvOptions): CsvRecord[] {
    const delimiter = options?.delimiter ?? detectDelimiter(content);
    return parse(content, { ...BASE_OPTIONS, ...options, delimiter }) as CsvRecord[];
}

export async function parseCsvFile(filePath: string, options?: ParseCsvOptions): Promise<CsvRecord[]> {
    const raw = await readFile(filePath, "utf8");
    return parseCsv(raw, options);
}

function detectDelimiter(content: string): string {
    const firstLine = content.split(/\r?\n/).find((line) => line.trim().length > 0) ?? "";
    const semicolons = countOccurrences(firstLine, ";");
    const commas = countOccurrences(firstLine, ",");
    return commas > semicolons ? "," : ";";
}

function countOccurrences(value: string, needle: string): number {
    return value.split(needle).length - 1;
}
