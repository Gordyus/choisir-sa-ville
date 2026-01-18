import { Component } from "@angular/core";
import { AsyncPipe, NgFor, NgIf, NgSwitch, NgSwitchCase } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { combineLatest, map, startWith } from "rxjs";
import { MapComponent } from "./map/map.component";
import { CityDetailsService } from "./services/city-details.service";
import { SelectionService } from "./services/selection.service";
import { SearchService } from "./services/search.service";
import { TravelMatrixService } from "./services/travel-matrix.service";
import { TravelRouteService } from "./services/travel-route.service";
import type { TravelMatrixResult, TravelMode } from "@csv/core";

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
export class AppComponent {
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
  travelMode: TravelMode = "car";
  travelDay = "mon";
  travelTime = "08:30";
  travelError = "";
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
    private readonly searchService: SearchService,
    private readonly travelMatrix: TravelMatrixService,
    private readonly travelRoute: TravelRouteService
  ) {}

  runSearch(): void {
    this.searchService.search({ q: this.query, limit: 200, offset: 0 });
  }

  applyTravelOptions(): void {
    this.travelError = "";
    console.debug("[travel] apply", {
      enabled: this.travelEnabled,
      destinationInput: this.destinationInput,
      mode: this.travelMode,
      day: this.travelDay,
      time: this.travelTime
    });
    if (!this.travelEnabled) {
      this.travelMatrix.updateOptions({ enabled: false });
      return;
    }

    const destination = parseLatLng(this.destinationInput);
    if (!destination) {
      this.travelError = "Enter destination as lat,lng (e.g. 48.8566,2.3522).";
      console.warn("[travel] invalid destination", { destinationInput: this.destinationInput });
      this.travelMatrix.updateOptions({ enabled: true, destination: null });
      return;
    }

    if (!this.travelDay || !this.travelTime) {
      this.travelError = "Select a valid day and time.";
      console.warn("[travel] missing day/time", {
        day: this.travelDay,
        time: this.travelTime
      });
      return;
    }
    const bucket = `${this.travelDay}_${this.travelTime}`;
    console.debug("[travel] bucket", { bucket });

    this.travelMatrix.updateOptions({
      enabled: true,
      destination,
      mode: this.travelMode,
      timeBucket: bucket
    });
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
