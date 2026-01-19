import { Component, EventEmitter, Input, Output } from "@angular/core";
import { NgFor, NgIf } from "@angular/common";
import { FormsModule } from "@angular/forms";
import type { GeocodeCandidate, TravelMode } from "@csv/core";

@Component({
  selector: "app-travel-options-panel",
  standalone: true,
  imports: [NgIf, NgFor, FormsModule],
  templateUrl: "./travel-options-panel.component.html",
  styles: [":host { display: block; }"]
})
export class TravelOptionsPanelComponent {
  @Input() travelEnabled = false;
  @Input() destinationInput = "";
  @Input() destinationSuggestions: GeocodeCandidate[] = [];
  @Input() suggestionIndex = -1;
  @Input() travelMode: TravelMode = "car";
  @Input() travelDay = "mon";
  @Input() travelTime = "08:30";
  @Input() dayOptions: Array<{ value: string; label: string }> = [];
  @Input() timeOptions: string[] = [];
  @Input() travelError = "";
  @Input() isSuggesting = false;
  @Input() isGeocoding = false;
  @Input() resolvedDestinationLabel = "";
  @Input() travelStatus: "idle" | "loading" | "loaded" | "error" = "idle";
  @Input() travelMessage?: string;

  @Output() travelEnabledChange = new EventEmitter<boolean>();
  @Output() destinationInputChange = new EventEmitter<string>();
  @Output() destinationKey = new EventEmitter<KeyboardEvent>();
  @Output() candidateSelected = new EventEmitter<GeocodeCandidate>();
  @Output() modeChange = new EventEmitter<TravelMode>();
  @Output() dayChange = new EventEmitter<string>();
  @Output() timeChange = new EventEmitter<string>();
  @Output() applyTravel = new EventEmitter<void>();

  onDestinationInput(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    this.destinationInputChange.emit(target?.value ?? "");
  }
}
