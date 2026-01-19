import { Injectable, OnDestroy } from "@angular/core";
import { type GeocodeCandidate, type GeocodeRequest, type SearchArea, type TravelMatrixResult, type TravelMode } from "@csv/core";
import { BehaviorSubject, Subscription, combineLatest, map, startWith, take } from "rxjs";
import { CityDetailsService } from "../city-details/city-details.service";
import { MapDataService, type Viewport } from "../map/state/map-data.service";
import { SearchAreaSuggestFacade } from "../search-area/search-area-suggest.facade";
import { SelectionService } from "../selection/selection.service";
import { DestinationSuggestFacade } from "../travel/destination-suggest.facade";
import { TravelMatrixService } from "../travel/travel-matrix.service";
import { TravelRouteService } from "../travel/travel-route.service";
import { GeocodeService } from "../../core/api/geocode.service";
import { SearchFacade } from "./search.facade";

export type SessionState = {
  query: string;
  resolvedAreaLabel: string;
  querySuggestionIndex: number;
  travelEnabled: boolean;
  destinationInput: string;
  resolvedDestinationLabel: string;
  suggestionIndex: number;
  travelMode: TravelMode;
  travelDay: string;
  travelTime: string;
  travelError: string;
  isGeocoding: boolean;
};

type ViewRow = {
  zoneId: string;
  zoneName: string;
  type: string;
  centroid: { lat: number; lng: number };
  attributes: Record<string, number | string | boolean | null>;
  travel: TravelMatrixResult | null;
};

const DEFAULT_SESSION_STATE: SessionState = {
  query: "",
  resolvedAreaLabel: "",
  querySuggestionIndex: -1,
  travelEnabled: false,
  destinationInput: "",
  resolvedDestinationLabel: "",
  suggestionIndex: -1,
  travelMode: "car",
  travelDay: "mon",
  travelTime: "08:30",
  travelError: "",
  isGeocoding: false
};

@Injectable({ providedIn: "root" })
export class SearchSessionFacade implements OnDestroy {
  private readonly stateSubject = new BehaviorSubject<SessionState>(DEFAULT_SESSION_STATE);
  private geocodeSubscription?: Subscription;
  private selectedCandidate: GeocodeCandidate | null = null;

  readonly state$ = this.stateSubject.asObservable();
  readonly searchState$ = this.searchService.searchState$;
  readonly travelState$ = this.travelMatrix.matrixState$;
  readonly travelOptions$ = this.travelMatrix.options$;
  readonly routeState$ = this.travelRoute.routeState$;
  readonly detailsState$ = this.cityDetails.detailsState$;
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

  constructor(
    private readonly cityDetails: CityDetailsService,
    private readonly selection: SelectionService,
    private readonly searchService: SearchFacade,
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
    this.patchState({ query: value });
    this.onQueryInput();
  }

  onQueryKey(event: KeyboardEvent): void {
    const suggestions = this.searchAreaSuggest.getSnapshot();
    if (suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const nextIndex =
        (this.stateSubject.value.querySuggestionIndex + 1) % suggestions.length;
      this.patchState({ querySuggestionIndex: nextIndex });
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      const nextIndex =
        (this.stateSubject.value.querySuggestionIndex - 1 + suggestions.length) %
        suggestions.length;
      this.patchState({ querySuggestionIndex: nextIndex });
      return;
    }
    if (event.key === "Enter" && this.stateSubject.value.querySuggestionIndex >= 0) {
      event.preventDefault();
      const candidate = suggestions[this.stateSubject.value.querySuggestionIndex];
      if (candidate) {
        this.selectQueryCandidate(candidate);
      }
      return;
    }
    if (event.key === "Escape") {
      this.searchAreaSuggest.clear();
      this.patchState({ querySuggestionIndex: -1 });
    }
  }

  selectQueryCandidate(candidate: GeocodeCandidate): void {
    this.patchState({
      query: candidate.label,
      resolvedAreaLabel: candidate.label,
      querySuggestionIndex: -1
    });
    this.searchAreaSuggest.clear();
    this.mapData.requestPan({ lat: candidate.lat, lng: candidate.lng, zoom: 10 });
  }

  onDestinationInputChange(value: string): void {
    this.patchState({ destinationInput: value });
    this.onDestinationInput();
  }

  onDestinationKey(event: KeyboardEvent): void {
    const suggestions = this.destinationSuggest.getSnapshot();
    if (suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const nextIndex =
        (this.stateSubject.value.suggestionIndex + 1) % suggestions.length;
      this.patchState({ suggestionIndex: nextIndex });
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      const nextIndex =
        (this.stateSubject.value.suggestionIndex - 1 + suggestions.length) %
        suggestions.length;
      this.patchState({ suggestionIndex: nextIndex });
      return;
    }
    if (event.key === "Enter" && this.stateSubject.value.suggestionIndex >= 0) {
      event.preventDefault();
      const candidate = suggestions[this.stateSubject.value.suggestionIndex];
      if (candidate) {
        this.selectCandidate(candidate);
      }
      return;
    }
    if (event.key === "Escape") {
      this.destinationSuggest.clear();
      this.patchState({ suggestionIndex: -1 });
    }
  }

