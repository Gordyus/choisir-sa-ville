/**
 * Batch Routing Orchestrator
 *
 * Orchestrates matrix API calls in batches of 10 origins,
 * with up to 3 concurrent batches.
 */

import type { CommuneIndexLiteEntry } from "@/lib/data/communesIndexLite";
import type { Destination, SearchProgress, TransportMode } from "@/lib/search/types";

const BATCH_SIZE = 10;
const MAX_CONCURRENT = 3;
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const MATRIX_ENDPOINT = `${API_BASE}/api/routing/matrix`;

interface MatrixRequestBody {
    origins: Array<{ lat: number; lng: number }>;
    destinations: Array<{ lat: number; lng: number }>;
    departureTime: string;
    mode: TransportMode;
}

interface MatrixResponse {
    durations: Array<Array<number | null>>;
}

interface BatchRoutingParams {
    communes: CommuneIndexLiteEntry[];
    destination: Destination;
    mode: TransportMode;
    signal?: AbortSignal;
    onProgress?: (progress: SearchProgress) => void;
}

/**
 * Execute routing matrix API calls in batches of 10 origins,
 * with up to 3 concurrent batches.
 *
 * Returns Map<inseeCode, travelSeconds>. Null durations are skipped.
 * Uses Promise.allSettled to collect partial results on failure.
 */
export async function executeBatchRouting(
    params: BatchRoutingParams
): Promise<Map<string, number>> {
    const { communes, destination, mode, signal, onProgress } = params;

    if (communes.length === 0) {
        return new Map();
    }

    // Split communes into batches of BATCH_SIZE
    const batches: CommuneIndexLiteEntry[][] = [];
    for (let i = 0; i < communes.length; i += BATCH_SIZE) {
        batches.push(communes.slice(i, i + BATCH_SIZE));
    }

    const totalBatches = batches.length;
    let completedBatches = 0;
    let analyzedCommunes = 0;

    const results = new Map<string, number>();

    const reportProgress = (): void => {
        onProgress?.({
            totalBatches,
            completedBatches,
            totalCommunes: communes.length,
            analyzedCommunes,
        });
    };

    reportProgress();

    // Process batches with max concurrency
    for (let i = 0; i < batches.length; i += MAX_CONCURRENT) {
        if (signal?.aborted) {
            break;
        }

        const concurrentBatches = batches.slice(i, i + MAX_CONCURRENT);

        const promises = concurrentBatches.map((batch) =>
            executeSingleBatch(batch, destination, mode, signal)
        );

        const settled = await Promise.allSettled(promises);

        for (let j = 0; j < settled.length; j++) {
            const result = settled[j];
            const batch = concurrentBatches[j];
            completedBatches++;

            if (result !== undefined && result.status === "fulfilled" && batch !== undefined) {
                for (const [inseeCode, seconds] of result.value) {
                    results.set(inseeCode, seconds);
                }
                analyzedCommunes += batch.length;
            }

            reportProgress();
        }
    }

    return results;
}

async function executeSingleBatch(
    batch: CommuneIndexLiteEntry[],
    destination: Destination,
    mode: TransportMode,
    signal?: AbortSignal
): Promise<Map<string, number>> {
    const body: MatrixRequestBody = {
        origins: batch.map((c) => ({ lat: c.lat, lng: c.lon })),
        destinations: [{ lat: destination.lat, lng: destination.lng }],
        departureTime: new Date().toISOString(),
        mode,
    };

    const init: RequestInit = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    };
    if (signal !== undefined) {
        init.signal = signal;
    }

    const response = await fetch(MATRIX_ENDPOINT, init);
    if (!response.ok) {
        throw new Error(`Matrix API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as MatrixResponse;
    const batchResults = new Map<string, number>();

    for (let i = 0; i < batch.length; i++) {
        const commune = batch[i];
        const row = data.durations[i];
        if (commune === undefined || row === undefined) {
            continue;
        }
        const duration = row[0];
        if (duration !== null && duration !== undefined && Number.isFinite(duration)) {
            batchResults.set(commune.inseeCode, duration);
        }
    }

    return batchResults;
}
