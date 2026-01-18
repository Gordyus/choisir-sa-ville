import { Component, OnDestroy } from "@angular/core";
import { AsyncPipe, NgIf, NgSwitch, NgSwitchCase } from "@angular/common";
import { combineLatest, map, startWith, take } from "rxjs";
import { MapComponent } from "./map/map.component";
import { MapDataService, type Viewport } from "./features/map/map-data.service";
import { CityDetailsService } from "./features/city-details/city-details.service";
import { SelectionService } from "./features/selection/selection.service";
import { SearchService } from "./features/search/search.service";
import { TravelMatrixService } from "./features/travel/travel-matrix.service";
import { TravelRouteService } from "./features/travel/travel-route.service";
import { SearchAreaSuggestFacade } from "./features/search-area/search-area-suggest.facade";
import { DestinationSuggestFacade } from "./features/travel/destination-suggest.facade";
import { GeocodeService } from "./core/api/geocode.service";
import { SearchAreaPanelComponent } from "./features/search-area/search-area-panel.component";
import { TravelOptionsPanelComponent } from "./features/travel/travel-options-panel.component";
import { ResultsTableComponent } from "./shared/ui/results-table.component";
import { CityDetailsPanelComponent } from "./features/city-details/city-details-panel.component";
import type { TravelMatrixResult, TravelMode } from "@csv/core";
import {
  type GeocodeRequest,
  type GeocodeCandidate,
  type SearchArea
} from "@csv/core";
import type { Subscription } from "rxjs";

@Component({
  selector: "app-root",
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
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.css"]
})
export class AppComponent implements OnDestroy {
  readonly detailsState$ = this.cityDetails.detailsState$;
  readonly searchState$ = this.searchService.searchState$;
  readonly travelState$ = this.travelMatrix.matrixState$;
  readonly travelOptions$ = this.travelMatrix.options$;
  readonly routeState$ = this.travelRoute.routeState$;
  readonly querySuggestions$ = this.searchAreaSuggest.suggestions$;
  readonly isQuerySuggesting$ = this.searchAreaSuggest.isSuggesting$;
  readonly destinationSuggestions$ = this.destinationSuggest.suggestions$;
  readonly isDestinationSuggesting$ = this.destinationSuggest.isSuggesting$;
  readonly markers$ = this.searchState$.pipe(
    map((state) =>
      state.items.map((item) => ({
        id: item.zoneId,
        label: item.zoneName,
        lat: item.centroid.lat,
        lng: item.centroid.lng
      }))
    ),
    startWith([])
  );
  readonly routeLine$ = this.routeState$.pipe(
    map((state) => state.line ?? []),
    startWith([])
  );
  readonly viewState$ = combineLatest([
    this.searchState$,
    this.travelState$,
    this.travelOptions$
  ]).pipe(
    map(([searchState, travelState, travelOptions]) => {
      const rows = searchState.items.map((item) => ({
        ...item,
        travel: travelState.results[item.zoneId] ?? null
      }));
      const sortedRows =
        travelOptions.enabled && travelState.status === "loaded"
          ? sortByTravel(rows)
          : rows;
      return {
        ...searchState,
        rows: sortedRows,
        travelStatus: travelState.status,
        travelMessage: travelState.message,
        travelEnabled: travelOptions.enabled
      };
    })
  );

  query = "";
  resolvedAreaLabel = "";
  querySuggestionIndex = -1;
  travelEnabled = false;
  destinationInput = "";
  resolvedDestinationLabel = "";
  suggestionIndex = -1;
  travelMode: TravelMode = "car";
  travelDay = "mon";
  travelTime = "08:30";
  travelError = "";
  isGeocoding = false;
  readonly dayOptions = [
    { value: "mon", label: "Monday" },
    { value: "tue", label: "Tuesday" },
    { value: "wed", label: "Wednesday" },
    { value: "thu", label: "Thursday" },
    { value: "fri", label: "Friday" },
    { value: "sat", label: "Saturday" },
    { value: "sun", label: "Sunday" }
  ];
  readonly timeOptions = buildTimeOptions();
  private geocodeSubscription?: Subscription;

