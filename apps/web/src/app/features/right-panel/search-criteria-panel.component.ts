import { Component, EventEmitter, Input, Output } from "@angular/core";
import type { GeocodeCandidate, TravelMode } from "@csv/core";
import type { SessionState } from "../search/search-session.facade";
import { SearchAreaPanelComponent } from "../search-area/search-area-panel.component";
import { TravelOptionsPanelComponent } from "../travel/travel-options-panel.component";

@Component({
  selector: "app-search-criteria-panel",
  standalone: true,
  imports: [SearchAreaPanelComponent, TravelOptionsPanelComponent],
  templateUrl: "./search-criteria-panel.component.html",
  styleUrls: ["./search-criteria-panel.component.css"]
})
export class SearchCriteriaPanelComponent {
  @Input() session!: SessionState;
  @Input() querySuggestions: GeocodeCandidate[] = [];
  @Input() isQuerySuggesting = false;
  @Input() destinationSuggestions: GeocodeCandidate[] = [];
  @Input() isDestinationSuggesting = false;
  @Input() dayOptions: Array<{ value: string; label: string }> = [];
  @Input() timeOptions: string[] = [];
  @Input() travelStatus: "idle" | "loading" | "loaded" | "error" = "idle";
  @Input() travelMessage?: string;

  @Output() queryUpdated = new EventEmitter<string>();
  @Output() queryKey = new EventEmitter<KeyboardEvent>();
  @Output() queryCandidateSelected = new EventEmitter<GeocodeCandidate>();
  @Output() runSearch = new EventEmitter<void>();
  @Output() travelEnabledChange = new EventEmitter<boolean>();
  @Output() destinationInputChange = new EventEmitter<string>();
  @Output() destinationKey = new EventEmitter<KeyboardEvent>();
  @Output() destinationCandidateSelected = new EventEmitter<GeocodeCandidate>();
  @Output() travelModeChange = new EventEmitter<TravelMode>();
  @Output() travelDayChange = new EventEmitter<string>();
  @Output() travelTimeChange = new EventEmitter<string>();
  @Output() applyTravel = new EventEmitter<void>();

  onRunSearch(): void {
    this.runSearch.emit();
  }
}
