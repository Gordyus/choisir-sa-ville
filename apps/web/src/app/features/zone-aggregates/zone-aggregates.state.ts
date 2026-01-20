import { Observable, catchError, distinctUntilChanged, map, of, shareReplay, startWith, switchMap } from "rxjs";
import type { ZoneAggregateResult } from "@csv/core";
import type { ZoneAggregatesApiService } from "../../core/api/zone-aggregates.service";

export type ZoneAggregateState = {
  status: "idle" | "loading" | "loaded" | "error";
  aggregateId: string;
  result?: ZoneAggregateResult<unknown>;
  message?: string;
};

export function createSelectedAggregateStateStream(
  selection$: Observable<string | null>,
  api: ZoneAggregatesApiService,
  aggregateId: string,
  params: Record<string, unknown>
): Observable<ZoneAggregateState> {
  return selection$.pipe(
    distinctUntilChanged(),
    switchMap((zoneId) => {
      if (!zoneId) {
        return of({ status: "idle", aggregateId } as ZoneAggregateState);
      }
      return api.getAggregate(zoneId, aggregateId, params).pipe(
        map((result) => ({ status: "loaded", aggregateId, result } as ZoneAggregateState)),
        startWith({ status: "loading", aggregateId } as ZoneAggregateState),
        catchError(() =>
          of({
            status: "error",
            aggregateId,
            message: "Aggregate data unavailable."
          } as ZoneAggregateState)
        )
      );
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );
}
