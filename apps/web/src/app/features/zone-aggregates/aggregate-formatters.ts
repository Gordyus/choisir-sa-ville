import type { ZoneAggregateResult } from "@csv/core";
import { getZoneAggregateDisplay } from "@csv/core";
import {
  CAUTION_BADGE_TOOLTIP,
  MESH_BADGE_TOOLTIP,
  PREDICTION_TOOLTIP,
  QUARTILE_TOOLTIP,
  SOURCE_TOOLTIP_LABEL,
  YEAR_TOOLTIP_LABEL
} from "./aggregate-copy";

type AggregateBadge = {
  label: string;
  tooltip?: string;
  tone?: "neutral" | "warning";
};

const WIDE_INTERVAL_THRESHOLD = 20;

export type AggregateCardContent = {
  title: string;
  value: string;
  yearTooltip: string;
  range?: string;
  rangeTooltip?: string;
  minMax?: string;
  coverage?: string;
  badges?: AggregateBadge[];
};

export function formatAggregateCard(
  result: ZoneAggregateResult<unknown>
): AggregateCardContent | null {
  const display = getZoneAggregateDisplay(result.base.aggregateId);
  if (!display) return null;

  const formatted = formatAggregateValue(result.base.aggregateId, result.payload, display.unit);
  if (!formatted) return null;

  return {
    title: display.label,
    value: formatted.value,
    yearTooltip: buildYearTooltip(
      result.base.periodYear,
      result.base.source,
      result.base.sourceVersion,
      extractAttribution(result.payload)
    ),
    range: formatted.range,
    rangeTooltip: formatted.rangeTooltip,
    minMax: formatted.minMax,
    badges: formatAggregateBadges(result.base.aggregateId, result.payload)
  };
}

function formatAggregateValue(
  aggregateId: string,
  payload: unknown,
  unit?: string
): {
  value: string;
  range?: string;
  rangeTooltip?: string;
  minMax?: string;
} | null {
  if (aggregateId === "rent.v1" && payload && typeof payload === "object") {
    const rentPayload = payload as {
      rentMedianPerM2?: number;
      rentP25PerM2?: number | null;
      rentP75PerM2?: number | null;
      rentPredLowerPerM2?: number | null;
      rentPredUpperPerM2?: number | null;
      rentMinPerM2?: number | null;
      rentMaxPerM2?: number | null;
    };
    if (typeof rentPayload.rentMedianPerM2 !== "number") return null;

    const formattedUnit = formatUnit(unit);
    const value = `Median: ${formatNumber(rentPayload.rentMedianPerM2)}${formatUnitSuffix(
      formattedUnit
    )}`;

    let range: string | undefined;
    let rangeTooltip: string | undefined;

    if (
      typeof rentPayload.rentP25PerM2 === "number" &&
      typeof rentPayload.rentP75PerM2 === "number"
    ) {
      range = `P25-P75: ${formatRange(
        rentPayload.rentP25PerM2,
        rentPayload.rentP75PerM2,
        formattedUnit
      )}`;
      rangeTooltip = QUARTILE_TOOLTIP;
    } else if (
      typeof rentPayload.rentPredLowerPerM2 === "number" &&
      typeof rentPayload.rentPredUpperPerM2 === "number"
    ) {
      range = `Prediction interval: ${formatRange(
        rentPayload.rentPredLowerPerM2,
        rentPayload.rentPredUpperPerM2,
        formattedUnit
      )}`;
      rangeTooltip = PREDICTION_TOOLTIP;
    }

    const minMax =
      typeof rentPayload.rentMinPerM2 === "number" &&
      typeof rentPayload.rentMaxPerM2 === "number"
        ? `Min-Max: ${formatRange(
            rentPayload.rentMinPerM2,
            rentPayload.rentMaxPerM2,
            formattedUnit
          )}`
        : undefined;

    return {
      value,
      range,
      rangeTooltip,
      minMax
    };
  }

  return null;
}

function formatAggregateBadges(aggregateId: string, payload: unknown): AggregateBadge[] | undefined {
  if (aggregateId !== "rent.v1" || !payload || typeof payload !== "object") return undefined;
  const rentPayload = payload as {
    rentPredLowerPerM2?: number | null;
    rentPredUpperPerM2?: number | null;
    _meta?: {
      nbobs_com?: number | null;
      r2_adj?: number | null;
      typPred?: string | null;
    };
  };
  const meta = rentPayload._meta;
  const badges: AggregateBadge[] = [];

  if (meta?.typPred?.toLowerCase() === "maille") {
    badges.push({ label: "Estimated (mesh)", tooltip: MESH_BADGE_TOOLTIP, tone: "neutral" });
  }

  const hasLowR2 = typeof meta?.r2_adj === "number" && meta.r2_adj < 0.5;
  const hasLowObs = typeof meta?.nbobs_com === "number" && meta.nbobs_com < 30;
  const hasWideInterval =
    typeof rentPayload.rentPredLowerPerM2 === "number" &&
    typeof rentPayload.rentPredUpperPerM2 === "number" &&
    rentPayload.rentPredUpperPerM2 - rentPayload.rentPredLowerPerM2 >= WIDE_INTERVAL_THRESHOLD;

  if (hasLowR2 || hasLowObs || hasWideInterval) {
    badges.push({ label: "Use with caution", tooltip: CAUTION_BADGE_TOOLTIP, tone: "warning" });
  }

  return badges.length > 0 ? badges : undefined;
}

function formatNumber(value: number): string {
  const formatted = value.toFixed(1);
  return formatted.endsWith(".0") ? formatted.slice(0, -2) : formatted;
}

function formatRange(left: number, right: number, unit?: string): string {
  const formattedLeft = formatNumber(left);
  const formattedRight = formatNumber(right);
  return `${formattedLeft}-${formattedRight}${formatUnitSuffix(unit)}`;
}

function formatUnit(unit: string | undefined): string | undefined {
  if (!unit) return undefined;
  if (unit.toLowerCase() === "eur/m2") return "€/m²";
  return unit;
}

function formatUnitSuffix(unit: string | undefined): string {
  return unit ? ` ${unit}` : "";
}

function buildYearTooltip(
  periodYear: number,
  source: string,
  sourceVersion: string,
  attribution: string | null
): string {
  const sourceLabel =
    source && sourceVersion ? `${source} (${sourceVersion})` : sourceVersion || source;
  const lines = [
    `${YEAR_TOOLTIP_LABEL}: ${periodYear}`,
    `${SOURCE_TOOLTIP_LABEL}: ${sourceLabel}`
  ];
  if (attribution) {
    lines.push(attribution);
  }
  return lines.join("\n");
}

function extractAttribution(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const meta = (payload as { _meta?: { attribution?: string } })._meta;
  if (meta?.attribution) return meta.attribution;
  return null;
}
