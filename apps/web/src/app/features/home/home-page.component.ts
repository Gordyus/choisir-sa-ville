import { Component } from "@angular/core";
import { AsyncPipe, NgIf, NgSwitch, NgSwitchCase } from "@angular/common";
import type { GeocodeCandidate, TravelMode } from "@csv/core";
import { MapComponent } from "../map/ui/map.component";
import { SearchAreaPanelComponent } from "../search-area/search-area-panel.component";
import { TravelOptionsPanelComponent } from "../travel/travel-options-panel.component";
import { ResultsTableComponent } from "../../shared/ui/results-table.component";
import { CityDetailsPanelComponent } from "../city-details/city-details-panel.component";
import { SearchSessionFacade } from "../search/search-session.facade";

@Component({
  selector: "app-home-page",
  standalone: true,
  imports: [
    AsyncPipe,
    NgIf,
    NgSwitch,
    NgSwitchCase,
    MapComponent,
    SearchAreaPanelComponent,
    TravelOptionsPanelComponent,
    ResultsTableComponent,
    CityDetailsPanelComponent
  ],
  templateUrl: "./home-page.component.html",
  styleUrls: ["./home-page.component.css"]
})
export class HomePageComponent {
  readonly sessionState$ = this.session.state$;
  readonly detailsState$ = this.session.detailsState$;
  readonly routeState$ = this.session.routeState$;
  readonly viewState$ = this.session.viewState$;
  readonly querySuggestions$ = this.session.querySuggestions$;
  readonly isQuerySuggesting$ = this.session.isQuerySuggesting$;
  readonly destinationSuggestions$ = this.session.destinationSuggestions$;
  readonly isDestinationSuggesting$ = this.session.isDestinationSuggesting$;
  readonly markers$ = this.session.markers$;
  readonly routeLine$ = this.session.routeLine$;
  readonly dayOptions = this.session.dayOptions;
  readonly timeOptions = this.session.timeOptions;

  constructor(private readonly session: SearchSessionFacade) {}

  runSearch(): void {
    this.session.runSearch();
  }

  updateQuery(value: string): void {
    this.session.updateQuery(value);
  }

  onQueryKey(event: KeyboardEvent): void {
    this.session.onQueryKey(event);
  }

  selectQueryCandidate(candidate: GeocodeCandidate): void {
    this.session.selectQueryCandidate(candidate);
  }

  onDestinationKey(event: KeyboardEvent): void {
    this.session.onDestinationKey(event);
  }

  selectCandidate(candidate: GeocodeCandidate): void {
    this.session.selectCandidate(candidate);
  }

  applyTravelOptions(): void {
    this.session.applyTravelOptions();
  }

  onTravelEnabledChange(value: boolean): void {
    this.session.onTravelEnabledChange(value);
  }

  onDestinationInputChange(value: string): void {
    this.session.onDestinationInputChange(value);
  }

  onTravelModeChange(value: TravelMode): void {
    this.session.onTravelModeChange(value);
  }

  onTravelDayChange(value: string): void {
    this.session.onTravelDayChange(value);
  }

  onTravelTimeChange(value: string): void {
    this.session.onTravelTimeChange(value);
  }

  selectZone(zoneId: string): void {
    this.session.selectZone(zoneId);
  }
}
