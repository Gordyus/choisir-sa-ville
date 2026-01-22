import {
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  ViewChild
} from "@angular/core";
import L from "leaflet";
import type { Subscription } from "rxjs";
import { Subject } from "rxjs";
import { debounceTime } from "rxjs/operators";
import { CityVisibilityLeafletService } from "../../../core/services/city-visibility-leaflet.service";
import { CITY_MARKERS_MODE, MIN_ZOOM_FOR_CUSTOM_CITY_MARKERS } from "../../../core/services/city-visibility.config";
import type { City } from "../../../core/services/city-visibility.types";
import { SearchSessionFacade } from "../../search/search-session.facade";
import { SelectionService } from "../../selection/selection.service";
import { MapDataService } from "../state/map-data.service";

export type MapMarker = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  population?: number;
};

export type RouteLine = Array<{ lat: number; lng: number }>;

@Component({
  selector: "app-map",
  standalone: true,
  templateUrl: "./map.component.html",
  styleUrls: ["./map.component.css"]
})
export class MapComponent implements OnInit, OnDestroy, OnChanges {
  @ViewChild("map", { static: true }) mapElement!: ElementRef<HTMLDivElement>;
  @Input() markers: MapMarker[] = [];
  @Input() routeLine: RouteLine | null = null;
  @Input() highlightedId: string | null = null;

  private map: L.Map | null = null;
  private cityLayer: L.LayerGroup | null = null;
  private markerIconInstance: L.DivIcon | null = null;
  private markerIconActiveInstance: L.DivIcon | null = null;
  private pendingMarkers: MapMarker[] | null = null;
  private routeLayer: L.Polyline | null = null;
  private pendingRoute: RouteLine | null = null;
  private panSubscription?: Subscription;
  private markerIndex = new Map<string, L.Marker>();
  private mapMoveSubject = new Subject<void>();
  private mapMoveSubscription?: Subscription;
  private lastSearchBounds: L.LatLngBounds | null = null;
  private allCities: City[] = [];
  private visibleCityIds = new Set<string>();

  private readonly handleViewport = (): void => {
    if (!this.map) return;
    const bounds = this.map.getBounds();
    this.mapData.updateViewport({
      south: bounds.getSouth(),
      west: bounds.getWest(),
      north: bounds.getNorth(),
      east: bounds.getEast(),
      zoom: this.map.getZoom()
    });

    // Update visible cities only if enabled and zoom is high enough
    // At low/medium zoom, we rely on OSM basemap labels
    if (this.shouldShowCustomCityMarkers()) {
      this.updateVisibleCities();
    }

    // Trigger debounced search on map movement
    this.mapMoveSubject.next();
  };

