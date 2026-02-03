import type { HTMLAttributes } from "react";

import RightPanelDetailsCard from "@/components/right-panel-details-card";
import type { CityIdentity } from "@/lib/map/interactiveLayers";
import { cn } from "@/lib/utils";

type RightPanelProps = HTMLAttributes<HTMLDivElement> & {
    selectedCity?: CityIdentity | null;
};

export default function RightPanel({ className, selectedCity, ...props }: RightPanelProps): JSX.Element {
    return (
        <section
            className={cn(
                "flex h-full w-full flex-col rounded-3xl border border-brand/15 bg-white/80 p-6 shadow-lg",
                "backdrop-blur",
                className
            )}
            {...props}
        >
            <div className="flex h-full flex-col gap-6">
                <div className="space-y-4">
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
                <RightPanelDetailsCard className="w-full lg:mt-auto lg:flex-1" selectedCity={selectedCity ?? null} />
            </div>
        </section>
    );
}
