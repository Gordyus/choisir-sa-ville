import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import {
  BehaviorSubject,
  Observable,
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  map,
  of,
  shareReplay,
  startWith,
  switchMap
} from "rxjs";
import { environment } from "../../environments/environment";

export type CityMarker = {
  inseeCode: string;
  name: string;
  slug: string;
  lat: number;
  lon: number;
  departmentCode: string | null;
  regionCode: string | null;
};

type ApiListResponse<T> = {
  items: T[];
  meta: { limit: number; offset: number };
};

export type MapStatus = {
  text: string;
  state: "ok" | "error" | "idle";
};

type Viewport = {
  south: number;
  west: number;
  north: number;
  east: number;
  zoom: number;
};

type BboxRequest = {
  viewport: Viewport;
  limit: number;
  key: string;
};

type BboxState =
  | { status: "loading"; request: BboxRequest }
  | { status: "success"; request: BboxRequest; items: CityMarker[]; meta: ApiListResponse<CityMarker>["meta"] }
  | { status: "error"; request: BboxRequest; message: string };

@Injectable({ providedIn: "root" })
export class MapDataService {
  private readonly viewportSubject = new Subject<Viewport>();
  private readonly statusSubject = new BehaviorSubject<MapStatus>({
    text: "",
    state: "idle"
  });
  private bboxController: AbortController | null = null;

  readonly status$ = this.statusSubject.asObservable();

  readonly bboxState$: Observable<BboxState> = this.viewportSubject.pipe(
    debounceTime(350),
    map((viewport) => {
      const limit = getLimitForZoom(viewport.zoom);
      return {
        viewport,
        limit,
        key: buildBboxKey(viewport, limit)
      };
    }),
    distinctUntilChanged((prev, next) => prev.key === next.key),
    switchMap((request) => {
      this.statusSubject.next({ text: "Loading markers...", state: "idle" });
      return this.fetchBbox(request).pipe(
        map((response) => ({
          status: "success" as const,
          request,
          items: response.items,
          meta: response.meta
        })),
        startWith({ status: "loading" as const, request }),
        catchError(() =>
          of({
            status: "error" as const,
            request,
            message: "Failed to load markers."
          })
        )
      );
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  constructor(private readonly http: HttpClient) {
    this.bboxState$.subscribe((state) => {
      if (state.status === "success") {
        if (state.items.length === 0) {
          this.statusSubject.next({ text: "No cities in this area", state: "idle" });
        } else {
          this.statusSubject.next({
            text: `${state.items.length} markers loaded`,
            state: "ok"
          });
        }
      }
      if (state.status === "error") {
        this.statusSubject.next({ text: state.message, state: "error" });
      }
    });
  }

  reportStatus(status: MapStatus): void {
    this.statusSubject.next(status);
  }

  updateViewport(viewport: Viewport): void {
    this.viewportSubject.next(viewport);
  }

  private fetchBbox(request: BboxRequest): Observable<ApiListResponse<CityMarker>> {
    if (this.bboxController) {
      this.bboxController.abort();
    }
    this.bboxController = new AbortController();

    const params = new HttpParams()
      .set("minLat", request.viewport.south.toString())
      .set("minLon", request.viewport.west.toString())
      .set("maxLat", request.viewport.north.toString())
      .set("maxLon", request.viewport.east.toString())
      .set("limit", request.limit.toString())
      .set("offset", "0");

    const options = {
      params,
      signal: this.bboxController.signal
    } as unknown as { params: HttpParams; signal: AbortSignal };

    return this.http.get<ApiListResponse<CityMarker>>(
      `${environment.apiBaseUrl}/cities/bbox`,
      options
    );
  }
}

function roundCoord(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function buildBboxKey(viewport: Viewport, limit: number): string {
  const minLat = roundCoord(viewport.south);
  const minLon = roundCoord(viewport.west);
  const maxLat = roundCoord(viewport.north);
  const maxLon = roundCoord(viewport.east);
  return `${minLat}|${minLon}|${maxLat}|${maxLon}|${limit}`;
}

function getLimitForZoom(zoom: number): number {
  // Lower zoom levels request fewer cities to keep the map responsive.
  if (zoom < 6) return 50;
  if (zoom < 8) return 200;
  return 500;
}
