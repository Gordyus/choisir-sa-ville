import { Component } from "@angular/core";
import { MapPanelComponent } from "./features/map/ui/map-panel.component";
import { RightPanelComponent } from "./features/right-panel/right-panel.component";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [MapPanelComponent, RightPanelComponent],
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.css"]
})
export class AppComponent {
  constructor() {}
}



