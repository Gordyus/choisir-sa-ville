/**
 * Cached Entity Data Provider
 *
 * Decorator that wraps an EntityDataProvider with IndexedDB caching.
 * Implements 7-day TTL cache with dataset version support.
 */

import type {
    CommuneData,
    EntityData,
    EntityRef,
    InfraZoneData
} from "@/lib/selection/types";

import type { EntityDataProvider } from "../entityDataProvider";
import { IndexedDbCache, type CacheConfig } from "./indexedDbCache";

// ============================================================================
// Cache Key Builders
// ============================================================================

function communeCacheKey(inseeCode: string, version?: string): string {
    return version ? `commune:${inseeCode}:v${version}` : `commune:${inseeCode}`;
}

function infraZoneCacheKey(id: string, version?: string): string {
    return version ? `infraZone:${id}:v${version}` : `infraZone:${id}`;
}

// ============================================================================
// Cached Provider Implementation
// ============================================================================

export class CachedEntityDataProvider implements EntityDataProvider {
    private cache: IndexedDbCache;
    private provider: EntityDataProvider;
    private dataVersion: string | undefined;
    private cacheEnabled: boolean;

    constructor(provider: EntityDataProvider, config?: CacheConfig & { dataVersion?: string }) {
        this.provider = provider;
        this.dataVersion = config?.dataVersion;
        this.cacheEnabled = IndexedDbCache.isAvailable();
        this.cache = new IndexedDbCache(config);
    }

    async getCommune(inseeCode: string, signal?: AbortSignal): Promise<CommuneData | null> {
        const cacheKey = communeCacheKey(inseeCode, this.dataVersion);

        // Try cache first
        if (this.cacheEnabled) {
            const cached = await this.cache.get<CommuneData>(cacheKey);
            if (cached) {
                return cached;
            }
        }

        // Fetch from provider
        const data = await this.provider.getCommune(inseeCode, signal);

        // Cache the result (even null to avoid repeated fetches)
        if (this.cacheEnabled && data) {
            void this.cache.set(cacheKey, data, this.dataVersion);
        }

        return data;
    }

    async getInfraZone(id: string, signal?: AbortSignal): Promise<InfraZoneData | null> {
        const cacheKey = infraZoneCacheKey(id, this.dataVersion);

        // Try cache first
        if (this.cacheEnabled) {
            const cached = await this.cache.get<InfraZoneData>(cacheKey);
            if (cached) {
                return cached;
            }
        }

        // Fetch from provider
        const data = await this.provider.getInfraZone(id, signal);

        // Cache the result
        if (this.cacheEnabled && data) {
            void this.cache.set(cacheKey, data, this.dataVersion);
        }

        return data;
    }

    async getEntity(ref: EntityRef, signal?: AbortSignal): Promise<EntityData | null> {
        if (ref.kind === "commune") {
            const data = await this.getCommune(ref.inseeCode, signal);
            return data ? { kind: "commune", data } : null;
        }
        const data = await this.getInfraZone(ref.id, signal);
        return data ? { kind: "infraZone", data } : null;
    }

    async hasEntity(ref: EntityRef, signal?: AbortSignal): Promise<boolean> {
        const entity = await this.getEntity(ref, signal);
        return entity !== null;
    }

    async getParentCommune(infraZoneId: string, signal?: AbortSignal): Promise<CommuneData | null> {
        // Get the infra-zone first to find parent code
        const zone = await this.getInfraZone(infraZoneId, signal);
        if (!zone?.parentCommuneCode) {
            return null;
        }
        return this.getCommune(zone.parentCommuneCode, signal);
    }

    /**
     * Update the data version (forces cache refresh on version mismatch).
     */
    setDataVersion(version: string): void {
        this.dataVersion = version;
    }

    /**
     * Clear the entire cache.
     */
    async clearCache(): Promise<void> {
        await this.cache.clear();
    }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a caching wrapper around any EntityDataProvider.
 */
export function createCachedEntityDataProvider(
    provider: EntityDataProvider,
    config?: CacheConfig & { dataVersion?: string }
): CachedEntityDataProvider {
    return new CachedEntityDataProvider(provider, config);
}
