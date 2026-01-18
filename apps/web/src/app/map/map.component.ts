import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { Subject, filter, takeUntil } from "rxjs";
import L from "leaflet";
import { MapDataService, type CityMarker } from "../services/map-data.service";
import { SelectionService } from "../services/selection.service";

@Component({
  selector: "app-map",
  standalone: true,
  templateUrl: "./map.component.html",
  styleUrls: ["./map.component.css"]
})
export class MapComponent implements OnInit, OnDestroy {
  @ViewChild("map", { static: true }) mapElement!: ElementRef<HTMLDivElement>;

  private map: L.Map | null = null;
  private clusterLayer: L.MarkerClusterGroup | null = null;
  private markerIconInstance: L.DivIcon | null = null;
  private readonly destroy$ = new Subject<void>();

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
  };

  constructor(
    private readonly mapData: MapDataService,
    private readonly selection: SelectionService
  ) {}

  ngOnInit(): void {
    void this.initMap().catch((error) => {
      console.error(error);
      this.mapData.reportStatus({
        text: "Map failed to initialize.",
        state: "error"
      });
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();

    if (this.map) {
      this.map.off("moveend", this.handleViewport);
      this.map.off("zoomend", this.handleViewport);
      this.map.remove();
      this.map = null;
    }
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

    this.mapData.bboxState$
      .pipe(
        filter((state) => state.status === "success"),
        takeUntil(this.destroy$)
      )
      .subscribe((state) => {
        if (!this.clusterLayer) return;
        const markers = state.items.map((item) => this.createMarker(item));
        // Swap markers only after a successful response to avoid flicker.
        this.clusterLayer.clearLayers();
        markers.forEach((marker) => this.clusterLayer?.addLayer(marker));
      });

    this.handleViewport();
  }

  private createMarker(item: CityMarker): L.Marker {
    const marker = L.marker([item.lat, item.lon], { icon: this.markerIcon() });
    marker.on("click", () => {
      this.selection.selectCity(item.slug || item.inseeCode);
    });
    return marker;
  }

  private markerIcon(): L.DivIcon {
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
}
