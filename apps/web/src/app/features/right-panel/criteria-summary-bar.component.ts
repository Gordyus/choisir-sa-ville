import { Component, EventEmitter, Input, Output } from "@angular/core";

export type CriteriaChip = {
  label: string;
  kind: "area" | "travel" | "mode" | "time";
};

@Component({
  selector: "app-criteria-summary-bar",
  standalone: true,
  templateUrl: "./criteria-summary-bar.component.html",
  styleUrls: ["./criteria-summary-bar.component.css"]
})
export class CriteriaSummaryBarComponent {
  @Input() chips: CriteriaChip[] = [];
  @Output() editRequested = new EventEmitter<void>();
}
