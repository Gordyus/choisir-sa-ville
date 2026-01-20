import { Injectable } from "@angular/core";
import type { Observable } from "rxjs";
import { ZoneAggregatesApiService } from "../../core/api/zone-aggregates.service";
import { SelectionService } from "../selection/selection.service";
import { createSelectedAggregateStateStream, type ZoneAggregateState } from "./zone-aggregates.state";

@Injectable({ providedIn: "root" })
export class ZoneAggregatesFacade {
  constructor(
    private readonly api: ZoneAggregatesApiService,
    private readonly selection: SelectionService
  ) {}

  getSelectedAggregateState(
    aggregateId: string,
    params: Record<string, unknown>
  ): Observable<ZoneAggregateState> {
    return createSelectedAggregateStateStream(
      this.selection.selectedId$,
      this.api,
      aggregateId,
      params
    );
  }
}

export type { ZoneAggregateState };
