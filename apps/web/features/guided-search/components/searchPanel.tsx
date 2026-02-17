"use client";

/**
 * Main search panel container.
 * Switches rendered content based on search phase.
 */

import { useSearchPhase } from "@/lib/search/hooks";

import SearchForm from "./searchForm";
import SearchProgress from "./searchProgress";
import SearchResults from "./searchResults";

export default function SearchPanel() {
    const phase = useSearchPhase();

    switch (phase) {
        case "idle":
        case "form":
            return <SearchForm />;
        case "computing":
            return <SearchProgress />;
        case "results":
            return <SearchResults />;
    }
}
