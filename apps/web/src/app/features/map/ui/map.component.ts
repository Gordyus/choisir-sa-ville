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
import { SearchSessionFacade } from "../../search/search-session.facade";
import { SelectionService } from "../../selection/selection.service";
import { MapDataService } from "../state/map-data.service";

export type MapMarker = {
  id: string;
  label: string;
  lat: number;
  lng: number;
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
  private clusterLayer: L.MarkerClusterGroup | null = null;
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

    // Trigger debounced search on map movement
    this.mapMoveSubject.next();
  };

  constructor(
    private readonly session: SearchSessionFacade,
    private readonly mapData: MapDataService,
    private readonly selection: SelectionService,
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
      .pipe(debounceTime(200))
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
    await import("leaflet.markercluster");

    this.map = L.map(this.mapElement.nativeElement, {
      zoomControl: true
    }).setView([46.6, 2.4], 6);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(this.map);

    // Cluster markers to keep the map readable when zoomed out.
    this.clusterLayer = L.markerClusterGroup();
    this.clusterLayer.addTo(this.map);

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
    if (!this.clusterLayer) {
      this.pendingMarkers = markers;
      return;
    }

    const leafletMarkers = markers.map((item) => this.createMarker(item));
    this.clusterLayer.clearLayers();
    this.markerIndex.clear();
    leafletMarkers.forEach((marker) => this.clusterLayer?.addLayer(marker));
    this.applyHighlight();
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

  private createMarker(item: MapMarker): L.Marker {
    const marker = L.marker([item.lat, item.lng], {
      icon: this.markerIcon(item.id === this.highlightedId)
    });
    marker.on("click", () => {
      this.selection.selectCity(item.id);
    });
    this.markerIndex.set(item.id, marker);
    return marker;
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
