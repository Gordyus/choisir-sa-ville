"use client";

/**
 * Generic async data-fetching hook with AbortController lifecycle.
 *
 * Eliminates boilerplate shared by useEntity, useCommune, useInfraZone,
 * useInsecurityMetrics, and useTransactionHistory.
 */

import { useCallback, useEffect, useState } from "react";

export interface AsyncDataResult<T> {
    data: T | null;
    loading: boolean;
    error: Error | null;
    refetch: () => void;
}

/**
 * @param fetcher - Memoized async function receiving an AbortSignal. Pass `null` to skip.
 *                  Must be wrapped in `useMemo` by the caller so identity changes only when deps change.
 */
export function useAsyncData<T>(
    fetcher: ((signal: AbortSignal) => Promise<T | null>) | null
): AsyncDataResult<T> {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [refetchTrigger, setRefetchTrigger] = useState(0);

    const refetch = useCallback(() => {
        setRefetchTrigger((n) => n + 1);
    }, []);

    useEffect(() => {
        if (!fetcher) {
            setData(null);
            setLoading(false);
            setError(null);
            return;
        }

        const controller = new AbortController();
        setLoading(true);
        setError(null);

        fetcher(controller.signal)
            .then((result) => {
                if (!controller.signal.aborted) {
                    setData(result);
                    setLoading(false);
                }
            })
            .catch((err: unknown) => {
                if (!controller.signal.aborted) {
                    if (err instanceof DOMException && err.name === "AbortError") {
                        return;
                    }
                    setError(err instanceof Error ? err : new Error(String(err)));
                    setLoading(false);
                }
            });

        return () => {
            controller.abort();
        };
    }, [fetcher, refetchTrigger]);

    return { data, loading, error, refetch };
}
