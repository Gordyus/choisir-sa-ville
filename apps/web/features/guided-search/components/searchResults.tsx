"use client";

/**
 * Results phase UI with sorting, collapsible criteria, and result list.
 */

import { useCallback, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSearchState } from "@/lib/search/hooks";
import { getSearchService } from "@/lib/search/searchService";
import type { SearchResult } from "@/lib/search/types";

import CriteriaSummary from "./criteriaSummary";
import SearchEmptyState from "./searchEmptyState";
import SearchResultRow from "./searchResultRow";

type SortKey = "travel" | "security" | "population";

function sortResults(results: SearchResult[], sortKey: SortKey): SearchResult[] {
    const sorted = [...results];
    switch (sortKey) {
        case "travel":
            sorted.sort((a, b) => a.travelSeconds - b.travelSeconds);
            break;
        case "security":
            sorted.sort((a, b) => (a.securityLevel ?? 5) - (b.securityLevel ?? 5));
            break;
        case "population":
            sorted.sort((a, b) => (b.population ?? 0) - (a.population ?? 0));
            break;
    }
    return sorted;
}

export default function SearchResults() {
    const state = useSearchState();
    const [sortKey, setSortKey] = useState<SortKey>("travel");

    const sortedResults = useMemo(
        () => sortResults(state.results, sortKey),
        [state.results, sortKey]
    );

    const handleReset = useCallback(() => {
        getSearchService().reset();
    }, []);

    const handleRetry = useCallback(() => {
        getSearchService().startSearch(state.criteria);
    }, [state.criteria]);

    return (
        <div className="flex flex-col h-full">
            <div className="p-4 space-y-3 flex-shrink-0">
                {/* Error banner */}
                {state.error !== null && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
                        <p className="font-medium text-red-800 mb-2">
                            {state.error.message}
                        </p>
                        <div className="flex gap-2">
                            <Button size="sm" onClick={handleRetry}>
                                Reessayer
                            </Button>
                            {state.error.hasPartialResults && (
                                <Button size="sm" variant="subtle">
                                    Voir resultats partiels
                                </Button>
                            )}
                        </div>
                    </div>
                )}

                {/* Count */}
                <p className="text-sm font-medium">
                    {state.results.length} commune{state.results.length !== 1 ? "s" : ""} trouvee{state.results.length !== 1 ? "s" : ""}
                </p>

                {/* Collapsible criteria */}
                <Collapsible>
                    <CollapsibleTrigger className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                        Voir les criteres
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-2">
                        <CriteriaSummary criteria={state.criteria} />
                    </CollapsibleContent>
                </Collapsible>

                {/* Sort buttons */}
                {state.results.length > 0 && (
                    <div className="flex gap-1">
                        {([
                            ["travel", "Trajet"],
                            ["security", "Securite"],
                            ["population", "Population"],
                        ] as const).map(([key, label]) => (
                            <Button
                                key={key}
                                size="sm"
                                variant={sortKey === key ? "default" : "ghost"}
                                onClick={() => setSortKey(key)}
                            >
                                {label}
                            </Button>
                        ))}
                    </div>
                )}
            </div>

            {/* Results list */}
            {state.results.length === 0 && state.error === null ? (
                <SearchEmptyState />
            ) : (
                <ScrollArea className="flex-1">
                    <div className="px-2 pb-4">
                        {sortedResults.map((result, index) => (
                            <SearchResultRow
                                key={result.inseeCode}
                                result={result}
                                rank={index + 1}
                            />
                        ))}
                    </div>
                </ScrollArea>
            )}

            {/* Footer */}
            <div className="p-4 border-t flex-shrink-0">
                <Button
                    variant="subtle"
                    className="w-full"
                    onClick={handleReset}
                >
                    Modifier les criteres
                </Button>
            </div>
        </div>
    );
}
