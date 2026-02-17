"use client";

/**
 * Hook for BAN API address search with debounce and abort control.
 */

import { useEffect, useRef, useState } from "react";

import { searchAddress } from "@/lib/search/banGeocode";
import type { BanSuggestion } from "@/lib/search/types";

const DEBOUNCE_MS = 300;

interface UseAddressSearchResult {
    suggestions: BanSuggestion[];
    isLoading: boolean;
}

export function useAddressSearch(query: string): UseAddressSearchResult {
    const [suggestions, setSuggestions] = useState<BanSuggestion[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const abortRef = useRef<AbortController | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        // Clear previous timer
        if (timerRef.current !== null) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }

        // Abort previous request
        if (abortRef.current !== null) {
            abortRef.current.abort();
            abortRef.current = null;
        }

        const trimmed = query.trim();
        if (trimmed.length < 3) {
            setSuggestions([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);

        timerRef.current = setTimeout(() => {
            const controller = new AbortController();
            abortRef.current = controller;

            searchAddress(trimmed, controller.signal)
                .then((results) => {
                    if (!controller.signal.aborted) {
                        setSuggestions(results);
                        setIsLoading(false);
                    }
                })
                .catch(() => {
                    if (!controller.signal.aborted) {
                        setSuggestions([]);
                        setIsLoading(false);
                    }
                });
        }, DEBOUNCE_MS);

        return () => {
            if (timerRef.current !== null) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
            if (abortRef.current !== null) {
                abortRef.current.abort();
                abortRef.current = null;
            }
        };
    }, [query]);

    return { suggestions, isLoading };
}
