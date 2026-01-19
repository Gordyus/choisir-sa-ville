import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";
import type { SearchRequest, SearchResponse } from "../dto/search";

@Injectable({ providedIn: "root" })
export class SearchApiService {
  constructor(private readonly http: HttpClient) {}

  search(request: SearchRequest): Observable<SearchResponse> {
    return this.http.post<SearchResponse>(`${environment.apiBaseUrl}/api/search`, request);
  }
}
