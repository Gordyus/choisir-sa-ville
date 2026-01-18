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
import { MapDataService } from "../services/map-data.service";
import { SelectionService } from "../services/selection.service";

export type MapMarker = {
  id: string;
  label: string;
  lat: number;
  lng: number;
};

@Component({
  selector: "app-map",
  standalone: true,
  templateUrl: "./map.component.html",
  styleUrls: ["./map.component.css"]
})
export class MapComponent implements OnInit, OnDestroy, OnChanges {
  @ViewChild("map", { static: true }) mapElement!: ElementRef<HTMLDivElement>;
  @Input() markers: MapMarker[] = [];

  private map: L.Map | null = null;
  private clusterLayer: L.MarkerClusterGroup | null = null;
  private markerIconInstance: L.DivIcon | null = null;
  private pendingMarkers: MapMarker[] | null = null;

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

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["markers"]) {
      this.applyMarkers(this.markers);
    }
  }

  ngOnInit(): void {
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

    this.handleViewport();
    if (this.pendingMarkers) {
      this.applyMarkers(this.pendingMarkers);
      this.pendingMarkers = null;
    } else if (this.markers.length > 0) {
      this.applyMarkers(this.markers);
    }
  }

  private applyMarkers(markers: MapMarker[]): void {
    if (!this.clusterLayer) {
      this.pendingMarkers = markers;
      return;
    }

    const leafletMarkers = markers.map((item) => this.createMarker(item));
    this.clusterLayer.clearLayers();
    leafletMarkers.forEach((marker) => this.clusterLayer?.addLayer(marker));
  }

  private createMarker(item: MapMarker): L.Marker {
    const marker = L.marker([item.lat, item.lng], { icon: this.markerIcon() });
    marker.on("click", () => {
      this.selection.selectCity(item.id);
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
