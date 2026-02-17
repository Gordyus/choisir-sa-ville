"use client";

/**
 * Empty state displayed when search returns 0 results.
 */

import { Button } from "@/components/ui/button";
import { getSearchService } from "@/lib/search/searchService";

export default function SearchEmptyState() {
    return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
            <span className="text-4xl mb-4" role="img" aria-label="Recherche">
                {"\uD83D\uDD0D"}
            </span>
            <p className="text-lg font-medium text-brand-dark mb-2">
                Aucune commune trouvee
            </p>
            <p className="text-sm text-muted-foreground mb-6">
                Essayez d&apos;elargir vos criteres de recherche
            </p>
            <Button
                variant="subtle"
                onClick={() => getSearchService().reset()}
            >
                Modifier les criteres
            </Button>
        </div>
    );
}
