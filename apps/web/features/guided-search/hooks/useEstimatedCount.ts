"use client";

/**
 * Hook for pre-routing commune count estimate.
 * Uses geo pre-filter only (no routing API call).
 */

import { useEffect, useRef, useState } from "react";

import { loadCommunesIndexLite } from "@/lib/data/communesIndexLite";
import { getLatestInsecurityYear, loadInsecurityYear } from "@/lib/data/insecurityMetrics";
import { filterCommunesByGeo } from "@/lib/search/geoFilter";
import type { Destination, LivingPreference } from "@/lib/search/types";

const DEBOUNCE_MS = 200;

interface EstimatedCountParams {
    destination: Destination | null;
    radiusKm: number;
    minSecurityLevel: number | null;
    livingPreference: LivingPreference;
}

interface UseEstimatedCountResult {
    count: number | null;
    isLoading: boolean;
}

export function useEstimatedCount(params: EstimatedCountParams): UseEstimatedCountResult {
    const [count, setCount] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const abortRef = useRef<AbortController | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const { destination, radiusKm, minSecurityLevel, livingPreference } = params;

    useEffect(() => {
        if (timerRef.current !== null) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        if (abortRef.current !== null) {
            abortRef.current.abort();
            abortRef.current = null;
        }

        if (destination === null) {
            setCount(null);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);

        const dest = destination;

        timerRef.current = setTimeout(() => {
            const controller = new AbortController();
            abortRef.current = controller;

            Promise.all([
                loadCommunesIndexLite(controller.signal),
                getLatestInsecurityYear(controller.signal),
            ])
                .then(async ([communes, latestYear]) => {
                    if (controller.signal.aborted) return;
                    const insecurityData = await loadInsecurityYear(latestYear, controller.signal);
                    if (controller.signal.aborted) return;

                    const filtered = filterCommunesByGeo({
                        communes,
                        destination: dest,
                        radiusKm,
                        minSecurityLevel,
                        livingPreference,
                        insecurityData,
                    });

                    if (!controller.signal.aborted) {
                        setCount(filtered.length);
                        setIsLoading(false);
                    }
                })
                .catch(() => {
                    if (!controller.signal.aborted) {
                        setCount(null);
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
    }, [destination, radiusKm, minSecurityLevel, livingPreference]);

    return { count, isLoading };
}
