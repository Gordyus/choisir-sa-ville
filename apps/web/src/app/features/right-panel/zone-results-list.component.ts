import { Component, EventEmitter, Input, Output } from "@angular/core";
import type { TravelMatrixResult } from "@csv/core";

export type ZoneResultItem = {
  zoneId: string;
  zoneName: string;
  type: string;
  centroid: { lat: number; lng: number };
  attributes: Record<string, number | string | boolean | null>;
  travel: TravelMatrixResult | null;
};

@Component({
  selector: "app-zone-results-list",
  standalone: true,
  templateUrl: "./zone-results-list.component.html",
  styleUrls: ["./zone-results-list.component.css"]
})
export class ZoneResultsListComponent {
  @Input() rows: ZoneResultItem[] = [];
  @Input() travelStatus: "idle" | "loading" | "loaded" | "error" = "idle";
  @Input() selectedZoneId: string | null = null;
  @Output() selected = new EventEmitter<string>();
  @Output() hovered = new EventEmitter<string | null>();

  sortKey: "name" | "travel" = "name";
  sortDir: "asc" | "desc" = "asc";

  formatTravel(result: TravelMatrixResult | null): string {
    if (!result) {
      return this.travelStatus === "loading" ? "\u2022" : "\u2014";
    }
    if (result.status === "NO_ROUTE") return "\u2014";
    if (result.status !== "OK" || result.duration_s === undefined) return "\u2014";
    const minutes = Math.round(result.duration_s / 60);
    return `${minutes} min`;
  }

  isTravelPending(result: TravelMatrixResult | null): boolean {
    return !result && this.travelStatus === "loading";
  }

  isTravelPlaceholder(result: TravelMatrixResult | null): boolean {
    if (!result) return true;
    if (result.status === "NO_ROUTE") return true;
    if (result.status !== "OK" || result.duration_s === undefined) return true;
    return false;
  }

  trackRow(_: number, row: ZoneResultItem): string {
    return row.zoneId;
  }

  toggleSort(key: "name" | "travel"): void {
    if (this.sortKey === key) {
      this.sortDir = this.sortDir === "asc" ? "desc" : "asc";
      return;
    }
    this.sortKey = key;
    this.sortDir = "asc";
  }

  sortIndicator(key: "name" | "travel"): string {
    if (this.sortKey !== key) return "";
    return this.sortDir === "asc" ? "^" : "v";
  }

  sortedRows(): ZoneResultItem[] {
    const rows = [...this.rows];
    const dir = this.sortDir === "asc" ? 1 : -1;
    if (this.sortKey === "travel") {
      return rows.sort((left, right) => {
        const leftValue = travelSortValue(left.travel);
        const rightValue = travelSortValue(right.travel);
        if (leftValue !== rightValue) {
          return dir * (leftValue - rightValue);
        }
        return left.zoneName.localeCompare(right.zoneName);
      });
    }
    return rows.sort((left, right) => dir * left.zoneName.localeCompare(right.zoneName));
  }

  onRowKey(event: Event, zoneId: string): void {
    event.preventDefault();
    this.selected.emit(zoneId);
  }
}

function travelSortValue(result: TravelMatrixResult | null): number {
  if (!result || result.status !== "OK" || result.duration_s === undefined) {
    return Number.POSITIVE_INFINITY;
  }
  return result.duration_s;
}
