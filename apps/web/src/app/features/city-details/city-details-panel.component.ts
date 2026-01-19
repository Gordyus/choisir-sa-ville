import { Component, Input } from "@angular/core";
import { NgFor, NgIf, NgSwitch, NgSwitchCase } from "@angular/common";
import type { DetailsState } from "./city-details.service";
import type { TravelRouteState } from "../travel/travel-route.service";

@Component({
  selector: "app-city-details-panel",
  standalone: true,
  imports: [NgFor, NgIf, NgSwitch, NgSwitchCase],
  templateUrl: "./city-details-panel.component.html",
  styles: [":host { display: block; }"]
})
export class CityDetailsPanelComponent {
  @Input() state: DetailsState | null = null;
  @Input() routeState: TravelRouteState | null = null;

  formatDuration(seconds?: number): string {
    if (seconds === undefined) return "-";
    const minutes = Math.round(seconds / 60);
    return `${minutes} min`;
  }

  formatDistance(meters?: number): string {
    if (meters === undefined) return "-";
    const km = meters / 1000;
    return `${km.toFixed(1)} km`;
  }
}
