"use client";

/**
 * React Hooks for Entity Data
 *
 * Provides React integration for the EntityDataProvider.
 */

import { useEffect, useMemo, useState } from "react";

import type {
    CommuneData,
    EntityData,
    EntityRef,
    InfraZoneData
} from "@/lib/selection/types";

import { getEntityDataProvider } from "./index";
import { useAsyncData, type AsyncDataResult } from "./useAsyncData";

// Re-export the result type so existing consumers keep working
export type UseEntityResult<T> = AsyncDataResult<T>;

// ============================================================================
// useEntity Hook
// ============================================================================

/**
 * Hook to fetch entity data with loading/error states.
 */
export function useEntity(ref: EntityRef | null): UseEntityResult<EntityData> {
    const fetcher = useMemo(
        () => ref ? (signal: AbortSignal) => getEntityDataProvider().getEntity(ref, signal) : null,
        [ref?.kind, ref?.kind === "commune" ? ref.inseeCode : ref?.id]
    );

    return useAsyncData(fetcher);
}

// ============================================================================
// useCommune Hook
// ============================================================================

/**
 * Hook to fetch commune data by INSEE code.
 */
export function useCommune(inseeCode: string | null): UseEntityResult<CommuneData> {
    const fetcher = useMemo(
        () => inseeCode ? (signal: AbortSignal) => getEntityDataProvider().getCommune(inseeCode, signal) : null,
        [inseeCode]
    );

    return useAsyncData(fetcher);
}

// ============================================================================
// useInfraZone Hook
// ============================================================================

/**
 * Hook to fetch infra-zone data by ID.
 */
export function useInfraZone(id: string | null): UseEntityResult<InfraZoneData> {
    const fetcher = useMemo(
        () => id ? (signal: AbortSignal) => getEntityDataProvider().getInfraZone(id, signal) : null,
        [id]
    );

    return useAsyncData(fetcher);
}

// ============================================================================
// useHasEntity Hook
// ============================================================================

/**
 * Hook to check if an entity has data available.
 */
export function useHasEntity(ref: EntityRef | null): boolean {
    const [hasData, setHasData] = useState(false);

    useEffect(() => {
        if (!ref) {
            setHasData(false);
            return;
        }

        const controller = new AbortController();

        getEntityDataProvider()
            .hasEntity(ref, controller.signal)
            .then((result) => {
                if (!controller.signal.aborted) {
                    setHasData(result);
                }
            })
            .catch(() => {
                if (!controller.signal.aborted) {
                    setHasData(false);
                }
            });

        return () => {
            controller.abort();
        };
    }, [ref?.kind, ref?.kind === "commune" ? ref.inseeCode : ref?.id]);

    return hasData;
}