  constructor(
    private readonly cityDetails: CityDetailsService,
    private readonly selection: SelectionService,
    private readonly searchService: SearchService,
    private readonly travelMatrix: TravelMatrixService,
    private readonly travelRoute: TravelRouteService,
    private readonly searchAreaSuggest: SearchAreaSuggestFacade,
    private readonly destinationSuggest: DestinationSuggestFacade,
    private readonly geocodeService: GeocodeService,
    private readonly mapData: MapDataService
  ) {}

  runSearch(): void {
    this.searchService.search({ limit: 200, offset: 0 });
  }

  updateQuery(value: string): void {
    this.query = value;
    this.onQueryInput();
  }

  onQueryInput(): void {
    this.querySuggestionIndex = -1;
    this.resolvedAreaLabel = "";
    this.searchAreaSuggest.setQuery(this.query);
  }

  onQueryKey(event: KeyboardEvent): void {
    const suggestions = this.searchAreaSuggest.getSnapshot();
    if (suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      this.querySuggestionIndex =
        (this.querySuggestionIndex + 1) % suggestions.length;
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      this.querySuggestionIndex =
        (this.querySuggestionIndex - 1 + suggestions.length) % suggestions.length;
      return;
    }
    if (event.key === "Enter" && this.querySuggestionIndex >= 0) {
      event.preventDefault();
      const candidate = suggestions[this.querySuggestionIndex];
      if (candidate) {
        this.selectQueryCandidate(candidate);
      }
      return;
    }
    if (event.key === "Escape") {
      this.searchAreaSuggest.clear();
      this.querySuggestionIndex = -1;
    }
  }

  selectQueryCandidate(candidate: GeocodeCandidate): void {
    this.query = candidate.label;
    this.resolvedAreaLabel = candidate.label;
    this.searchAreaSuggest.clear();
    this.querySuggestionIndex = -1;
    this.mapData.requestPan({ lat: candidate.lat, lng: candidate.lng, zoom: 10 });
  }

  onDestinationInput(): void {
    this.clearTravelError();
    this.suggestionIndex = -1;
    this.resolvedDestinationLabel = "";
    this.selectedCandidate = null;
    this.destinationSuggest.setQuery({
      query: this.destinationInput,
      enabled: this.travelEnabled,
      selectedLabel: null,
      viewport: this.mapData.getViewport()
    });
  }

  onDestinationKey(event: KeyboardEvent): void {
    const suggestions = this.destinationSuggest.getSnapshot();
    if (suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      this.suggestionIndex = (this.suggestionIndex + 1) % suggestions.length;
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      this.suggestionIndex =
        (this.suggestionIndex - 1 + suggestions.length) % suggestions.length;
      return;
    }
    if (event.key === "Enter" && this.suggestionIndex >= 0) {
      event.preventDefault();
      const candidate = suggestions[this.suggestionIndex];
      if (candidate) {
        this.selectCandidate(candidate);
      }
      return;
    }
    if (event.key === "Escape") {
      this.destinationSuggest.clear();
      this.suggestionIndex = -1;
    }
  }

  selectCandidate(candidate: GeocodeCandidate): void {
    this.destinationInput = candidate.label;
    this.resolvedDestinationLabel = candidate.label;
    this.destinationSuggest.clear();
    this.suggestionIndex = -1;
    this.travelError = "";
    this.selectedCandidate = candidate;
  }

