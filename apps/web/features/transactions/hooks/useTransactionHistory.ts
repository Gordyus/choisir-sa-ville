"use client";

/**
 * useTransactionHistory Hook
 *
 * Fetches transaction address history from tile bundles.
 */

import { useCallback, useEffect, useState } from "react";

import type { EntityRef, TransactionAddressData } from "@/lib/selection/types";
import type { UseEntityResult } from "@/lib/data/hooks";

import { getTransactionHistory } from "../lib/transactionBundles";

export function useTransactionHistory(
    ref: Extract<EntityRef, { kind: "transactionAddress" }> | null
): UseEntityResult<TransactionAddressData> {
    const [data, setData] = useState<TransactionAddressData | null>(null);
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

        getTransactionHistory(ref, controller.signal)
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
    }, [ref?.id, ref?.bundleZ, ref?.bundleX, ref?.bundleY, refetchTrigger]);

    return { data, loading, error, refetch };
}
