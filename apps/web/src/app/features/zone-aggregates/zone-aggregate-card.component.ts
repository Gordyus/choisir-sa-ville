import { Component, Input } from "@angular/core";
import type { ZoneAggregateResult } from "@csv/core";
import { formatAggregateCard, type AggregateCardContent } from "./aggregate-formatters";

@Component({
  selector: "app-zone-aggregate-card",
  standalone: true,
  templateUrl: "./zone-aggregate-card.component.html",
  styleUrls: ["./zone-aggregate-card.component.css"]
})
export class ZoneAggregateCardComponent {
  @Input() result: ZoneAggregateResult<unknown> | null = null;

  get content(): AggregateCardContent | null {
    if (!this.result) return null;
    return formatAggregateCard(this.result);
  }
}
