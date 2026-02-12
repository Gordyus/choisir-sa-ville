"use client";

/**
 * React Hooks for Entity Data
 *
 * Provides React integration for the EntityDataProvider.
 */

import { useCallback, useEffect, useState } from "react";

import type {
    CommuneData,
    EntityData,
    EntityRef,
    InfraZoneData
} from "@/lib/selection/types";

import { getEntityDataProvider } from "./index";

// ============================================================================
// useEntity Hook
// ============================================================================

export interface UseEntityResult<T> {
    data: T | null;
    loading: boolean;
    error: Error | null;
    refetch: () => void;
}

/**
 * Hook to fetch entity data with loading/error states.
 */
export function useEntity(ref: EntityRef | null): UseEntityResult<EntityData> {
    const [data, setData] = useState<EntityData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [refetchTrigger, setRefetchTrigger] = useState(0);

    const refetch = useCallback(() => {
        setRefetchTrigger((n) => n + 1);
    }, []);

    useEffect(() => {
        if (!ref) {
            setData(null);
            setLoading(false);
            setError(null);
            return;
        }

        const controller = new AbortController();
        setLoading(true);
        setError(null);

        getEntityDataProvider()
            .getEntity(ref, controller.signal)
            .then((result) => {
                if (!controller.signal.aborted) {
                    setData(result);
                    setLoading(false);
                }
            })
            .catch((err: unknown) => {
                if (!controller.signal.aborted) {
                    setError(err instanceof Error ? err : new Error(String(err)));
                    setLoading(false);
                }
            });

        return () => {
            controller.abort();
        };
    }, [ref?.kind, ref?.kind === "commune" ? ref.inseeCode : ref?.id, refetchTrigger]);

    return { data, loading, error, refetch };
}

// ============================================================================
// useCommune Hook
// ============================================================================

/**
 * Hook to fetch commune data by INSEE code.
 */
export function useCommune(inseeCode: string | null): UseEntityResult<CommuneData> {
    const [data, setData] = useState<CommuneData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [refetchTrigger, setRefetchTrigger] = useState(0);

    const refetch = useCallback(() => {
        setRefetchTrigger((n) => n + 1);
    }, []);

    useEffect(() => {
        if (!inseeCode) {
            setData(null);
            setLoading(false);
            setError(null);
            return;
        }

        const controller = new AbortController();
        setLoading(true);
        setError(null);

        getEntityDataProvider()
            .getCommune(inseeCode, controller.signal)
            .then((result) => {
                if (!controller.signal.aborted) {
                    setData(result);
                    setLoading(false);
                }
            })
            .catch((err: unknown) => {
                if (!controller.signal.aborted) {
                    setError(err instanceof Error ? err : new Error(String(err)));
                    setLoading(false);
                }
            });

        return () => {
            controller.abort();
        };
    }, [inseeCode, refetchTrigger]);

    return { data, loading, error, refetch };
}

// ============================================================================
// useInfraZone Hook
// ============================================================================

/**
 * Hook to fetch infra-zone data by ID.
 */
export function useInfraZone(id: string | null): UseEntityResult<InfraZoneData> {
    const [data, setData] = useState<InfraZoneData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [refetchTrigger, setRefetchTrigger] = useState(0);

    const refetch = useCallback(() => {
        setRefetchTrigger((n) => n + 1);
    }, []);

    useEffect(() => {
        if (!id) {
            setData(null);
            setLoading(false);
            setError(null);
            return;
        }

        const controller = new AbortController();
        setLoading(true);
        setError(null);

        getEntityDataProvider()
            .getInfraZone(id, controller.signal)
            .then((result) => {
                if (!controller.signal.aborted) {
                    setData(result);
                    setLoading(false);
                }
            })
            .catch((err: unknown) => {
                if (!controller.signal.aborted) {
                    setError(err instanceof Error ? err : new Error(String(err)));
                    setLoading(false);
                }
            });

        return () => {
            controller.abort();
        };
    }, [id, refetchTrigger]);

    return { data, loading, error, refetch };
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
