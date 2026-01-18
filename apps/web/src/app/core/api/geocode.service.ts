import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import type { GeocodeRequest, GeocodeResponse } from "@csv/core";
import { environment } from "../../../environments/environment";

@Injectable({ providedIn: "root" })
export class GeocodeService {
  constructor(private readonly http: HttpClient) {}

  geocode(request: GeocodeRequest): Observable<GeocodeResponse> {
    return this.http.post<GeocodeResponse>(`${environment.apiBaseUrl}/api/geocode`, request);
  }
}
