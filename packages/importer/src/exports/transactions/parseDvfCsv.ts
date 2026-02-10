import { createReadStream } from "node:fs";
import { open } from "node:fs/promises";
import { createGunzip } from "node:zlib";

import { parse } from "csv-parse";

import type { DvfRawRow } from "./types.js";

const VALID_TYPE_LOCAL = new Set(["Maison", "Appartement"]);
const VALID_NATURE_MUTATION = new Set(["Vente", "Vente en l'état futur d'achèvement"]);

type ParseDvfOptions = {
    /** Called for each valid row after filtering. */
    onRow: (row: DvfRawRow) => void;
    /** Called periodically with the number of rows processed so far. */
    onProgress?: (processed: number, accepted: number) => void;
};

/**
 * Streams and parses the DVF géolocalisé CSV file (gzipped).
 * Filters in-flight: type_local, nature_mutation, streetNumber, valid coords.
 */
export async function parseDvfCsvStreaming(filePath: string, options: ParseDvfOptions): Promise<{ processed: number; accepted: number }> {
    let processed = 0;
    let accepted = 0;
    const isGzipped = await isGzipFile(filePath);

    return new Promise((resolve, reject) => {
        const fileStream = createReadStream(filePath);
        const inputStream = isGzipped ? fileStream.pipe(createGunzip()) : fileStream;

        const parser = parse({
            bom: true,
            columns: true,
            skip_empty_lines: true,
            trim: true,
            delimiter: ","
        });

        inputStream.pipe(parser);

        parser.on("data", (record: Record<string, string>) => {
            processed++;

            if (processed % 500_000 === 0) {
                options.onProgress?.(processed, accepted);
            }

            const row = extractDvfRow(record);
            if (row) {
                accepted++;
                options.onRow(row);
            }
        });

        parser.on("end", () => {
            options.onProgress?.(processed, accepted);
            resolve({ processed, accepted });
        });

        parser.on("error", reject);
        inputStream.on("error", reject);
        fileStream.on("error", reject);
    });
}

async function isGzipFile(filePath: string): Promise<boolean> {
    if (filePath.endsWith(".gz")) return true;

    const fileHandle = await open(filePath, "r");
    try {
        const magic = Buffer.alloc(2);
        const { bytesRead } = await fileHandle.read(magic, 0, magic.length, 0);
        return bytesRead === 2 && magic[0] === 0x1f && magic[1] === 0x8b;
    } finally {
        await fileHandle.close();
    }
}

function extractDvfRow(record: Record<string, string>): DvfRawRow | null {
    const typeLocal = (record["type_local"] ?? "").trim();
    if (!VALID_TYPE_LOCAL.has(typeLocal)) return null;

    const natureMutation = (record["nature_mutation"] ?? "").trim();
    if (!VALID_NATURE_MUTATION.has(natureMutation)) return null;

    const streetNumber = (record["adresse_numero"] ?? "").trim();
    if (!streetNumber) return null;

    const latRaw = (record["latitude"] ?? "").trim();
    const lngRaw = (record["longitude"] ?? "").trim();
    const lat = parseFloat(latRaw);
    const lng = parseFloat(lngRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    const inseeCode = (record["code_commune"] ?? "").trim();
    if (!inseeCode) return null;

    const streetName = (record["adresse_nom_voie"] ?? "").trim();
    if (!streetName) return null;

    const dateRaw = (record["date_mutation"] ?? "").trim();
    if (!dateRaw) return null;

    const priceRaw = (record["valeur_fonciere"] ?? "").replace(",", ".").trim();
    const priceEur = parseFloat(priceRaw);
    if (!Number.isFinite(priceEur) || priceEur <= 0) return null;

    const surfaceRaw = (record["surface_reelle_bati"] ?? "").trim();
    const surfaceM2 = surfaceRaw ? parseFloat(surfaceRaw) : null;

    const suffix = (record["adresse_suffixe"] ?? "").trim();
    const fullStreetNumber = suffix ? `${streetNumber}${suffix}` : streetNumber;

    return {
        inseeCode,
        streetNumber: fullStreetNumber,
        streetName,
        date: dateRaw,
        priceEur,
        typeLocal: typeLocal as "Maison" | "Appartement",
        surfaceM2: surfaceM2 !== null && Number.isFinite(surfaceM2) && surfaceM2 > 0 ? surfaceM2 : null,
        isVefa: natureMutation === "Vente en l'état futur d'achèvement",
        lat,
        lng
    };
}
