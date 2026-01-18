import { Component } from "@angular/core";
import { AsyncPipe, NgFor, NgIf, NgSwitch, NgSwitchCase } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { combineLatest, map, startWith } from "rxjs";
import { MapComponent } from "./map/map.component";
import { CityDetailsService } from "./services/city-details.service";
import { SelectionService } from "./services/selection.service";
import { SearchService } from "./services/search.service";
import { TravelMatrixService } from "./services/travel-matrix.service";
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
  timeBucket = "mon_08:30";
  travelError = "";

  constructor(
    private readonly cityDetails: CityDetailsService,
    private readonly selection: SelectionService,
    private readonly searchService: SearchService,
    private readonly travelMatrix: TravelMatrixService
  ) {}

  runSearch(): void {
    this.searchService.search({ q: this.query, limit: 200, offset: 0 });
  }

  applyTravelOptions(): void {
    this.travelError = "";
    if (!this.travelEnabled) {
      this.travelMatrix.updateOptions({ enabled: false });
      return;
    }

    const destination = parseLatLng(this.destinationInput);
    if (!destination) {
      this.travelError = "Enter destination as lat,lng (e.g. 48.8566,2.3522).";
      this.travelMatrix.updateOptions({ enabled: true, destination: null });
      return;
    }

    this.travelMatrix.updateOptions({
      enabled: true,
      destination,
      mode: this.travelMode,
      timeBucket: this.timeBucket
    });
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
