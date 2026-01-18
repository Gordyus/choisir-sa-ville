import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable } from "rxjs";

export type Viewport = {
  south: number;
  west: number;
  north: number;
  east: number;
  zoom: number;
};

@Injectable({ providedIn: "root" })
export class MapDataService {
  private readonly viewportSubject = new BehaviorSubject<Viewport | null>(null);

  readonly viewport$: Observable<Viewport | null> = this.viewportSubject.asObservable();

  updateViewport(viewport: Viewport): void {
    this.viewportSubject.next(viewport);
  }

  getViewport(): Viewport | null {
    return this.viewportSubject.value;
  }
}
