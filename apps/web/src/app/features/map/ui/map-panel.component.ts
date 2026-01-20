import { Component } from "@angular/core";
import { AsyncPipe } from "@angular/common";
import { MapComponent } from "./map.component";
import { SearchSessionFacade } from "../../search/search-session.facade";
import { MapDataService } from "../state/map-data.service";

@Component({
  selector: "app-map-panel",
  standalone: true,
  imports: [AsyncPipe, MapComponent],
  template: `
    @let markers = markers$ | async;
    @let routeLine = routeLine$ | async;
    <app-map
      [markers]="markers ?? []"
      [routeLine]="routeLine ?? []"
      [highlightedId]="highlightedId$ | async"
    ></app-map>
  `,
  styles: [":host { display: block; height: 100%; }"]
})
export class MapPanelComponent {
  readonly markers$ = this.session.markers$;
  readonly routeLine$ = this.session.routeLine$;
  readonly highlightedId$ = this.mapData.highlightedId$;

  constructor(
    private readonly session: SearchSessionFacade,
    private readonly mapData: MapDataService
  ) {}
}