  selectCandidate(candidate: GeocodeCandidate): void {
    this.selectedCandidate = candidate;
    this.patchState({
      destinationInput: candidate.label,
      resolvedDestinationLabel: candidate.label,
      suggestionIndex: -1,
      travelError: ""
    });
    this.destinationSuggest.clear();
  }

  applyTravelOptions(): void {
    const state = this.stateSubject.value;
    this.patchState({ travelError: "", isGeocoding: false });

    if (!state.travelEnabled) {
      this.travelMatrix.updateOptions({ enabled: false });
      this.destinationSuggest.clear();
      this.selectedCandidate = null;
      this.patchState({
        resolvedDestinationLabel: "",
        suggestionIndex: -1
      });
      return;
    }

    const rawQuery = state.destinationInput.trim();
    if (!rawQuery) {
      this.patchState({ travelError: "Destination required." });
      this.travelMatrix.updateOptions({ enabled: true, destination: null });
      return;
    }

    if (!state.travelDay || !state.travelTime) {
      this.patchState({ travelError: "Select a valid day and time." });
      return;
    }
    const bucket = `${state.travelDay}_${state.travelTime}`;

    if (this.selectedCandidate) {
      this.patchState({ resolvedDestinationLabel: this.selectedCandidate.label });
      this.travelMatrix.updateOptions({
        enabled: true,
        destination: {
          lat: this.selectedCandidate.lat,
          lng: this.selectedCandidate.lng
        },
        mode: state.travelMode,
        timeBucket: bucket
      });
      return;
    }

    const destination = parseLatLng(rawQuery);
    if (destination) {
      this.patchState({ resolvedDestinationLabel: rawQuery });
      this.selectedCandidate = null;
      this.travelMatrix.updateOptions({
        enabled: true,
        destination,
        mode: state.travelMode,
        timeBucket: bucket
      });
      return;
    }

    this.patchState({ isGeocoding: true });
    this.geocodeSubscription?.unsubscribe();
    const request = buildGeocodeRequest(rawQuery, this.mapData.getViewport());
    this.geocodeSubscription = this.geocodeService
      .geocode(request)
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          this.patchState({ isGeocoding: false });
          const candidate = response.candidates[0];
          if (!candidate) {
            this.patchState({
              travelError: "Address not found near your search area."
            });
            return;
          }
          this.selectedCandidate = candidate;
          this.patchState({ resolvedDestinationLabel: candidate.label });
          this.travelMatrix.updateOptions({
            enabled: true,
            destination: { lat: candidate.lat, lng: candidate.lng },
            mode: state.travelMode,
            timeBucket: bucket
          });
        },
        error: () => {
          this.patchState({
            isGeocoding: false,
            travelError: "Address lookup failed."
          });
        }
      });
  }

  onTravelEnabledChange(value: boolean): void {
    this.patchState({ travelEnabled: value });
    this.applyTravelOptions();
  }

  onTravelModeChange(value: TravelMode): void {
    this.patchState({ travelMode: value });
    this.applyTravelOptions();
  }

  onTravelDayChange(value: string): void {
    this.patchState({ travelDay: value });
    this.clearTravelError();
  }

  onTravelTimeChange(value: string): void {
    this.patchState({ travelTime: value });
    this.clearTravelError();
  }

  selectZone(zoneId: string): void {
    this.selection.selectCity(zoneId);
  }

  ngOnDestroy(): void {
    this.geocodeSubscription?.unsubscribe();
  }

  private onQueryInput(): void {
    this.patchState({
      querySuggestionIndex: -1,
      resolvedAreaLabel: ""
    });
    this.searchAreaSuggest.setQuery(this.stateSubject.value.query);
  }

  private onDestinationInput(): void {
    this.clearTravelError();
    this.selectedCandidate = null;
    this.patchState({
      suggestionIndex: -1,
      resolvedDestinationLabel: ""
    });
    this.destinationSuggest.setQuery({
      query: this.stateSubject.value.destinationInput,
      enabled: this.stateSubject.value.travelEnabled,
      selectedLabel: null,
      viewport: this.mapData.getViewport()
    });
  }

  private clearTravelError(): void {
    if (this.stateSubject.value.travelError) {
      this.patchState({ travelError: "" });
    }
  }

  private patchState(partial: Partial<SessionState>): void {
    this.stateSubject.next({
      ...this.stateSubject.value,
      ...partial
    });
  }
}

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
