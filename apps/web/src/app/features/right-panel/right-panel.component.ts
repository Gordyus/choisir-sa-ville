import { Component, computed } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import type { GeocodeCandidate, TravelMatrixResult, TravelMode } from "@csv/core";
import { SearchSessionFacade, type SessionState } from "../search/search-session.facade";
import type { SearchResponse } from "../../core/dto/search";
import { MapDataService } from "../map/state/map-data.service";
import { RightPanelStore } from "./right-panel.store";
import { ZoneAggregatesFacade, type ZoneAggregateState } from "../zone-aggregates/zone-aggregates.facade";
import { SearchCriteriaPanelComponent } from "./search-criteria-panel.component";
import { CriteriaSummaryBarComponent, type CriteriaChip } from "./criteria-summary-bar.component";
import { ZoneResultsListComponent, type ZoneResultItem } from "./zone-results-list.component";
import { ZoneDetailsBottomSheetComponent, type ZoneDetailsSummary } from "./zone-details-bottom-sheet.component";

type ViewState = {
  status: "idle" | "loading" | "loaded" | "error";
  items: SearchResponse["items"];
  rows: ZoneResultItem[];
  total: number;
  message?: string;
  travelStatus: "idle" | "loading" | "loaded" | "error";
  travelMessage: string | undefined;
  travelEnabled: boolean;
};

type MatrixStatus = "idle" | "loading" | "loaded" | "error";

const EMPTY_SESSION: SessionState = {
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

const EMPTY_VIEW: ViewState = {
  status: "idle",
  items: [],
  rows: [],
  total: 0,
  travelStatus: "idle",
  travelMessage: undefined,
  travelEnabled: false
};

@Component({
  selector: "app-right-panel",
  standalone: true,
  imports: [
    SearchCriteriaPanelComponent,
    CriteriaSummaryBarComponent,
    ZoneResultsListComponent,
    ZoneDetailsBottomSheetComponent
  ],
  templateUrl: "./right-panel.component.html",
  styleUrls: ["./right-panel.component.css"]
})
export class RightPanelComponent {
  readonly sessionState = toSignal(this.session.state$, { initialValue: EMPTY_SESSION });
  readonly viewState = toSignal(this.session.viewState$, { initialValue: EMPTY_VIEW });
  readonly detailsState = toSignal(this.session.detailsState$, {
    initialValue: { status: "idle" as const }
  });
  readonly querySuggestions = toSignal(this.session.querySuggestions$, { initialValue: [] });
  readonly isQuerySuggesting = toSignal(this.session.isQuerySuggesting$, { initialValue: false });
  readonly destinationSuggestions = toSignal(this.session.destinationSuggestions$, { initialValue: [] });
  readonly isDestinationSuggesting = toSignal(this.session.isDestinationSuggesting$, {
    initialValue: false
  });

  readonly mode = this.store.mode;
  readonly bottomSheetExpanded = this.store.bottomSheetExpanded;
  readonly selectedZoneId = this.store.selectedZoneId;
  readonly summaryChips = computed(() => buildSummaryChips(this.sessionState()));
  readonly dayOptions = this.session.dayOptions;
  readonly timeOptions = this.session.timeOptions;
  readonly selectedTravel = computed(() => {
    const id = this.selectedZoneId();
    if (!id) return null;
    return this.viewState().rows.find((row) => row.zoneId === id)?.travel ?? null;
  });
  readonly rentAggregateState = toSignal(
    this.zoneAggregates.getSelectedAggregateState("rent.v1", {
      segmentKey: "ALL_ALL"
    }),
    { initialValue: { status: "idle", aggregateId: "rent.v1" } as ZoneAggregateState }
  );
  readonly detailsSummary = computed<ZoneDetailsSummary | null>(() => {
    const state = this.detailsState();
    if (state.status !== "loaded" || !state.city) return null;
    return {
      name: state.city.name,
      department: state.city.departmentName ?? null,
      region: state.city.regionName ?? null,
      population: state.city.population ?? null
    };
  });

  constructor(
    private readonly session: SearchSessionFacade,
    private readonly store: RightPanelStore,
    private readonly mapData: MapDataService,
    private readonly zoneAggregates: ZoneAggregatesFacade
  ) {}

  onSearch(): void {
    this.session.runSearch();
  }

  onQueryUpdated(value: string): void {
    this.session.updateQuery(value);
  }

  onQueryKey(event: KeyboardEvent): void {
    this.session.onQueryKey(event);
  }

  onQueryCandidateSelected(candidate: GeocodeCandidate): void {
    this.session.selectQueryCandidate(candidate);
  }

  onTravelEnabledChange(value: boolean): void {
    this.session.onTravelEnabledChange(value);
  }

  onDestinationInputChange(value: string): void {
    this.session.onDestinationInputChange(value);
  }

  onDestinationKey(event: KeyboardEvent): void {
    this.session.onDestinationKey(event);
  }

  onDestinationCandidateSelected(candidate: GeocodeCandidate): void {
    this.session.selectCandidate(candidate);
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

  onApplyTravel(): void {
    this.session.applyTravelOptions();
  }

  onEdit(): void {
    this.store.enterEditMode();
    this.store.setHoveredZone(null);
    this.mapData.setHighlightedId(null);
  }

  onHover(zoneId: string | null): void {
    this.store.setHoveredZone(zoneId);
    this.mapData.setHighlightedId(zoneId);
  }

  onSelect(zoneId: string): void {
    this.session.selectZone(zoneId);
    const row = this.viewState().rows.find((item) => item.zoneId === zoneId);
    if (!row) return;
    const viewport = this.mapData.getViewport();
    const zoom = viewport ? Math.max(viewport.zoom, 10) : 10;
    this.mapData.requestPan({ lat: row.centroid.lat, lng: row.centroid.lng, zoom });
  }

  toggleBottomSheet(): void {
    this.store.toggleBottomSheet();
  }

  formatTravel(result: TravelMatrixResult | null, status: MatrixStatus): string {
    if (!result) {
      return status === "loading" ? "..." : "—";
    }
    if (result.status === "NO_ROUTE") return "—";
    if (result.status !== "OK" || result.duration_s === undefined) return "!";
    const minutes = Math.round(result.duration_s / 60);
    return `${minutes} min`;
  }
}

function buildSummaryChips(session: SessionState): CriteriaChip[] {
  const chips: CriteriaChip[] = [];
  const zoneLabel = session.resolvedAreaLabel || session.query;
  if (zoneLabel) {
    chips.push({ label: zoneLabel, kind: "area" });
  }
  if (session.travelEnabled) {
    const modeLabel = session.travelMode === "car" ? "car" : "transit";
    chips.push({
      label: `Travel: ${modeLabel}, ${session.travelDay} ${session.travelTime}`,
      kind: "travel"
    });
  } else {
    chips.push({ label: "Travel: off", kind: "travel" });
  }
  return chips;
}
