"use client";

/**
 * useTransactionHistory Hook
 *
 * Fetches transaction address history from tile bundles.
 */

import { useMemo } from "react";

import type { EntityRef, TransactionAddressData } from "@/lib/selection/types";
import type { AsyncDataResult } from "@/lib/data/useAsyncData";
import { useAsyncData } from "@/lib/data/useAsyncData";

import { getTransactionHistory } from "../lib/transactionBundles";

export function useTransactionHistory(
    ref: Extract<EntityRef, { kind: "transactionAddress" }> | null
): AsyncDataResult<TransactionAddressData> {
    const fetcher = useMemo(
        () => ref ? (signal: AbortSignal) => getTransactionHistory(ref, signal) : null,
        [ref?.id, ref?.bundleZ, ref?.bundleX, ref?.bundleY]
    );

    return useAsyncData(fetcher);
}
