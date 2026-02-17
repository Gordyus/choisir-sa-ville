"use client";

/**
 * Computing phase UI with progress bar and cancel button.
 */

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useSearchProgress, useSearchState } from "@/lib/search/hooks";
import { getSearchService } from "@/lib/search/searchService";

import CriteriaSummary from "./criteriaSummary";

export default function SearchProgress() {
    const state = useSearchState();
    const progress = useSearchProgress();

    const analyzed = progress?.analyzedCommunes ?? 0;
    const total = progress?.totalCommunes ?? 0;
    const percent = total > 0 ? Math.round((analyzed / total) * 100) : 0;

    return (
        <div className="flex flex-col gap-4 p-4">
            <CriteriaSummary criteria={state.criteria} />

            <div className="space-y-2">
                <Progress value={percent} className="h-2" />
                <p className="text-sm text-muted-foreground">
                    {analyzed} / {total} communes analysees
                </p>
            </div>

            <Button
                variant="subtle"
                size="sm"
                onClick={() => getSearchService().cancelSearch()}
            >
                Annuler
            </Button>
        </div>
    );
}
