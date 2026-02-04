/**
 * Entity Data Provider Module
 *
 * Central access point for entity data.
 * Provides singleton instance with caching and React hooks.
 */

import type {
    CommuneData,
    EntityData,
    EntityRef,
    InfraZoneData
} from "@/lib/selection/types";

import { CachedEntityDataProvider } from "./cache/cachedEntityDataProvider";
import type { EntityDataProvider } from "./entityDataProvider";
import { StaticFilesEntityDataProvider } from "./staticFilesEntityDataProvider";

// ============================================================================
// Re-exports
// ============================================================================

export type { EntityDataProvider } from "./entityDataProvider";
export { BaseEntityDataProvider } from "./entityDataProvider";
export { IndexedDbCache, type CacheConfig } from "./cache/indexedDbCache";
export {
    CachedEntityDataProvider,
    createCachedEntityDataProvider
} from "./cache/cachedEntityDataProvider";
export {
    StaticFilesEntityDataProvider,
    createStaticFilesEntityDataProvider,
    type StaticFilesConfig
} from "./staticFilesEntityDataProvider";

// ============================================================================
// Singleton Provider Instance
// ============================================================================

let providerInstance: EntityDataProvider | null = null;

/**
 * Get the singleton entity data provider.
 *
 * Uses cached static files provider by default.
 * Can be replaced in tests via setEntityDataProvider().
 */
export function getEntityDataProvider(): EntityDataProvider {
    if (!providerInstance) {
        // Create default provider: static files wrapped with cache
        const staticProvider = new StaticFilesEntityDataProvider({
            version: getDataVersion()
        });
        providerInstance = new CachedEntityDataProvider(staticProvider, {
            dataVersion: getDataVersion()
        });
    }
    return providerInstance;
}

/**
 * Replace the singleton provider (for testing).
 */
export function setEntityDataProvider(provider: EntityDataProvider): void {
    providerInstance = provider;
}

/**
 * Reset provider instance (for testing).
 */
export function resetEntityDataProvider(): void {
    providerInstance = null;
}

// ============================================================================
// Data Version Management
// ============================================================================

const DATA_VERSION_KEY = "choisir-sa-ville:data-version";
const DEFAULT_VERSION = "v1";

/**
 * Get current data version.
 */
export function getDataVersion(): string {
    if (typeof window === "undefined") {
        return DEFAULT_VERSION;
    }
    return localStorage.getItem(DATA_VERSION_KEY) ?? DEFAULT_VERSION;
}

/**
 * Set data version (triggers cache refresh on next request).
 */
export function setDataVersion(version: string): void {
    if (typeof window === "undefined") {
        return;
    }
    localStorage.setItem(DATA_VERSION_KEY, version);

    // Update provider if it supports version updates
    if (providerInstance instanceof CachedEntityDataProvider) {
        providerInstance.setDataVersion(version);
    }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Get commune data by INSEE code.
 */
export async function getCommune(
    inseeCode: string,
    signal?: AbortSignal
): Promise<CommuneData | null> {
    return getEntityDataProvider().getCommune(inseeCode, signal);
}

/**
 * Get infra-zone data by ID.
 */
export async function getInfraZone(
    id: string,
    signal?: AbortSignal
): Promise<InfraZoneData | null> {
    return getEntityDataProvider().getInfraZone(id, signal);
}

/**
 * Get entity data by reference.
 */
export async function getEntity(
    ref: EntityRef,
    signal?: AbortSignal
): Promise<EntityData | null> {
    return getEntityDataProvider().getEntity(ref, signal);
}

/**
 * Check if entity has data available.
 */
export async function hasEntity(
    ref: EntityRef,
    signal?: AbortSignal
): Promise<boolean> {
    return getEntityDataProvider().hasEntity(ref, signal);
}
