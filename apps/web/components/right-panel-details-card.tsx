"use client";

import type { HTMLAttributes } from "react";
import { useEffect, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCommuneByInsee, type CommuneIndexLiteEntry } from "@/lib/data/communesIndexLite";
import { getInfraZoneById, type InfraZoneIndexLiteEntry } from "@/lib/data/infraZonesIndexLite";
import type { MapSelection } from "@/lib/map/mapSelection";
import { cn } from "@/lib/utils";

interface RightPanelDetailsCardProps extends HTMLAttributes<HTMLDivElement> {
    selection?: MapSelection | null;
}

type CardStatus = "idle" | "loading" | "ready" | "missing" | "error";

const numberFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

export default function RightPanelDetailsCard({ className, selection, ...props }: RightPanelDetailsCardProps): JSX.Element {
    const [status, setStatus] = useState<CardStatus>("idle");
    const [communeDetails, setCommuneDetails] = useState<CommuneIndexLiteEntry | null>(null);
    const [infraZoneDetails, setInfraZoneDetails] = useState<InfraZoneIndexLiteEntry | null>(null);
    const [parentCommuneDetails, setParentCommuneDetails] = useState<CommuneIndexLiteEntry | null>(null);
    const selectionKey = selection ? (selection.kind === "commune" ? selection.inseeCode : selection.id) : null;

    useEffect(() => {
        if (!selection) {
            setStatus("idle");
            setCommuneDetails(null);
            setInfraZoneDetails(null);
            setParentCommuneDetails(null);
            return;
        }

        let alive = true;
        const controller = new AbortController();
        const { signal } = controller;
        setStatus("loading");
        setCommuneDetails(null);
        setInfraZoneDetails(null);
        setParentCommuneDetails(null);

        const activeSelection = selection;

        async function load(target: MapSelection): Promise<void> {
            try {
                if (target.kind === "commune") {
                    const entry = await getCommuneByInsee(target.inseeCode, signal);
                    if (!alive) {
                        return;
                    }
                    if (entry) {
                        setCommuneDetails(entry);
                        setStatus("ready");
                    } else {
                        setStatus("missing");
                    }
                    return;
                }

                const zone = await getInfraZoneById(target.id, signal);
                if (!alive) {
                    return;
                }
                if (!zone) {
                    setStatus("missing");
                    return;
                }
                setInfraZoneDetails(zone);

                const parent = zone.parentCommuneCode
                    ? await getCommuneByInsee(zone.parentCommuneCode, signal)
                    : null;
                if (!alive) {
                    return;
                }
                setParentCommuneDetails(parent);
                setStatus("ready");
            } catch (error) {
                if (!alive || isAbortError(error)) {
                    return;
                }
                if (process.env.NODE_ENV === "development") {
                    console.warn("[details-card] Failed to load selection details", error);
                }
                setStatus("error");
            }
        }

        void load(activeSelection);

        return () => {
            alive = false;
            controller.abort();
        };
    }, [selection?.kind, selectionKey]);

    const selectionLabel = selection
        ? selection.name ?? (selection.kind === "commune" ? selection.inseeCode : selection.id)
        : null;
    const description = selection
        ? selection.kind === "infraZone"
            ? `Zone infra-communale sélectionnée : ${selectionLabel}`
            : `Commune sélectionnée : ${selectionLabel}`
        : "Sélectionne une zone ou une commune pour afficher ses informations.";

    return (
        <Card className={cn("flex h-full min-h-[240px] flex-col lg:min-h-[260px]", className)} {...props}>
            <CardHeader>
                <CardTitle className="text-xl text-brand-dark">Détails</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto text-sm text-brand/80">
                {renderContent({
                    status,
                    selection: selection ?? null,
                    communeDetails,
                    infraZoneDetails,
                    parentCommuneDetails
                })}
            </CardContent>
        </Card>
    );
}

function renderContent({
    status,
    selection,
    communeDetails,
    infraZoneDetails,
    parentCommuneDetails
}: {
    status: CardStatus;
    selection: MapSelection | null;
    communeDetails: CommuneIndexLiteEntry | null;
    infraZoneDetails: InfraZoneIndexLiteEntry | null;
    parentCommuneDetails: CommuneIndexLiteEntry | null;
}): JSX.Element {
    if (!selection || status === "idle") {
        return <InfoMessage message="Aucune sélection active." />;
    }

    if (status === "loading") {
        return <InfoMessage message="Chargement des informations..." loading />;
    }

    if (status === "missing") {
        return <InfoMessage message="Données indisponibles pour cette sélection." />;
    }

    if (status === "error") {
        return <InfoMessage message="Erreur lors du chargement des données." />;
    }

    if (selection.kind === "infraZone") {
        const zone = infraZoneDetails;
        if (!zone) {
            return <InfoMessage message="Données indisponibles pour cette zone." />;
        }
        return (
            <div className="space-y-3">
                <DetailRow label="Nom" value={zone.name} emphasized />
                <DetailRow label="Type" value={zone.type || "—"} />
                <DetailRow label="Code" value={zone.code || zone.id} />
                <DetailRow label="Identifiant" value={zone.id} />
                <DetailRow label="Population" value={formatPopulation(zone.population)} />
                <DetailRow label="Commune parente" value={parentCommuneDetails?.name ?? "—"} />
                <DetailRow label="Code commune parente" value={zone.parentCommuneCode || "—"} />
            </div>
        );
    }

    const commune = communeDetails;
    if (!commune) {
        return <InfoMessage message="Données indisponibles pour cette commune." />;
    }

    return (
        <div className="space-y-3">
            <DetailRow label="Nom" value={commune.name} emphasized />
            <DetailRow label="Code INSEE" value={commune.inseeCode} />
            <DetailRow label="Département" value={commune.departmentCode || "—"} />
            <DetailRow label="Région" value={commune.regionCode || "—"} />
            <DetailRow label="Population" value={formatPopulation(commune.population)} />
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
