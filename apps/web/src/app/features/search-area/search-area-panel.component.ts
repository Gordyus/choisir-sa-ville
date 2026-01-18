import { Component, EventEmitter, Input, Output } from "@angular/core";
import { NgFor, NgIf } from "@angular/common";
import type { GeocodeCandidate } from "@csv/core";

@Component({
  selector: "app-search-area-panel",
  standalone: true,
  imports: [NgIf, NgFor],
  templateUrl: "./search-area-panel.component.html",
  styles: [":host { display: block; }"]
})
export class SearchAreaPanelComponent {
  @Input() query = "";
  @Input() suggestions: GeocodeCandidate[] = [];
  @Input() suggestionIndex = -1;
  @Input() isSuggesting = false;
  @Input() resolvedAreaLabel = "";

  @Output() queryUpdated = new EventEmitter<string>();
  @Output() queryKey = new EventEmitter<KeyboardEvent>();
  @Output() candidateSelected = new EventEmitter<GeocodeCandidate>();
  @Output() submitSearch = new EventEmitter<void>();

  onInput(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    this.queryUpdated.emit(target?.value ?? "");
  }

  onSubmit(): void {
    this.submitSearch.emit();
  }

  badgeFor(candidate: GeocodeCandidate): string {
    switch (candidate.source) {
      case "postalCode":
        return "Code postal";
      case "department":
        return "Departement";
      case "region":
        return "Region";
      case "commune":
        return "Commune";
      default:
        return "Zone";
    }
  }
}
