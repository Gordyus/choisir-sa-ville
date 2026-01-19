import { Injectable } from "@angular/core";
import { BehaviorSubject, Subject, catchError, map, of, switchMap } from "rxjs";
import { SearchApiService } from "../../core/api/search.service";
import type { SearchRequest, SearchResponse } from "../../core/dto/search";
import type { Viewport } from "../map/state/map-data.service";
import { MapDataService } from "../map/state/map-data.service";

export type SearchState = {
  status: "idle" | "loading" | "loaded" | "error";
  items: SearchResponse["items"];
  total: number;
  message?: string;
};

@Injectable({ providedIn: "root" })
export class SearchFacade {
  private readonly stateSubject = new BehaviorSubject<SearchState>({
    status: "idle",
    items: [],
    total: 0
  });
  private readonly searchRequests = new Subject<{
    request: ReturnType<typeof buildSearchRequest>;
    snapshot: SearchState;
  }>();

  readonly searchState$ = this.stateSubject.asObservable();

  constructor(
    private readonly api: SearchApiService,
    private readonly mapData: MapDataService
  ) {
    this.searchRequests
      .pipe(
        switchMap(({ request, snapshot }) =>
          this.api.search(request).pipe(
            map((response) => ({
              status: "loaded" as const,
              items: response.items,
              total: response.meta.total ?? response.items.length
            })),
            catchError(() =>
              of({
                status: "error" as const,
                items: snapshot.items,
                total: snapshot.total,
                message: "Search failed. Please try again."
              })
            )
          )
        )
      )
      .subscribe((state) => {
        this.stateSubject.next(state);
      });
  }

  search(params: { q?: string; limit?: number; offset?: number }): void {
    const viewport = this.mapData.getViewport();
    if (!viewport) {
      this.stateSubject.next({
        status: "error",
        items: [],
        total: 0,
        message: "Move the map to set a search area."
      });
      return;
    }

    const request = buildSearchRequest(viewport, params);
    const snapshot = this.stateSubject.value;
    this.stateSubject.next({
      status: "loading",
      items: snapshot.items,
      total: snapshot.total
    });
    this.searchRequests.next({ request, snapshot });
  }
}

function buildSearchRequest(
  viewport: Viewport,
  params: { q?: string; limit?: number; offset?: number }
): SearchRequest {
  const filters: Record<string, string> = {};
  const q = params.q?.trim();
  if (q) {
    filters.q = q;
  }

  return {
    area: {
      bbox: {
        minLat: viewport.south,
        minLon: viewport.west,
        maxLat: viewport.north,
        maxLon: viewport.east
      }
    },
    filters,
    limit: params.limit ?? 200,
    offset: params.offset ?? 0
  };
}
