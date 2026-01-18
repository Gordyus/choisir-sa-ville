import { Component, OnDestroy, OnInit } from "@angular/core";
import { AsyncPipe, NgFor, NgIf, NgSwitch, NgSwitchCase } from "@angular/common";
import { FormsModule } from "@angular/forms";
import {
  Subject,
  combineLatest,
  map,
  startWith,
  take,
  debounceTime,
  distinctUntilChanged,
  switchMap,
  of,
  catchError
} from "rxjs";
import { MapComponent } from "./map/map.component";
import { MapDataService, type Viewport } from "./services/map-data.service";
import { CityDetailsService } from "./services/city-details.service";
import { SelectionService } from "./services/selection.service";
import { SearchService } from "./services/search.service";
import { TravelMatrixService } from "./services/travel-matrix.service";
import { TravelRouteService } from "./services/travel-route.service";
import { GeocodeService } from "./services/geocode.service";
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
    NgFor,
    NgSwitch,
    NgSwitchCase,
    FormsModule,
    MapComponent
  ],
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.css"]
})
export class AppComponent implements OnInit, OnDestroy {
  readonly detailsState$ = this.cityDetails.detailsState$;
  readonly searchState$ = this.searchService.searchState$;
  readonly travelState$ = this.travelMatrix.matrixState$;
  readonly travelOptions$ = this.travelMatrix.options$;
  readonly routeState$ = this.travelRoute.routeState$;
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
  travelEnabled = false;
  destinationInput = "";
  resolvedDestinationLabel = "";
  destinationSuggestions: GeocodeCandidate[] = [];
  suggestionIndex = -1;
  travelMode: TravelMode = "car";
  travelDay = "mon";
  travelTime = "08:30";
  travelError = "";
  isGeocoding = false;
  isSuggesting = false;
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
  private suggestionSubscription?: Subscription;
  private readonly destinationQuerySubject = new Subject<string>();

  constructor(
    private readonly cityDetails: CityDetailsService,
    private readonly selection: SelectionService,
    private readonly searchService: SearchService,
    private readonly travelMatrix: TravelMatrixService,
    private readonly travelRoute: TravelRouteService,
    private readonly geocodeService: GeocodeService,
    private readonly mapData: MapDataService
  ) {}

  ngOnInit(): void {
    this.suggestionSubscription = this.destinationQuerySubject
      .pipe(
        map((value) => value.trim()),
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((query) => {
          if (!this.travelEnabled || query.length < 3) {
            this.isSuggesting = false;
            return of<GeocodeCandidate[]>([]);
          }
          if (this.selectedCandidateLabelMatches(query)) {
            this.isSuggesting = false;
            return of<GeocodeCandidate[]>([]);
          }
          this.isSuggesting = true;
          const request = buildGeocodeRequest(query, this.mapData.getViewport());
          return this.geocodeService.geocode(request).pipe(
            map((response) => response.candidates),
            catchError(() => of<GeocodeCandidate[]>([]))
          );
        })
      )
      .subscribe((candidates) => {
        this.isSuggesting = false;
        this.destinationSuggestions = candidates;
        this.suggestionIndex = -1;
      });
  }

  runSearch(): void {
    this.searchService.search({ q: this.query, limit: 200, offset: 0 });
  }

  onDestinationInput(): void {
    this.clearTravelError();
    this.destinationSuggestions = [];
    this.suggestionIndex = -1;
    this.resolvedDestinationLabel = "";
    this.selectedCandidate = null;
    this.destinationQuerySubject.next(this.destinationInput);
  }

  onDestinationKey(event: KeyboardEvent): void {
    if (this.destinationSuggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      this.suggestionIndex =
        (this.suggestionIndex + 1) % this.destinationSuggestions.length;
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      this.suggestionIndex =
        (this.suggestionIndex - 1 + this.destinationSuggestions.length) %
        this.destinationSuggestions.length;
      return;
    }
    if (event.key === "Enter" && this.suggestionIndex >= 0) {
      event.preventDefault();
      const candidate = this.destinationSuggestions[this.suggestionIndex];
      if (candidate) {
        this.selectCandidate(candidate);
      }
      return;
    }
    if (event.key === "Escape") {
      this.destinationSuggestions = [];
      this.suggestionIndex = -1;
    }
  }

  selectCandidate(candidate: GeocodeCandidate): void {
    this.destinationInput = candidate.label;
    this.resolvedDestinationLabel = candidate.label;
    this.destinationSuggestions = [];
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
      this.destinationSuggestions = [];
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

  ngOnDestroy(): void {
    this.geocodeSubscription?.unsubscribe();
    this.suggestionSubscription?.unsubscribe();
  }

  private selectedCandidate: GeocodeCandidate | null = null;

  private selectedCandidateLabelMatches(query: string): boolean {
    if (!this.selectedCandidate) return false;
    return this.selectedCandidate.label.toLowerCase() === query.toLowerCase();
  }

  clearTravelError(): void {
    if (this.travelError) {
      this.travelError = "";
    }
  }

  selectZone(zoneId: string): void {
    this.selection.selectCity(zoneId);
  }

  formatTravel(result: TravelMatrixResult | null, state: string): string {
    if (!result) {
      return state === "loading" ? "..." : "-";
    }
    if (result.status === "NO_ROUTE") return "--";
    if (result.status !== "OK" || result.duration_s === undefined) return "!";
    const minutes = Math.round(result.duration_s / 60);
    return `${minutes} min`;
  }

  travelTitle(result: TravelMatrixResult | null): string {
    if (!result) return "";
    if (result.status === "ERROR") return "Travel lookup failed.";
    if (result.status === "NO_ROUTE") return "No route available.";
    return "";
  }

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
