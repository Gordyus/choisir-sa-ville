import { Component } from "@angular/core";
import { AsyncPipe, NgFor, NgIf, NgSwitch, NgSwitchCase } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { map, startWith } from "rxjs";
import { MapComponent } from "./map/map.component";
import { CityDetailsService } from "./services/city-details.service";
import { SelectionService } from "./services/selection.service";
import { SearchService } from "./services/search.service";

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

  query = "";

  constructor(
    private readonly cityDetails: CityDetailsService,
    private readonly selection: SelectionService,
    private readonly searchService: SearchService
  ) {}

  runSearch(): void {
    this.searchService.search({ q: this.query, limit: 200, offset: 0 });
  }

  selectZone(zoneId: string): void {
    this.selection.selectCity(zoneId);
  }
}
