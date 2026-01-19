import { Component, EventEmitter, Input, Output } from "@angular/core";
import { NgFor } from "@angular/common";
import type { TravelMatrixResult } from "@csv/core";

type ResultRow = {
  zoneId: string;
  zoneName: string;
  type: string;
  centroid: { lat: number; lng: number };
  attributes: Record<string, number | string | boolean | null>;
  travel: TravelMatrixResult | null;
};

@Component({
  selector: "app-results-table",
  standalone: true,
  imports: [NgFor],
  templateUrl: "./results-table.component.html",
  styles: [":host { display: block; }"]
})
export class ResultsTableComponent {
  @Input() rows: ResultRow[] = [];
  @Input() travelStatus: "idle" | "loading" | "loaded" | "error" = "idle";
  @Output() rowSelected = new EventEmitter<string>();

  formatTravel(result: TravelMatrixResult | null, state: string): string {
    if (!result) {
      return state === "loading" ? "..." : "-";
    }
    if (result.status === "NO_ROUTE") return "--";
    if (result.status !== "OK" || result.duration_s === undefined) return "!";
    const minutes = Math.round(result.duration_s / 60);
    return `${minutes} min`;
  }

  travelTitle(result: TravelMatrixResult | null): string {
    if (!result) return "";
    if (result.status === "ERROR") return "Travel lookup failed.";
    if (result.status === "NO_ROUTE") return "No route available.";
    return "";
  }
}
