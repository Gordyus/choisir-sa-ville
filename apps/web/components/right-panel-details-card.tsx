"use client";

import type { HTMLAttributes } from "react";
import { useEffect, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCommuneByInsee, type CommuneIndexLiteEntry } from "@/lib/data/communesIndexLite";
import type { CityIdentity } from "@/lib/map/interactiveLayers";
import { cn } from "@/lib/utils";

interface RightPanelDetailsCardProps extends HTMLAttributes<HTMLDivElement> {
    selectedCity?: CityIdentity | null;
}

type CardStatus = "idle" | "loading" | "ready" | "missing" | "error";

const numberFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

export default function RightPanelDetailsCard({ className, selectedCity, ...props }: RightPanelDetailsCardProps): JSX.Element {
    const [status, setStatus] = useState<CardStatus>("idle");
    const [details, setDetails] = useState<CommuneIndexLiteEntry | null>(null);

    useEffect(() => {
        if (!selectedCity) {
            setStatus("idle");
            setDetails(null);
            return;
        }

        let alive = true;
        const controller = new AbortController();
        setStatus("loading");
        setDetails(null);

        getCommuneByInsee(selectedCity.id, controller.signal)
            .then((entry) => {
                if (!alive) {
                    return;
                }
                if (entry) {
                    setDetails(entry);
                    setStatus("ready");
                } else {
                    setDetails(null);
                    setStatus("missing");
                }
            })
            .catch((error: unknown) => {
                if (!alive) {
                    return;
                }
                if (isAbortError(error)) {
                    return;
                }
                if (process.env.NODE_ENV === "development") {
                    console.warn("[details-card] Failed to load commune details", error);
                }
                setDetails(null);
                setStatus("error");
            });

        return () => {
            alive = false;
            controller.abort();
        };
    }, [selectedCity?.id]);

    const description = selectedCity
        ? `Informations de base pour ${selectedCity.name}`
        : "Sélectionne une ville pour afficher ses informations.";

    return (
        <Card className={cn("flex h-full min-h-[240px] flex-col lg:min-h-[260px]", className)} {...props}>
            <CardHeader>
                <CardTitle className="text-xl text-brand-dark">Détails</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto text-sm text-brand/80">
                {renderContent({ status, details, selectedCity: selectedCity ?? null })}
            </CardContent>
        </Card>
    );
}

function renderContent({
    status,
    details,
    selectedCity
}: {
    status: CardStatus;
    details: CommuneIndexLiteEntry | null;
    selectedCity: CityIdentity | null;
}): JSX.Element {
    if (!selectedCity || status === "idle") {
        return <InfoMessage message="Aucune ville sélectionnée." />;
    }

    if (status === "loading") {
        return <InfoMessage message="Chargement des informations..." loading />;
    }

    if (status === "missing") {
        return <InfoMessage message="Données indisponibles pour cette commune." />;
    }

    if (status === "error") {
        return <InfoMessage message="Erreur lors du chargement des données." />;
    }

    const resolved = details ?? {
        inseeCode: selectedCity.id,
        name: selectedCity.name,
        departmentCode: "",
        regionCode: "",
        lat: 0,
        lon: 0,
        population: null
    };

    return (
        <div className="space-y-3">
            <DetailRow label="Nom" value={resolved.name} emphasized />
            <DetailRow label="Code INSEE" value={resolved.inseeCode} />
            <DetailRow label="Département" value={resolved.departmentCode || "—"} />
            <DetailRow label="Région" value={resolved.regionCode || "—"} />
            <DetailRow label="Population" value={formatPopulation(resolved.population)} />
        </div>
    );
}

function DetailRow({
    label,
    value,
    emphasized
}: {
    label: string;
    value: string;
    emphasized?: boolean;
}): JSX.Element {
    return (
        <div className="flex items-center justify-between rounded-2xl border border-brand/10 px-3 py-2">
            <span className="text-brand/70">{label}</span>
            <span className={cn("font-semibold", emphasized ? "text-brand-dark" : "text-brand-dark/70")}>{value}</span>
        </div>
    );
}

function InfoMessage({ message, loading = false }: { message: string; loading?: boolean }): JSX.Element {
    return (
        <div className={cn("flex h-full min-h-[120px] items-center justify-center rounded-2xl border border-brand/10 px-4", loading && "animate-pulse")}
        >
            <p className="text-center text-brand/70">{message}</p>
        </div>
    );
}

function formatPopulation(value: number | null): string {
    if (typeof value === "number" && Number.isFinite(value)) {
        return numberFormatter.format(value);
    }
    return "—";
}

function isAbortError(error: unknown): boolean {
    return error instanceof DOMException && error.name === "AbortError";
}