  applyTravelOptions(): void {
    this.travelError = "";
    this.isGeocoding = false;
    if (!this.travelEnabled) {
      this.travelMatrix.updateOptions({ enabled: false });
      this.resolvedDestinationLabel = "";
      this.destinationSuggest.clear();
      this.suggestionIndex = -1;
      this.selectedCandidate = null;
      return;
    }

    const rawQuery = this.destinationInput.trim();
    if (!rawQuery) {
      this.travelError = "Destination required.";
      this.travelMatrix.updateOptions({ enabled: true, destination: null });
      return;
    }

    if (!this.travelDay || !this.travelTime) {
      this.travelError = "Select a valid day and time.";
      return;
    }
    const bucket = `${this.travelDay}_${this.travelTime}`;

    if (this.selectedCandidate) {
      this.resolvedDestinationLabel = this.selectedCandidate.label;
      this.travelMatrix.updateOptions({
        enabled: true,
        destination: {
          lat: this.selectedCandidate.lat,
          lng: this.selectedCandidate.lng
        },
        mode: this.travelMode,
        timeBucket: bucket
      });
      return;
    }

    const destination = parseLatLng(rawQuery);
    if (destination) {
      this.resolvedDestinationLabel = rawQuery;
      this.selectedCandidate = null;
      this.travelMatrix.updateOptions({
        enabled: true,
        destination,
        mode: this.travelMode,
        timeBucket: bucket
      });
      return;
    }

    this.isGeocoding = true;
    this.geocodeSubscription?.unsubscribe();
    const request = buildGeocodeRequest(rawQuery, this.mapData.getViewport());
    this.geocodeSubscription = this.geocodeService
      .geocode(request)
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          this.isGeocoding = false;
          const candidate = response.candidates[0];
          if (!candidate) {
            this.travelError = "Address not found near your search area.";
            return;
          }
          this.selectedCandidate = candidate;
          this.resolvedDestinationLabel = candidate.label;
          this.travelMatrix.updateOptions({
            enabled: true,
            destination: { lat: candidate.lat, lng: candidate.lng },
            mode: this.travelMode,
            timeBucket: bucket
          });
        },
        error: () => {
          this.isGeocoding = false;
          this.travelError = "Address lookup failed.";
        }
    });
  }

  onTravelEnabledChange(value: boolean): void {
    this.travelEnabled = value;
    this.applyTravelOptions();
  }

  onDestinationInputChange(value: string): void {
    this.destinationInput = value;
    this.onDestinationInput();
  }

  onTravelModeChange(value: TravelMode): void {
    this.travelMode = value;
    this.applyTravelOptions();
  }

  onTravelDayChange(value: string): void {
    this.travelDay = value;
    this.clearTravelError();
  }

  onTravelTimeChange(value: string): void {
    this.travelTime = value;
    this.clearTravelError();
  }

  ngOnDestroy(): void {
    this.geocodeSubscription?.unsubscribe();
  }

  private selectedCandidate: GeocodeCandidate | null = null;

  clearTravelError(): void {
    if (this.travelError) {
      this.travelError = "";
    }
  }

  selectZone(zoneId: string): void {
    this.selection.selectCity(zoneId);
  }

}

type ViewRow = {
  zoneId: string;
  zoneName: string;
  type: string;
  centroid: { lat: number; lng: number };
  attributes: Record<string, number | string | boolean | null>;
  travel: TravelMatrixResult | null;
};

function parseLatLng(value: string): { lat: number; lng: number } | null {
  const match = /(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/.exec(value.trim());
  if (!match) return null;
  const lat = Number.parseFloat(match[1]);
  const lng = Number.parseFloat(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function sortByTravel(rows: ViewRow[]): ViewRow[] {
  return [...rows].sort((left, right) => {
    const leftValue = travelSortValue(left.travel);
    const rightValue = travelSortValue(right.travel);
    if (leftValue !== rightValue) {
      return leftValue - rightValue;
    }
    return left.zoneName.localeCompare(right.zoneName);
  });
}

function travelSortValue(result: TravelMatrixResult | null): number {
  if (!result || result.status !== "OK" || result.duration_s === undefined) {
    return Number.POSITIVE_INFINITY;
  }
  return result.duration_s;
}

function buildTimeOptions(): string[] {
  const options: string[] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    for (const minute of [0, 15, 30, 45]) {
      options.push(`${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`);
    }
  }
  return options;
}

function buildGeocodeRequest(query: string, viewport: Viewport | null): GeocodeRequest {
  const area = buildSearchArea(viewport);
  const bbox = area?.bbox ?? undefined;
  const near = bbox
    ? {
        lat: (bbox.minLat + bbox.maxLat) / 2,
        lng: (bbox.minLon + bbox.maxLon) / 2
      }
    : undefined;
  return {
    query,
    near,
    bbox,
    limit: 5
  };
}

function buildSearchArea(viewport: Viewport | null): SearchArea {
  if (!viewport) return null;
  return {
    bbox: {
      minLon: viewport.west,
      minLat: viewport.south,
      maxLon: viewport.east,
      maxLat: viewport.north
    }
  };
}



