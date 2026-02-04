/**
 * Static Files Entity Data Provider
 *
 * Reads entity data from static JSON files served from /data/{version}/...
 * These files are generated at build time by the import pipeline.
 */

import type {
    CommuneData,
    EntityData,
    EntityRef,
    InfraZoneData
} from "@/lib/selection/types";

import { BaseEntityDataProvider } from "./entityDataProvider";

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_DATA_VERSION = "v1";
const DEFAULT_BASE_PATH = "/data";

export interface StaticFilesConfig {
    /** Data version (e.g., "v1", "2024-01") */
    version?: string;
    /** Base path for data files (default: "/data") */
    basePath?: string;
}

// ============================================================================
// URL Builders
// ============================================================================

function buildCommuneUrl(basePath: string, version: string, inseeCode: string): string {
    // Group communes by department (first 2 digits of INSEE code)
    const deptCode = inseeCode.slice(0, 2);
    return `${basePath}/${version}/communes/${deptCode}/${inseeCode}.json`;
}

function buildInfraZoneUrl(basePath: string, version: string, id: string): string {
    // Infra-zones grouped by parent commune code (first part of ID before dash or full code)
    const parentCode = id.split("-")[0] || id.slice(0, 5);
    const deptCode = parentCode.slice(0, 2);
    return `${basePath}/${version}/infra-zones/${deptCode}/${id}.json`;
}

// ============================================================================
// Implementation
// ============================================================================

export class StaticFilesEntityDataProvider extends BaseEntityDataProvider {
    private basePath: string;
    private version: string;
    private pendingRequests: Map<string, Promise<unknown>>;

    constructor(config?: StaticFilesConfig) {
        super();
        this.basePath = config?.basePath ?? DEFAULT_BASE_PATH;
        this.version = config?.version ?? DEFAULT_DATA_VERSION;
        this.pendingRequests = new Map();
    }

    /**
     * Deduplicate concurrent requests for the same resource.
     */
    private async fetchWithDedup<T>(url: string, signal?: AbortSignal): Promise<T | null> {
        // Check for pending request
        const pending = this.pendingRequests.get(url);
        if (pending) {
            return pending as Promise<T | null>;
        }

        // Create new request
        const request = this.fetchJson<T>(url, signal).finally(() => {
            this.pendingRequests.delete(url);
        });

        this.pendingRequests.set(url, request);
        return request;
    }

    /**
     * Fetch and parse JSON from a URL.
     */
    private async fetchJson<T>(url: string, signal?: AbortSignal): Promise<T | null> {
        try {
            const response = await fetch(url, {
                signal: signal ?? null,
                headers: {
                    Accept: "application/json"
                }
            });

            if (!response.ok) {
                if (response.status === 404) {
                    // Entity not found - this is expected for some entities
                    return null;
                }
                console.warn(`[StaticFilesProvider] HTTP ${response.status} for ${url}`);
                return null;
            }

            return await response.json() as T;
        } catch (error) {
            if (error instanceof Error && error.name === "AbortError") {
                // Request was aborted - don't log
                return null;
            }
            console.error(`[StaticFilesProvider] Failed to fetch ${url}:`, error);
            return null;
        }
    }

    async getCommune(inseeCode: string, signal?: AbortSignal): Promise<CommuneData | null> {
        const url = buildCommuneUrl(this.basePath, this.version, inseeCode);
        return this.fetchWithDedup<CommuneData>(url, signal);
    }

    async getInfraZone(id: string, signal?: AbortSignal): Promise<InfraZoneData | null> {
        const url = buildInfraZoneUrl(this.basePath, this.version, id);
        return this.fetchWithDedup<InfraZoneData>(url, signal);
    }

    async getParentCommune(infraZoneId: string, signal?: AbortSignal): Promise<CommuneData | null> {
        const zone = await this.getInfraZone(infraZoneId, signal);
        if (!zone?.parentCommuneCode) {
            return null;
        }
        return this.getCommune(zone.parentCommuneCode, signal);
    }

    /**
     * Update the data version.
     */
    setVersion(version: string): void {
        this.version = version;
        // Clear pending requests on version change
        this.pendingRequests.clear();
    }

    /**
     * Get current data version.
     */
    getVersion(): string {
        return this.version;
    }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a static files data provider.
 */
export function createStaticFilesEntityDataProvider(
    config?: StaticFilesConfig
): StaticFilesEntityDataProvider {
    return new StaticFilesEntityDataProvider(config);
}
