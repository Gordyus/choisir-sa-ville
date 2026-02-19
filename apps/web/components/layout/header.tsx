"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { panelTabService } from "@/lib/panelTab";

export default function Header(): JSX.Element {
    const handleSearchClick = (): void => {
        panelTabService.setTab("search");
    };

    const handleExplorerClick = (): void => {
        panelTabService.setTab("explorer");
    };

    return (
        <header className="sticky top-0 z-20 border-b border-brand/10 bg-white/90 backdrop-blur">
            <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-4 sm:px-6">
                <div className="space-y-1">
                    <p className="text-[0.65rem] uppercase tracking-[0.4em] text-brand/80">
                        Choisir sa ville
                    </p>
                    <div className="flex items-baseline gap-3">
                        <h1 className="text-xl font-semibold text-brand-dark">
                            Cartographie exploratoire
                        </h1>
                        <span className="rounded-full border border-brand/20 px-3 py-0.5 text-xs text-brand/80">
                            MVP
                        </span>
                    </div>
                </div>
                <nav className="hidden items-center gap-8 text-sm text-brand/80 md:flex">
                    <button
                        type="button"
                        onClick={handleExplorerClick}
                        className="transition hover:text-brand-dark"
                    >
                        Explorer
                    </button>
                    <button
                        type="button"
                        onClick={handleSearchClick}
                        className="transition hover:text-brand-dark"
                    >
                        Recherche guidée
                    </button>
                    <Link
                        href="/faq"
                        className="transition hover:text-brand-dark"
                    >
                        FAQ
                    </Link>
                </nav>
                <Button className="hidden sm:inline-flex" variant="subtle" onClick={handleSearchClick}>
                    Lancer une recherche
                </Button>
            </div>
        </header>
    );
}
