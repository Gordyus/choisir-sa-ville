/**
 * Entity Data Provider Interface
 *
 * Async data abstraction for entity access.
 * Implementations can fetch from static files, API, or cache.
 */

import type {
    CommuneData,
    EntityData,
    EntityRef,
    InfraZoneData
} from "@/lib/selection/types";

// ============================================================================
// Provider Interface
// ============================================================================

/**
 * Async data provider for entities.
 * All methods are async to support both cached and network access.
 */
export interface EntityDataProvider {
    /**
     * Get commune data by INSEE code.
     * @returns Commune data or null if not found.
     */
    getCommune(inseeCode: string, signal?: AbortSignal): Promise<CommuneData | null>;

    /**
     * Get infra-zone data by ID.
     * @returns InfraZone data or null if not found.
     */
    getInfraZone(id: string, signal?: AbortSignal): Promise<InfraZoneData | null>;

    /**
     * Get entity data by reference.
     * @returns Entity data or null if not found.
     */
    getEntity(ref: EntityRef, signal?: AbortSignal): Promise<EntityData | null>;

    /**
     * Check if an entity exists in the data source.
     */
    hasEntity(ref: EntityRef, signal?: AbortSignal): Promise<boolean>;

    /**
     * Get the parent commune for an infra-zone.
     * @returns Parent commune data or null.
     */
    getParentCommune(infraZoneId: string, signal?: AbortSignal): Promise<CommuneData | null>;
}

// ============================================================================
// Base Implementation Helper
// ============================================================================

/**
 * Abstract base class with default implementations for getEntity and hasEntity.
 */
export abstract class BaseEntityDataProvider implements EntityDataProvider {
    abstract getCommune(inseeCode: string, signal?: AbortSignal): Promise<CommuneData | null>;
    abstract getInfraZone(id: string, signal?: AbortSignal): Promise<InfraZoneData | null>;
    abstract getParentCommune(infraZoneId: string, signal?: AbortSignal): Promise<CommuneData | null>;

    async getEntity(ref: EntityRef, signal?: AbortSignal): Promise<EntityData | null> {
        if (ref.kind === "commune") {
            const data = await this.getCommune(ref.inseeCode, signal);
            return data ? { kind: "commune", data } : null;
        }
        if (ref.kind === "infraZone") {
            const data = await this.getInfraZone(ref.id, signal);
            return data ? { kind: "infraZone", data } : null;
        }
        // transactionAddress is not resolved via EntityDataProvider;
        // it uses the dedicated transactionBundles loader.
        return null;
    }

    async hasEntity(ref: EntityRef, signal?: AbortSignal): Promise<boolean> {
        const entity = await this.getEntity(ref, signal);
        return entity !== null;
    }
}
