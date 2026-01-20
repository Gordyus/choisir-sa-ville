import type { ZoneAggregateResult } from "@csv/core";
import { getZoneAggregateDisplay } from "@csv/core";

export type AggregateCardContent = {
  title: string;
  value: string;
  subtitle: string;
};

export function formatAggregateCard(
  result: ZoneAggregateResult<unknown>
): AggregateCardContent | null {
  const display = getZoneAggregateDisplay(result.base.aggregateId);
  if (!display) return null;

  const formatted = formatAggregateValue(result.base.aggregateId, result.payload, display.unit);
  if (!formatted) return null;

  const coveragePercent = Math.round(result.base.coverage * 100);
  const subtitle = `Year ${result.base.periodYear} | Coverage ${coveragePercent}%`;

  return {
    title: display.label,
    value: formatted,
    subtitle
  };
}

function formatAggregateValue(
  aggregateId: string,
  payload: unknown,
  unit?: string
): string | null {
  if (aggregateId === "rent.v1" && payload && typeof payload === "object") {
    const rentPayload = payload as { rentMedianPerM2?: number };
    if (typeof rentPayload.rentMedianPerM2 !== "number") return null;
    const baseValue = formatNumber(rentPayload.rentMedianPerM2);
    return unit ? `${baseValue} ${unit}` : baseValue;
  }

  return null;
}

function formatNumber(value: number): string {
  return value.toFixed(1);
}
