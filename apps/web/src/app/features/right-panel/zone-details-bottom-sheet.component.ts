import { Component, EventEmitter, Input, Output } from "@angular/core";
import type { DetailsState } from "../city-details/city-details.service";
import { ZoneAggregateCardComponent } from "../zone-aggregates/zone-aggregate-card.component";
import type { ZoneAggregateState } from "../zone-aggregates/zone-aggregates.facade";

export type ZoneDetailsSummary = {
  name: string;
  department: string | null;
  region: string | null;
  population: number | null;
};

@Component({
  selector: "app-zone-details-bottom-sheet",
  standalone: true,
  imports: [ZoneAggregateCardComponent],
  templateUrl: "./zone-details-bottom-sheet.component.html",
  styleUrls: ["./zone-details-bottom-sheet.component.css"]
})
export class ZoneDetailsBottomSheetComponent {
  @Input() summary: ZoneDetailsSummary | null = null;
  @Input() detailsState: DetailsState | null = null;
  @Input() travelLabel: string | null = null;
  @Input() aggregateState: ZoneAggregateState | null = null;
  @Input() expanded = false;

  @Output() toggleExpanded = new EventEmitter<void>();
}