  constructor(
    private readonly session: SearchSessionFacade,
    private readonly mapData: MapDataService,
    private readonly selection: SelectionService,
    private readonly cityVisibility: CityVisibilityLeafletService
  ) { }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["markers"]) {
      this.applyMarkers(this.markers);
    }
    if (changes["routeLine"]) {
      this.applyRouteLine(this.routeLine);
    }
    if (changes["highlightedId"]) {
      this.applyHighlight();
    }
  }

  ngOnInit(): void {
    // Setup debounced search trigger
    this.mapMoveSubscription = this.mapMoveSubject
      .pipe(debounceTime(150))
      .subscribe(() => {
        this.triggerSearchForCurrentBounds();
      });

    void this.initMap().catch((error) => {
      console.error(error);
    });
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.off("moveend", this.handleViewport);
      this.map.off("zoomend", this.handleViewport);
      this.map.remove();
      this.map = null;
    }
    this.panSubscription?.unsubscribe();
    this.mapMoveSubscription?.unsubscribe();
  }

  private async initMap(): Promise<void> {
    const global = window as typeof window & { L?: typeof L };
    if (!global.L) {
      global.L = L;
    }

    this.map = L.map(this.mapElement.nativeElement, {
      zoomControl: true
    }).setView([46.6, 2.4], 6);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(this.map);

    // Create layer group for city markers (no clustering)
    this.cityLayer = L.layerGroup();
    this.cityLayer.addTo(this.map);

    this.markerIconInstance = L.divIcon({
      className: "city-marker",
      html: "<span></span>",
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });

    this.map.on("moveend", this.handleViewport);
    this.map.on("zoomend", this.handleViewport);
    this.panSubscription = this.mapData.panRequest$.subscribe((request) => {
      if (!this.map) return;
      const zoom = request.zoom ?? this.map.getZoom();
      this.map.setView([request.lat, request.lng], zoom, { animate: true });
    });

    this.handleViewport();
    if (this.pendingMarkers) {
      this.applyMarkers(this.pendingMarkers);
      this.pendingMarkers = null;
    } else if (this.markers.length > 0) {
      this.applyMarkers(this.markers);
    }

    if (this.pendingRoute) {
      this.applyRouteLine(this.pendingRoute);
      this.pendingRoute = null;
    } else if (this.routeLine) {
      this.applyRouteLine(this.routeLine);
    }
  }

  private applyMarkers(markers: MapMarker[]): void {
    if (!this.cityLayer) {
      this.pendingMarkers = markers;
      return;
    }

    // Mode: "resultsOnly" - markers are search results/selection, show them directly
    if (CITY_MARKERS_MODE === 'resultsOnly' || CITY_MARKERS_MODE === 'none') {
      // Clear existing markers
      this.cityLayer.clearLayers();
      this.markerIndex.clear();
      this.visibleCityIds.clear();

      if (CITY_MARKERS_MODE === 'resultsOnly') {
        // Show all result markers directly (no viewport filtering)
        markers.forEach((marker) => {
          const leafletMarker = this.createMarkerFromMapMarker(marker);
          this.cityLayer!.addLayer(leafletMarker);
          this.visibleCityIds.add(marker.id);
        });
      }
      // If mode is "none", don't show any markers

      this.applyHighlight();
      return;
    }

    // Mode: "all" - dynamic visibility (deprecated, causes instability)
    // Convert markers to City format and store
    this.allCities = markers.map((m) => this.markerToCity(m));

    // Reset visibility service when data changes
    this.cityVisibility.reset();

    // Update visible cities immediately
    this.updateVisibleCities();
  }

  /**
   * Check if custom city markers should be shown
   * Based on mode and zoom level
   */
  private shouldShowCustomCityMarkers(): boolean {
    if (!this.map) return false;

    const mode = CITY_MARKERS_MODE;

    // "none" mode: never show custom markers
    if (mode === 'none') return false;

    // "resultsOnly" mode: markers are handled separately in applyMarkers
    // No dynamic viewport-based visibility needed
    if (mode === 'resultsOnly') return false;

    // "all" mode: only show if zoom is high enough
    const zoom = this.map.getZoom();
    return zoom >= MIN_ZOOM_FOR_CUSTOM_CITY_MARKERS;
  }

  /**
   * Update visible cities based on current map state
   * Only called when mode is "all" and zoom is high enough
   */
  private updateVisibleCities(): void {
    if (!this.map || !this.cityLayer) return;
    if (!this.shouldShowCustomCityMarkers()) {
      // Clear all markers if we shouldn't show them
      this.cityLayer.clearLayers();
      this.markerIndex.clear();
      this.visibleCityIds.clear();
      return;
    }

    this.cityVisibility.updateVisibleCities(
      this.map,
      this.allCities,
      (visibleCities) => {
        // Diff and update markers
        const newVisibleIds = new Set(visibleCities.map((c) => c.id));

        // Remove markers that are no longer visible
        for (const id of this.visibleCityIds) {
          if (!newVisibleIds.has(id)) {
            const marker = this.markerIndex.get(id);
            if (marker && this.cityLayer) {
              this.cityLayer.removeLayer(marker);
              this.markerIndex.delete(id);
            }
          }
        }

        // Add new markers
        for (const city of visibleCities) {
          if (!this.visibleCityIds.has(city.id)) {
            const marker = this.createMarkerFromCity(city);
            if (this.cityLayer) {
              this.cityLayer.addLayer(marker);
            }
          }
        }

        // Update visible set
        this.visibleCityIds = newVisibleIds;

        // Update highlights
        this.applyHighlight();
      }
    );
  }

  /**
   * Convert MapMarker to City format
   */
  private markerToCity(marker: MapMarker): City {
    return {
      id: marker.id,
      name: marker.label,
      lat: marker.lat,
      lon: marker.lng,
      population: marker.population
    };
  }

  /**
   * Create Leaflet marker from City (for "all" mode)
   */
  private createMarkerFromCity(city: City): L.Marker {
    const marker = L.marker([city.lat, city.lon], {
      icon: this.markerIcon(city.id === this.highlightedId)
    });
    marker.on("click", () => {
      this.selection.selectCity(city.id);
    });
    this.markerIndex.set(city.id, marker);
    return marker;
  }

  /**
   * Create Leaflet marker from MapMarker (for "resultsOnly" mode)
   */
  private createMarkerFromMapMarker(mapMarker: MapMarker): L.Marker {
    const marker = L.marker([mapMarker.lat, mapMarker.lng], {
      icon: this.markerIcon(mapMarker.id === this.highlightedId)
    });
    marker.on("click", () => {
      this.selection.selectCity(mapMarker.id);
    });
    this.markerIndex.set(mapMarker.id, marker);
    return marker;
  }

  private applyRouteLine(routeLine: RouteLine | null): void {
    if (!this.map) {
      this.pendingRoute = routeLine ?? [];
      return;
    }

    if (!routeLine || routeLine.length === 0) {
      if (this.routeLayer) {
        this.routeLayer.remove();
        this.routeLayer = null;
      }
      return;
    }

    const latLngs = routeLine.map((point) => [point.lat, point.lng] as L.LatLngTuple);
    if (this.routeLayer) {
      this.routeLayer.setLatLngs(latLngs);
    } else {
      this.routeLayer = L.polyline(latLngs, {
        color: "#1f6a8f",
        weight: 3,
        opacity: 0.9
      }).addTo(this.map);
    }
  }

  private markerIcon(isActive: boolean): L.DivIcon {
    if (isActive) {
      if (!this.markerIconActiveInstance) {
        this.markerIconActiveInstance = L.divIcon({
          className: "city-marker city-marker--active",
          html: "<span></span>",
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        });
      }
      return this.markerIconActiveInstance;
    }
    if (!this.markerIconInstance) {
      this.markerIconInstance = L.divIcon({
        className: "city-marker",
        html: "<span></span>",
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });
    }
    return this.markerIconInstance;
  }

  private applyHighlight(): void {
    if (!this.markerIndex.size) return;
    for (const [id, marker] of this.markerIndex.entries()) {
      const isActive = id === this.highlightedId;
      marker.setIcon(this.markerIcon(isActive));
    }
  }

  private triggerSearchForCurrentBounds(): void {
    if (!this.map) return;

    const currentBounds = this.map.getBounds();

    // Prevent duplicate searches for same bounds
    if (this.lastSearchBounds && this.boundsAreEqual(currentBounds, this.lastSearchBounds)) {
      return;
    }

    this.lastSearchBounds = currentBounds;

    // Trigger search via MapDataService
    this.mapData.updateViewport({
      south: currentBounds.getSouth(),
      west: currentBounds.getWest(),
      north: currentBounds.getNorth(),
      east: currentBounds.getEast(),
      zoom: this.map.getZoom()
    });
    this.session.runSearch();
  }

  private boundsAreEqual(a: L.LatLngBounds, b: L.LatLngBounds): boolean {
    const tolerance = 0.0001;
    return (
      Math.abs(a.getSouth() - b.getSouth()) < tolerance &&
      Math.abs(a.getWest() - b.getWest()) < tolerance &&
      Math.abs(a.getNorth() - b.getNorth()) < tolerance &&
      Math.abs(a.getEast() - b.getEast()) < tolerance
    );
  }
}
