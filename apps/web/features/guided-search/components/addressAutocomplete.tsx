"use client";

/**
 * Address search with BAN API autocomplete.
 * Uses Popover for dropdown and inline tag for selected address.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Destination } from "@/lib/search/types";

import { useAddressSearch } from "../hooks/useAddressSearch";

interface AddressAutocompleteProps {
    value: Destination | null;
    onSelect: (destination: Destination | null) => void;
}

export default function AddressAutocomplete({ value, onSelect }: AddressAutocompleteProps) {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const { suggestions, isLoading } = useAddressSearch(query);

    useEffect(() => {
        setHighlightedIndex(-1);
    }, [suggestions]);

    const handleSelect = useCallback(
        (suggestion: (typeof suggestions)[number]) => {
            onSelect({
                lat: suggestion.lat,
                lng: suggestion.lng,
                label: `${suggestion.city} (${suggestion.postcode})`,
            });
            setQuery("");
            setOpen(false);
        },
        [onSelect]
    );

    const handleClear = useCallback(() => {
        onSelect(null);
        setQuery("");
    }, [onSelect]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "ArrowDown") {
                setHighlightedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
            } else if (e.key === "ArrowUp") {
                setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
            } else if (e.key === "Enter") {
                if (highlightedIndex >= 0) {
                    e.preventDefault();
                    const selected = suggestions[highlightedIndex];
                    if (selected !== undefined) {
                        handleSelect(selected);
                    }
                }
            } else if (e.key === "Escape") {
                setOpen(false);
            }
        },
        [highlightedIndex, suggestions, handleSelect]
    );

    if (value !== null) {
        return (
            <div className="relative flex items-center">
                <svg
                    className="absolute left-2 h-4 w-4 text-muted-foreground shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <path d="M12 2C8.686 2 6 4.686 6 8c0 5.25 6 13 6 13s6-7.75 6-13c0-3.314-2.686-6-6-6z" />
                    <circle cx="12" cy="8" r="2" />
                </svg>
                <span className="pl-8 pr-2 py-1.5 rounded-full bg-gray-100 border border-gray-200 text-sm flex items-center gap-2 max-w-full">
                    <span className="truncate">{value.label}</span>
                    <button
                        type="button"
                        onClick={handleClear}
                        className="shrink-0 text-muted-foreground hover:text-foreground leading-none"
                        aria-label="Supprimer la destination"
                    >
                        ×
                    </button>
                </span>
            </div>
        );
    }

    return (
        <Popover open={open && suggestions.length > 0} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <div className="relative flex items-center">
                    <svg
                        className="absolute left-2 h-4 w-4 text-muted-foreground shrink-0"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <path d="M12 2C8.686 2 6 4.686 6 8c0 5.25 6 13 6 13s6-7.75 6-13c0-3.314-2.686-6-6-6z" />
                        <circle cx="12" cy="8" r="2" />
                    </svg>
                    <Input
                        ref={inputRef}
                        type="text"
                        placeholder="Ajouter une localisation"
                        value={query}
                        className="pl-8"
                        onChange={(e) => {
                            setQuery(e.target.value);
                            if (e.target.value.trim().length >= 3) {
                                setOpen(true);
                            }
                        }}
                        onFocus={() => {
                            if (suggestions.length > 0) {
                                setOpen(true);
                            }
                        }}
                        onKeyDown={handleKeyDown}
                    />
                </div>
            </PopoverTrigger>
            <PopoverContent
                className="w-[var(--radix-popover-trigger-width)] p-0 bg-white border shadow-lg"
                align="start"
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                <ul role="listbox" className="max-h-60 overflow-y-auto py-1">
                    {isLoading && (
                        <li className="px-3 py-2 text-sm text-muted-foreground">
                            Recherche...
                        </li>
                    )}
                    {suggestions.map((suggestion, index) => (
                        <li
                            key={`${suggestion.lat}-${suggestion.lng}-${suggestion.label}`}
                            role="option"
                            aria-selected={index === highlightedIndex}
                        >
                            <button
                                type="button"
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors${index === highlightedIndex ? " bg-gray-100" : ""}`}
                                onClick={() => handleSelect(suggestion)}
                            >
                                <span className="block truncate font-medium">
                                    {suggestion.label}
                                </span>
                                <span className="block truncate text-xs text-muted-foreground">
                                    {suggestion.city} {suggestion.postcode}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            </PopoverContent>
        </Popover>
    );
}
