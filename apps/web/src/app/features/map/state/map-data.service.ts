import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable, Subject } from "rxjs";

export type Viewport = {
  south: number;
  west: number;
  north: number;
  east: number;
  zoom: number;
};

export type PanRequest = {
  lat: number;
  lng: number;
  zoom?: number;
};

@Injectable({ providedIn: "root" })
export class MapDataService {
  private readonly viewportSubject = new BehaviorSubject<Viewport | null>(null);
  private readonly panSubject = new Subject<PanRequest>();
  private readonly highlightedIdSubject = new BehaviorSubject<string | null>(null);

  readonly viewport$: Observable<Viewport | null> = this.viewportSubject.asObservable();
  readonly panRequest$: Observable<PanRequest> = this.panSubject.asObservable();
  readonly highlightedId$: Observable<string | null> = this.highlightedIdSubject.asObservable();

  updateViewport(viewport: Viewport): void {
    this.viewportSubject.next(viewport);
  }

  getViewport(): Viewport | null {
    return this.viewportSubject.value;
  }

  requestPan(request: PanRequest): void {
    this.panSubject.next(request);
  }

  setHighlightedId(id: string | null): void {
    this.highlightedIdSubject.next(id);
  }
}
