import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import {
  BehaviorSubject,
  combineLatest,
  distinctUntilChanged,
  map,
  of,
  startWith,
  switchMap,
  catchError
} from "rxjs";
import {
  normalizeBucket,
  type RouteGeometry,
  type TravelMode,
  type TravelPoint,
  type TravelStatus
} from "@csv/core";
import { environment } from "../../../environments/environment";
import { SelectionService } from "../selection/selection.service";
import { TravelMatrixService, type TravelOptions } from "./travel-matrix.service";

type RouteResponse = {
  zoneId: string | null;
  origin: TravelPoint;
  destination: TravelPoint;
  mode: TravelMode;
  timeBucket: string;
  duration_s?: number;
  distance_m?: number;
  status: TravelStatus;
  geometry?: RouteGeometry;
  transitDetails?: { transfers?: number; walkSeconds?: number; waitSeconds?: number };
};

export type RouteLine = Array<{ lat: number; lng: number }>;

export type TravelRouteState = {
  status: "idle" | "loading" | "loaded" | "error";
  route?: RouteResponse;
  line?: RouteLine;
  message?: string;
};

type RouteRequest = {
  key: string;
  zoneId: string;
  mode: TravelMode;
  destination: { lat: number; lng: number };
  timeBucket: string;
};

const EMPTY_LINE: RouteLine = [];
const DEFAULT_BUCKET = "mon_08:30";

@Injectable({ providedIn: "root" })
export class TravelRouteService {
  private readonly stateSubject = new BehaviorSubject<TravelRouteState>({
    status: "idle",
    line: EMPTY_LINE
  });

  readonly routeState$ = this.stateSubject.asObservable();

  constructor(
    private readonly http: HttpClient,
    private readonly selection: SelectionService,
    private readonly travelMatrix: TravelMatrixService
  ) {
    combineLatest([this.selection.selectedId$, this.travelMatrix.options$])
      .pipe(
        map(([zoneId, options]) => this.buildRequest(zoneId, options)),
        distinctUntilChanged((prev, next) => prev?.key === next?.key),
        switchMap((request) => this.resolveRoute(request))
      )
      .subscribe((state) => {
        this.stateSubject.next(state);
      });
  }

  private buildRequest(zoneId: string | null, options: TravelOptions): RouteRequest | null {
    if (!zoneId) return null;
    if (!options.enabled) return null;
    if (!options.destination) return null;

    const normalizedBucket = safeNormalizeBucket(options.timeBucket);
    const bucket = normalizedBucket ?? DEFAULT_BUCKET;
    if (!normalizedBucket && options.timeBucket !== DEFAULT_BUCKET) {
      console.warn("[travel] route bucket fallback", {
        timeBucket: options.timeBucket
      });
    }

    const key = buildRequestKey(zoneId, options, bucket);
    return {
      key,
      zoneId,
      mode: options.mode,
      destination: options.destination,
      timeBucket: bucket
    };
  }

  private resolveRoute(request: RouteRequest | null) {
    if (!request) {
      return of<TravelRouteState>({ status: "idle", line: EMPTY_LINE });
    }

    const previous = this.stateSubject.value;
    const params = new HttpParams()
      .set("mode", request.mode)
      .set("zoneId", request.zoneId)
      .set("dest", formatLatLng(request.destination))
      .set("timeBucket", request.timeBucket);

    return this.http
      .get<RouteResponse>(`${environment.apiBaseUrl}/api/route`, { params })
      .pipe(
        map((route) => ({
          status: "loaded" as const,
          route,
          line: extractLine(route.geometry)
        })),
        startWith<TravelRouteState>({
          status: "loading",
          route: previous.route,
          line: previous.line
        }),
        catchError(() =>
          of({
            status: "error" as const,
            route: previous.route,
            line: previous.line,
            message: "Route lookup failed."
          })
        )
      );
  }
}

function buildRequestKey(
  zoneId: string,
  options: TravelOptions,
  bucket: string
): string {
  const destination = options.destination;
  const destKey = destination ? `${destination.lat},${destination.lng}` : "none";
  return `${zoneId}:${options.enabled}:${options.mode}:${bucket}:${destKey}`;
}

function formatLatLng(value: { lat: number; lng: number }): string {
  return `${value.lat},${value.lng}`;
}

function safeNormalizeBucket(value: string): string | null {
  try {
    return normalizeBucket(value);
  } catch {
    return null;
  }
}

function extractLine(geometry?: RouteGeometry): RouteLine {
  if (!geometry || typeof geometry === "string") return EMPTY_LINE;
  if (geometry.type !== "LineString") return EMPTY_LINE;
  return geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
}
