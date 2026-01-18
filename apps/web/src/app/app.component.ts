import { Component } from "@angular/core";
import { AsyncPipe, NgClass, NgFor, NgIf, NgSwitch, NgSwitchCase } from "@angular/common";
import { MapComponent } from "./map/map.component";
import { CityDetailsService } from "./services/city-details.service";
import { MapDataService } from "./services/map-data.service";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [AsyncPipe, NgIf, NgFor, NgSwitch, NgSwitchCase, NgClass, MapComponent],
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.css"]
})
export class AppComponent {
  readonly detailsState$ = this.cityDetails.detailsState$;
  readonly mapStatus$ = this.mapData.status$;

  constructor(
    private readonly cityDetails: CityDetailsService,
    private readonly mapData: MapDataService
  ) {}
}
