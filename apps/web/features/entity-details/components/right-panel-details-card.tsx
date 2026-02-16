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

import { InsecurityBadge } from "@/features/entity-details";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getCommuneByInsee, type CommuneIndexLiteEntry } from "@/lib/data/communesIndexLite";
import { getInfraZoneById, type InfraZoneIndexLiteEntry } from "@/lib/data/infraZonesIndexLite";
import { getTransactionHistory } from "@/features/transactions";
import {
    buildMutationCompositionLabel,
    computePricePerM2,
    hasLotDetails,
    isMutationComplex,
    isMutationGrouped
} from "@/features/transactions";
import { useActiveEntity, type EntityRef, type MutationSummary, type TransactionAddressData } from "@/lib/selection";
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
const priceFormatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

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
    const [transactionDetails, setTransactionDetails] = useState<TransactionAddressData | null>(null);

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
            setTransactionDetails(null);
            return;
        }

        let alive = true;
        const controller = new AbortController();
        const { signal } = controller;

        setStatus("loading");
        setCommuneDetails(null);
        setInfraZoneDetails(null);
        setParentCommuneDetails(null);
        setTransactionDetails(null);

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

                if (ref.kind === "transactionAddress") {
                    const history = await getTransactionHistory(ref, signal);
                    if (!alive) return;

                    if (history) {
                        setTransactionDetails(history);
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
        ? activeEntity.kind === "transactionAddress"
            ? "Transactions à cette adresse"
            : activeEntity.kind === "infraZone"
                ? "Zone infra-communale sélectionnée"
                : "Commune sélectionnée"
        : "Sélectionne une zone ou une commune pour afficher ses informations.";

    return (
        <Card className={cn("flex h-full min-h-0 flex-col border-0 bg-transparent shadow-none", className)} {...props}>
            <CardHeader className="flex-shrink-0 px-5 pb-3 pt-5">
                <CardTitle className="text-lg font-semibold text-brand-dark">Détails</CardTitle>
                <CardDescription className="text-xs">{description}</CardDescription>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 text-sm text-brand/80">
                {renderContent({
                    status,
                    activeEntity,
                    communeDetails,
                    infraZoneDetails,
                    parentCommuneDetails,
                    transactionDetails
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
    parentCommuneDetails,
    transactionDetails
}: {
    status: CardStatus;
    activeEntity: EntityRef | null;
    communeDetails: CommuneIndexLiteEntry | null;
    infraZoneDetails: InfraZoneIndexLiteEntry | null;
    parentCommuneDetails: CommuneIndexLiteEntry | null;
    transactionDetails: TransactionAddressData | null;
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

    if (activeEntity.kind === "transactionAddress") {
        if (!transactionDetails) {
            return <InfoMessage message="Données indisponibles pour cette adresse." />;
        }
        return <TransactionHistoryView data={transactionDetails} />;
    }

    if (activeEntity.kind === "infraZone") {
        const zone = infraZoneDetails;
        if (!zone) {
            return <InfoMessage message="Données indisponibles pour cette zone." />;
        }
        return (
            <div className="space-y-1">
                <div className="flex items-center justify-between pb-2">
                    <h3 className="text-base font-semibold text-brand-dark">{zone.name}</h3>
                    <InsecurityBadge inseeCode={zone.parentCommuneCode} />
                </div>
                <div className="divide-y divide-brand/5">
                    <DetailRow label="Type" value={zone.type || "—"} />
                    <DetailRow label="Code" value={zone.code || zone.id} />
                    <DetailRow label="Population" value={formatPopulation(zone.population)} />
                    <DetailRow label="Commune parente" value={parentCommuneDetails?.name ?? "—"} />
                    <DetailRow label="Code commune" value={zone.parentCommuneCode || "—"} />
                </div>
            </div>
        );
    }

    const commune = communeDetails;
    if (!commune) {
        return <InfoMessage message="Données indisponibles pour cette commune." />;
    }

    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between pb-2">
                <h3 className="text-base font-semibold text-brand-dark">{commune.name}</h3>
                <InsecurityBadge inseeCode={commune.inseeCode} />
            </div>
            <div className="divide-y divide-brand/5">
                <DetailRow label="Code INSEE" value={commune.inseeCode} />
                <DetailRow label="Département" value={commune.departmentCode || "—"} />
                <DetailRow label="Région" value={commune.regionCode || "—"} />
                <DetailRow label="Population" value={formatPopulation(commune.population)} />
            </div>
        </div>
    );
}

// ============================================================================
// Transaction History View
// ============================================================================

function TransactionHistoryView({ data }: { data: TransactionAddressData }): JSX.Element {
    const sortedMutations = [...data.mutations].sort((a, b) => b.date.localeCompare(a.date));

    return (
        <div className="space-y-4">
            {/* Header: Address + count (compact, no borders) */}
            <div>
                <h3 className="font-semibold text-brand-dark">{data.label}</h3>
                <p className="text-xs text-brand/50">
                    Nombre de ventes : {data.mutations.length}
                </p>
            </div>

            {/* Scrollable list of mutations */}
            <div className="space-y-2">
                {sortedMutations.map((mutation) => (
                    <MutationCard key={mutation.mutationId} mutation={mutation} currentAddressLabel={data.label} />
                ))}
            </div>
        </div>
    );
}

function MutationCard({ mutation, currentAddressLabel }: { mutation: MutationSummary; currentAddressLabel?: string }): JSX.Element {
    const [showDetails, setShowDetails] = useState(false);
    const compositionLabel = buildMutationCompositionLabel(mutation);
    const pricePerM2 = computePricePerM2(mutation);
    const isGrouped = isMutationGrouped(mutation);
    const isComplex = isMutationComplex(mutation);
    const hasMultipleCadastralParcels = mutation.cadastralParcelCount > 5;

    // Filter out current address from related addresses
    const relatedAddresses = mutation.relatedAddresses
        ? mutation.relatedAddresses.filter((addr) => addr !== currentAddressLabel)
        : [];
    const hasMultipleAddresses = relatedAddresses.length > 0;

    return (
        <div className="rounded-lg border border-brand/10 bg-white px-3 py-2.5 space-y-2">
            {/* Date */}
            <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-brand/70">{formatDate(mutation.date)}</span>
                <TooltipProvider>
                    <div className="flex items-center gap-1.5">
                        {isGrouped && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Badge variant="default" className="text-[10px] px-1.5 py-0.5">
                                        Vente groupée
                                    </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p className="max-w-xs">
                                        Cette vente concerne plusieurs logements achetés ensemble lors du même acte notarié.
                                    </p>
                                </TooltipContent>
                            </Tooltip>
                        )}
                        {isComplex && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Badge variant="info" className="text-[10px] px-1.5 py-0.5">
                                        Vente complexe
                                    </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p className="max-w-xs">
                                        Cette vente inclut des dépendances (cave, parking...) ou de nombreuses parcelles cadastrales. Le prix affiché représente l'ensemble et n'est pas directement comparable à un bien isolé.
                                    </p>
                                </TooltipContent>
                            </Tooltip>
                        )}
                    </div>
                </TooltipProvider>
            </div>

            {/* Warning: Multi-parcel sale */}
            {hasMultipleCadastralParcels && (
                <div className="rounded-md bg-amber-50 border border-amber-200 px-2 py-1.5 text-[11px] text-amber-900">
                    <span className="font-semibold">⚠️ Vente multi-parcelles</span>
                    <span className="ml-1">
                        ({mutation.cadastralParcelCount} parcelles cadastrales) — Prix global non représentatif d'un bien isolé
                    </span>
                </div>
            )}

            {/* Composition */}
            <div className="text-sm font-medium text-brand-dark">
                {compositionLabel}
            </div>

            {/* Related addresses */}
            {hasMultipleAddresses && (
                <div className="rounded-md bg-blue-50 border border-blue-200 px-2 py-1.5 text-[11px] text-blue-900">
                    <details className="cursor-pointer">
                        <summary className="font-semibold list-none">
                            <span className="hover:underline">
                                📍 Cette vente concerne aussi {relatedAddresses.length} autre{relatedAddresses.length > 1 ? "s" : ""} adresse{relatedAddresses.length > 1 ? "s" : ""}
                            </span>
                        </summary>
                        <div className="mt-1.5 space-y-0.5 pl-3">
                            {relatedAddresses.slice(0, 10).map((addr, idx) => (
                                <div key={idx} className="text-[11px] text-blue-800">
                                    • {addr}
                                </div>
                            ))}
                            {relatedAddresses.length > 10 && (
                                <div className="text-[11px] text-blue-700 italic">
                                    ... et {relatedAddresses.length - 10} autre{relatedAddresses.length - 10 > 1 ? "s" : ""} adresse{relatedAddresses.length - 10 > 1 ? "s" : ""}
                                </div>
                            )}
                        </div>
                    </details>
                </div>
            )}

            {/* Price + Price/m² */}
            <div className="flex items-baseline justify-between pt-1">
                <span className="text-base font-bold text-brand-dark">
                    {priceFormatter.format(mutation.priceEurTotal)}
                </span>
                {pricePerM2 !== null ? (
                    <span className="text-sm font-semibold text-brand/70">
                        {priceFormatter.format(pricePerM2)}/m²
                    </span>
                ) : (
                    <span className="text-xs text-brand/40 italic">
                        Prix/m² non pertinent
                    </span>
                )}
            </div>

            {/* Optional: Show lot details — only if lots have info beyond the summary */}
            {hasLotDetails(mutation) && (
                <div>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 text-xs text-brand/70 hover:text-brand hover:bg-transparent"
                        onClick={() => setShowDetails(!showDetails)}
                    >
                        {showDetails ? "Masquer le détail" : "Voir le détail"}
                    </Button>
                    {showDetails && (
                        <div className="mt-2 space-y-1 border-l-2 border-brand/20 pl-3">
                            {mutation.lots!.map((lot, idx: number) => (
                                <div key={idx} className="text-xs text-brand/60">
                                    • {lot.typeLocal}
                                    {lot.roomCount !== null && ` ${lot.roomCount}p`}
                                    {lot.surfaceM2 !== null && ` (${Math.round(lot.surfaceM2)} m²)`}
                                    {lot.landSurfaceM2 !== null && lot.landSurfaceM2 > 0 && `, terrain ${Math.round(lot.landSurfaceM2)} m²`}
                                    {lot.isVefa && " - VEFA"}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function formatDate(isoDate: string): string {
    try {
        const date = new Date(isoDate);
        return new Intl.DateTimeFormat("fr-FR", {
            day: "numeric",
            month: "long",
            year: "numeric"
        }).format(date);
    } catch {
        return isoDate;
    }
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
        <div className="flex items-center justify-between py-2">
            <span className="text-xs text-brand/50">{label}</span>
            <span className={cn("text-sm font-medium", emphasized ? "text-brand-dark" : "text-brand-dark/80")}>
                {value}
            </span>
        </div>
    );
}

function InfoMessage({ message, loading = false }: { message: string; loading?: boolean }): JSX.Element {
    return (
        <div
            className={cn(
                "flex h-full min-h-[120px] items-center justify-center px-4",
                loading && "animate-pulse"
            )}
        >
            <p className="text-center text-sm text-brand/40">{message}</p>
        </div>
    );
}
