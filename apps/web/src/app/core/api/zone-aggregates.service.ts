import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";
import type { ZoneAggregateResult } from "@csv/core";

export type ZoneAggregateBatchRequest = {
  aggregateId: string;
  params: Record<string, unknown>;
};

export type ZoneAggregateBatchResponse = {
  results: Array<{ aggregateId: string; params: Record<string, unknown>; result: ZoneAggregateResult<unknown> }>;
  errors: Array<{ aggregateId: string; params: Record<string, unknown>; code: string; message: string }>;
};

@Injectable({ providedIn: "root" })
export class ZoneAggregatesApiService {
  constructor(private readonly http: HttpClient) {}

  getAggregate(
    zoneId: string,
    aggregateId: string,
    params: Record<string, unknown>
  ): Observable<ZoneAggregateResult<unknown>> {
    let httpParams = new HttpParams();
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue;
      httpParams = httpParams.set(key, String(value));
    }
    const url = `${environment.apiBaseUrl}/api/zones/${encodeURIComponent(zoneId)}/aggregates/${encodeURIComponent(aggregateId)}`;
    return this.http.get<ZoneAggregateResult<unknown>>(url, { params: httpParams });
  }

  batch(
    zoneId: string,
    requests: ZoneAggregateBatchRequest[]
  ): Observable<ZoneAggregateBatchResponse> {
    const url = `${environment.apiBaseUrl}/api/zones/${encodeURIComponent(zoneId)}/aggregates:batch`;
    return this.http.post<ZoneAggregateBatchResponse>(url, { requests });
  }
}
