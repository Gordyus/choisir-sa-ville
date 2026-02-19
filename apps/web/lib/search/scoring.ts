/**
 * Scoring Engine
 *
 * Computes composite scores for communes based on travel time,
 * security metrics, and density/living preference.
 *
 * Weights: travel 50%, security 30%, density 20% (budget reserved).
 */

import type { CommuneIndexLiteEntry } from "@/lib/data/communesIndexLite";
import type { InsecurityMetricsRow } from "@/lib/data/insecurityMetrics";
import type { SearchCriteria, SearchResult } from "@/lib/search/types";

const WEIGHT_TRAVEL = 0.5;
const WEIGHT_SECURITY = 0.3;
const WEIGHT_DENSITY = 0.2;

const WEIGHT_SECURITY_NO_TRAVEL = 0.55;
const WEIGHT_DENSITY_NO_TRAVEL = 0.45;

const DEFAULT_DENSITY_SCORE = 0.5;

interface ScoringParams {
    travelTimesPerTarget: Array<Map<string, number>>;
    communes: CommuneIndexLiteEntry[];
    insecurityData: Map<string, InsecurityMetricsRow> | null;
    criteria: SearchCriteria;
    skipTravelFilter: boolean;
}

/**
 * Score and rank communes based on travel time, security, and density.
 *
 * When multiple travel targets exist, a commune must satisfy ALL targets
 * (AND filter). The travel score is the minimum across all targets,
 * favoring communes close to every destination.
 *
 * Returns results sorted by score descending.
 */
export function scoreResults(params: ScoringParams): SearchResult[] {
    const { travelTimesPerTarget, communes, insecurityData, criteria, skipTravelFilter } = params;

    // Build lookup map for communes
    const communeMap = new Map<string, CommuneIndexLiteEntry>();
    for (const commune of communes) {
        communeMap.set(commune.inseeCode, commune);
    }

    // Collect all insee codes present in any travel map (or all communes if skip)
    const allInseeCodes = new Set<string>();
    if (skipTravelFilter) {
        for (const commune of communes) {
            allInseeCodes.add(commune.inseeCode);
        }
    } else {
        // Start with codes from first target, then intersect with others (AND)
        const firstMap = travelTimesPerTarget[0];
        if (firstMap !== undefined) {
            for (const inseeCode of firstMap.keys()) {
                allInseeCodes.add(inseeCode);
            }
        }
    }

    const results: SearchResult[] = [];

    for (const inseeCode of allInseeCodes) {
        const commune = communeMap.get(inseeCode);
        if (commune === undefined) {
            continue;
        }

        if (skipTravelFilter) {
            const securityScore = computeSecurityScore(inseeCode, insecurityData);
            const densityScore = computeDensityScore(commune.population, criteria.livingPreference);
            const score =
                WEIGHT_SECURITY_NO_TRAVEL * securityScore +
                WEIGHT_DENSITY_NO_TRAVEL * densityScore;

            const metrics = insecurityData?.get(inseeCode);
            results.push({
                inseeCode,
                communeName: commune.name,
                travelSeconds: 0,
                securityLevel: metrics?.levelCategory ?? null,
                population: commune.population,
                score: Math.round(score * 1000) / 1000,
            });
            continue;
        }

        // AND filter: commune must exist in ALL target maps and satisfy each maxMinutes
        let passesAll = true;
        let worstTravelSeconds = 0;
        let minTravelScore = 1;

        for (let i = 0; i < travelTimesPerTarget.length; i++) {
            const targetMap = travelTimesPerTarget[i]!;
            const target = criteria.travelTimeTargets[i]!;
            const travelSeconds = targetMap.get(inseeCode);

            if (travelSeconds === undefined) {
                passesAll = false;
                break;
            }

            const maxSeconds = target.maxMinutes * 60;
            if (travelSeconds > maxSeconds) {
                passesAll = false;
                break;
            }

            if (travelSeconds > worstTravelSeconds) {
                worstTravelSeconds = travelSeconds;
            }

            const individualScore = clamp01(1 - travelSeconds / maxSeconds);
            if (individualScore < minTravelScore) {
                minTravelScore = individualScore;
            }
        }

        if (!passesAll) {
            continue;
        }

        const securityScore = computeSecurityScore(inseeCode, insecurityData);
        const densityScore = computeDensityScore(commune.population, criteria.livingPreference);
        const score =
            WEIGHT_TRAVEL * minTravelScore +
            WEIGHT_SECURITY * securityScore +
            WEIGHT_DENSITY * densityScore;

        const metrics = insecurityData?.get(inseeCode);
        results.push({
            inseeCode,
            communeName: commune.name,
            travelSeconds: worstTravelSeconds,
            securityLevel: metrics?.levelCategory ?? null,
            population: commune.population,
            score: Math.round(score * 1000) / 1000,
        });
    }

    results.sort((a, b) => b.score - a.score);
    return results;
}

function computeSecurityScore(
    inseeCode: string,
    insecurityData: Map<string, InsecurityMetricsRow> | null
): number {
    if (insecurityData === null) {
        return DEFAULT_DENSITY_SCORE;
    }

    const metrics = insecurityData.get(inseeCode);
    if (metrics === undefined) {
        return DEFAULT_DENSITY_SCORE;
    }

    // Lower levelCategory = better security. Scale: 0-4 where 0 is best.
    return clamp01((4 - metrics.levelCategory) / 4);
}

function computeDensityScore(
    population: number | null,
    livingPreference: string
): number {
    if (population === null) {
        return DEFAULT_DENSITY_SCORE;
    }

    if (livingPreference === "urban") {
        // Higher population = higher score, cap at 200k for normalization
        return clamp01(population / 200_000);
    }

    if (livingPreference === "rural") {
        // Lower population = higher score, inverse scale
        return clamp01(1 - population / 50_000);
    }

    // "any" preference
    return DEFAULT_DENSITY_SCORE;
}

function clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
}
