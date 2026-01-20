import { Component, EventEmitter, Input, Output } from "@angular/core";
import type { DetailsState } from "../city-details/city-details.service";

export type ZoneDetailsSummary = {
  name: string;
  department: string | null;
  region: string | null;
  population: number | null;
};

@Component({
  selector: "app-zone-details-bottom-sheet",
  standalone: true,
  templateUrl: "./zone-details-bottom-sheet.component.html",
  styleUrls: ["./zone-details-bottom-sheet.component.css"]
})
export class ZoneDetailsBottomSheetComponent {
  @Input() summary: ZoneDetailsSummary | null = null;
  @Input() detailsState: DetailsState | null = null;
  @Input() travelLabel: string | null = null;
  @Input() expanded = false;

  @Output() toggleExpanded = new EventEmitter<void>();
}
