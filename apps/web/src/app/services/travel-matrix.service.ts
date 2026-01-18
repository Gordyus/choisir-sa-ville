import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
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
  type TravelMatrixResult,
  type TravelMode,
  normalizeBucket
} from "@csv/core";
import { environment } from "../../environments/environment";
import { SearchService } from "./search.service";

export type TravelMatrixState = {
  status: "idle" | "loading" | "loaded" | "error";
  results: Record<string, TravelMatrixResult>;
  message?: string;
};

export type TravelOptions = {
  enabled: boolean;
  destination: { lat: number; lng: number } | null;
  mode: TravelMode;
  timeBucket: string;
};

type MatrixRequest = {
  key: string;
  payload: {
    mode: TravelMode;
    destination: { lat: number; lng: number };
    timeBucket: string;
    origins: Array<{ zoneId: string; lat: number; lng: number }>;
  };
};

const EMPTY_RESULTS: Record<string, TravelMatrixResult> = {};

@Injectable({ providedIn: "root" })
export class TravelMatrixService {
  private readonly optionsSubject = new BehaviorSubject<TravelOptions>({
    enabled: false,
    destination: null,
    mode: "car",
    timeBucket: "mon_08:30"
  });
  private readonly stateSubject = new BehaviorSubject<TravelMatrixState>({
    status: "idle",
    results: EMPTY_RESULTS
  });

  readonly options$ = this.optionsSubject.asObservable();
  readonly matrixState$ = this.stateSubject.asObservable();

  constructor(
    private readonly http: HttpClient,
    private readonly searchService: SearchService
  ) {
    combineLatest([this.searchService.searchState$, this.options$])
      .pipe(
        map(([searchState, options]) => {
          if (!options.enabled) {
            return { kind: "idle" as const };
          }
          if (searchState.status !== "loaded") {
            return { kind: "idle" as const };
          }
          if (!options.destination) {
            return { kind: "error" as const, message: "Destination required." };
          }
          const origins = searchState.items.map((item) => ({
            zoneId: item.zoneId,
            lat: item.centroid.lat,
            lng: item.centroid.lng
          }));
          if (origins.length === 0) {
            return { kind: "idle" as const };
          }

          const normalizedBucket = normalizeBucket(options.timeBucket);
          const key = buildRequestKey(options, origins);
          return {
            kind: "request" as const,
            request: {
              key,
              payload: {
                mode: options.mode,
                destination: options.destination,
                timeBucket: normalizedBucket,
                origins
              }
            }
          };
        }),
        distinctUntilChanged((prev, next) => {
          if (prev.kind !== next.kind) return false;
          if (prev.kind === "request" && next.kind === "request") {
            return prev.request.key === next.request.key;
          }
          if (prev.kind === "error" && next.kind === "error") {
            return prev.message === next.message;
          }
          return true;
        }),
        switchMap((state) => this.resolveMatrix(state))
      )
      .subscribe((nextState) => {
        this.stateSubject.next(nextState);
      });
  }

  updateOptions(options: Partial<TravelOptions>): void {
    this.optionsSubject.next({
      ...this.optionsSubject.value,
      ...options
    });
  }

  private resolveMatrix(
    state:
      | { kind: "idle" }
      | { kind: "error"; message: string }
      | { kind: "request"; request: MatrixRequest }
  ) {
    if (state.kind === "idle") {
      return of<TravelMatrixState>({ status: "idle", results: EMPTY_RESULTS });
    }
    if (state.kind === "error") {
      return of<TravelMatrixState>({
        status: "error",
        results: this.stateSubject.value.results,
        message: state.message
      });
    }

    const previous = this.stateSubject.value.results;
    return this.http
      .post<{ results: TravelMatrixResult[] }>(
        `${environment.apiBaseUrl}/api/travel/matrix`,
        state.request.payload
      )
      .pipe(
        map((response) => ({
          status: "loaded" as const,
          results: indexResults(response.results)
        })),
        startWith<TravelMatrixState>({
          status: "loading",
          results: previous
        }),
        catchError(() =>
          of({
            status: "error" as const,
            results: previous,
            message: "Travel time lookup failed."
          })
        )
      );
  }
}

function buildRequestKey(options: TravelOptions, origins: Array<{ zoneId: string }>): string {
  const destination = options.destination;
  const destKey = destination ? `${destination.lat},${destination.lng}` : "none";
  const originKey = origins.map((origin) => origin.zoneId).join("|");
  return `${options.enabled}:${options.mode}:${options.timeBucket}:${destKey}:${originKey}`;
}

function indexResults(results: TravelMatrixResult[]): Record<string, TravelMatrixResult> {
  const indexed: Record<string, TravelMatrixResult> = {};
  for (const result of results) {
    indexed[result.zoneId] = result;
  }
  return indexed;
}
