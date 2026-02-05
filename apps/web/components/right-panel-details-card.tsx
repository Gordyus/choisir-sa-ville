"use client";

/**
 * Right Panel Details Card
 *
 * Displays details about the currently selected entity.
 * Uses the centralized SelectionService and EntityDataProvider.
 *
 * ARCHITECTURE:
 * - Subscribes to SelectionService for active entity
 * - Uses EntityDataProvider hooks for data fetching with caching
 * - NO dependency on map components
 */

import type { HTMLAttributes } from "react";
import { useEffect, useState } from "react";

import { InsecurityBadge } from "@/components/insecurity-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCommuneByInsee, type CommuneIndexLiteEntry } from "@/lib/data/communesIndexLite";
import { getInfraZoneById, type InfraZoneIndexLiteEntry } from "@/lib/data/infraZonesIndexLite";
import { useActiveEntity, type EntityRef } from "@/lib/selection";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

type RightPanelDetailsCardProps = HTMLAttributes<HTMLDivElement>;

type CardStatus = "idle" | "loading" | "ready" | "missing" | "error";

// ============================================================================
// Formatters
// ============================================================================

const numberFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

function formatPopulation(value: number | null): string {
    if (typeof value === "number" && Number.isFinite(value)) {
        return numberFormatter.format(value);
    }
    return "—";
}

function isAbortError(error: unknown): boolean {
    return error instanceof DOMException && error.name === "AbortError";
}

// ============================================================================
// Component
// ============================================================================

export default function RightPanelDetailsCard({
    className,
    ...props
}: RightPanelDetailsCardProps): JSX.Element {
    // Get active entity from SelectionService
    const activeEntity = useActiveEntity();

    // Local state for loaded data
    const [status, setStatus] = useState<CardStatus>("idle");
    const [communeDetails, setCommuneDetails] = useState<CommuneIndexLiteEntry | null>(null);
    const [infraZoneDetails, setInfraZoneDetails] = useState<InfraZoneIndexLiteEntry | null>(null);
    const [parentCommuneDetails, setParentCommuneDetails] = useState<CommuneIndexLiteEntry | null>(null);

    // Derive selection key for effect dependency
    const selectionKey = activeEntity
        ? activeEntity.kind === "commune"
            ? activeEntity.inseeCode
            : activeEntity.id
        : null;

    // Load entity data when selection changes
    useEffect(() => {
        if (!activeEntity) {
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

        async function loadEntity(ref: EntityRef): Promise<void> {
            try {
                if (ref.kind === "commune") {
                    const entry = await getCommuneByInsee(ref.inseeCode, signal);
                    if (!alive) return;

                    if (entry) {
                        setCommuneDetails(entry);
                        setStatus("ready");
                    } else {
                        setStatus("missing");
                    }
                    return;
                }

                // InfraZone
                const zone = await getInfraZoneById(ref.id, signal);
                if (!alive) return;

                if (!zone) {
                    setStatus("missing");
                    return;
                }

                setInfraZoneDetails(zone);

                // Load parent commune
                const parent = zone.parentCommuneCode
                    ? await getCommuneByInsee(zone.parentCommuneCode, signal)
                    : null;

                if (!alive) return;

                setParentCommuneDetails(parent);
                setStatus("ready");
            } catch (error) {
                if (!alive || isAbortError(error)) return;

                if (process.env.NODE_ENV === "development") {
                    console.warn("[details-card] Failed to load entity details", error);
                }
                setStatus("error");
            }
        }

        void loadEntity(activeEntity);

        return () => {
            alive = false;
            controller.abort();
        };
    }, [activeEntity?.kind, selectionKey]);

    // Build description
    const description = activeEntity
        ? activeEntity.kind === "infraZone"
            ? `Zone infra-communale sélectionnée`
            : `Commune sélectionnée`
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
                    activeEntity,
                    communeDetails,
                    infraZoneDetails,
                    parentCommuneDetails
                })}
            </CardContent>
        </Card>
    );
}

// ============================================================================
// Content Renderer
// ============================================================================

function renderContent({
    status,
    activeEntity,
    communeDetails,
    infraZoneDetails,
    parentCommuneDetails
}: {
    status: CardStatus;
    activeEntity: EntityRef | null;
    communeDetails: CommuneIndexLiteEntry | null;
    infraZoneDetails: InfraZoneIndexLiteEntry | null;
    parentCommuneDetails: CommuneIndexLiteEntry | null;
}): JSX.Element {
    if (!activeEntity || status === "idle") {
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

    if (activeEntity.kind === "infraZone") {
        const zone = infraZoneDetails;
        if (!zone) {
            return <InfoMessage message="Données indisponibles pour cette zone." />;
        }
        return (
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <DetailRow label="Nom" value={zone.name} emphasized />
                    <InsecurityBadge inseeCode={zone.parentCommuneCode} />
                </div>
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
            <div className="flex items-center justify-between">
                <DetailRow label="Nom" value={commune.name} emphasized />
                <InsecurityBadge inseeCode={commune.inseeCode} />
            </div>
            <DetailRow label="Code INSEE" value={commune.inseeCode} />
            <DetailRow label="Département" value={commune.departmentCode || "—"} />
            <DetailRow label="Région" value={commune.regionCode || "—"} />
            <DetailRow label="Population" value={formatPopulation(commune.population)} />
        </div>
    );
}

// ============================================================================
// Helper Components
// ============================================================================

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
            <span className={cn("font-semibold", emphasized ? "text-brand-dark" : "text-brand-dark/70")}>
                {value}
            </span>
        </div>
    );
}

function InfoMessage({ message, loading = false }: { message: string; loading?: boolean }): JSX.Element {
    return (
        <div
            className={cn(
                "flex h-full min-h-[120px] items-center justify-center rounded-2xl border border-brand/10 px-4",
                loading && "animate-pulse"
            )}
        >
            <p className="text-center text-brand/70">{message}</p>
        </div>
    );
}
