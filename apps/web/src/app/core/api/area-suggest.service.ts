import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";
import type { GeocodeResponse } from "@csv/core";

@Injectable({ providedIn: "root" })
export class AreaSuggestService {
  constructor(private readonly http: HttpClient) {}

  suggest(query: string, limit?: number): Observable<GeocodeResponse> {
    return this.http.get<GeocodeResponse>(`${environment.apiBaseUrl}/api/areas/suggest`, {
      params: limit ? { q: query, limit } : { q: query }
    });
  }
}
