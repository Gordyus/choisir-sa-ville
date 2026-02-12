/**
 * Right Panel Component
 *
 * Displays analysis and details about the current selection.
 * Uses SelectionService - NO dependency on map components.
 */

import type { HTMLAttributes } from "react";

import { RightPanelDetailsCard } from "@/features/entity-details";
import { cn } from "@/lib/utils";

type RightPanelProps = HTMLAttributes<HTMLDivElement>;

export default function RightPanel({ className, ...props }: RightPanelProps): JSX.Element {
    return (
        <section
            className={cn(
                "flex h-full w-full flex-col overflow-hidden rounded-3xl border border-brand/15 bg-white/80 p-6 shadow-lg",
                "backdrop-blur",
                className
            )}
            {...props}
        >
            <div className="flex h-full min-h-0 flex-col gap-6">
                <div className="flex-shrink-0 space-y-4">
                    <header className="space-y-2">
                        <p className="text-xs uppercase tracking-[0.3em] text-brand/60">Panneau</p>
                        <h2 className="text-2xl font-semibold text-brand-dark">Analyse à venir</h2>
                    </header>
                    <p className="text-sm text-brand/80">
                        Cette zone accueillera prochainement les agrégats, filtres et résultats basés sur la
                        position de la carte. La structure layout et la gestion des états réseau sont déjà prêtes.
                    </p>
                    <div className="rounded-2xl border border-dashed border-brand/30 p-4 text-xs text-brand/70">
                        Les requêtes seront déclenchées après un &laquo;moveend&raquo;/&laquo;zoomend&raquo; stable et
                        seront automatiquement annulées avant d&apos;être relancées.
                    </div>
                </div>
                <RightPanelDetailsCard className="min-h-0 w-full flex-1" />
            </div>
        </section>
    );
}
