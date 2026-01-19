import { Injectable } from "@angular/core";
import {
  BehaviorSubject,
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  map,
  of,
  switchMap
} from "rxjs";
import type { GeocodeCandidate, GeocodeRequest, SearchArea } from "@csv/core";
import { GeocodeService } from "../../core/api/geocode.service";
import type { Viewport } from "../map/state/map-data.service";

export type DestinationSuggestInput = {
  query: string;
  enabled: boolean;
  selectedLabel?: string | null;
  viewport: Viewport | null;
};

@Injectable({ providedIn: "root" })
export class DestinationSuggestEffects {
  private readonly querySubject = new Subject<DestinationSuggestInput>();
  private readonly suggestionsSubject = new BehaviorSubject<GeocodeCandidate[]>([]);
  private readonly loadingSubject = new BehaviorSubject<boolean>(false);
  private latestSuggestions: GeocodeCandidate[] = [];

  readonly suggestions$ = this.suggestionsSubject.asObservable();
  readonly isSuggesting$ = this.loadingSubject.asObservable();

  constructor(private readonly geocodeService: GeocodeService) {
    this.querySubject
      .pipe(
        map((input) => ({
          ...input,
          query: input.query.trim()
        })),
        debounceTime(300),
        distinctUntilChanged((prev, next) => prev.query === next.query),
        switchMap((input) => {
          if (!input.enabled || input.query.length < 3) {
            this.loadingSubject.next(false);
            return of<GeocodeCandidate[]>([]);
          }
          if (
            input.selectedLabel &&
            input.selectedLabel.toLowerCase() === input.query.toLowerCase()
          ) {
            this.loadingSubject.next(false);
            return of<GeocodeCandidate[]>([]);
          }
          this.loadingSubject.next(true);
          const request = buildGeocodeRequest(input.query, input.viewport);
          return this.geocodeService.geocode(request).pipe(
            map((response) => response.candidates),
            catchError(() => of<GeocodeCandidate[]>([]))
          );
        })
      )
      .subscribe((candidates) => {
        this.loadingSubject.next(false);
        this.latestSuggestions = candidates;
        this.suggestionsSubject.next(candidates);
      });
  }

  setQuery(input: DestinationSuggestInput): void {
    this.querySubject.next(input);
  }

  clear(): void {
    this.latestSuggestions = [];
    this.suggestionsSubject.next([]);
    this.loadingSubject.next(false);
  }

  getSnapshot(): GeocodeCandidate[] {
    return this.latestSuggestions;
  }
}

function buildGeocodeRequest(query: string, viewport: Viewport | null): GeocodeRequest {
  const area = buildSearchArea(viewport);
  const bbox = area?.bbox ?? undefined;
  const near = bbox
    ? {
        lat: (bbox.minLat + bbox.maxLat) / 2,
        lng: (bbox.minLon + bbox.maxLon) / 2
      }
    : undefined;
  return {
    query,
    near,
    bbox,
    limit: 5
  };
}

function buildSearchArea(viewport: Viewport | null): SearchArea {
  if (!viewport) return null;
  return {
    bbox: {
      minLon: viewport.west,
      minLat: viewport.south,
      maxLon: viewport.east,
      maxLat: viewport.north
    }
  };
}
