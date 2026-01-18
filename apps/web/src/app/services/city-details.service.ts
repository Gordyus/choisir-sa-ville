import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import {
  Observable,
  catchError,
  distinctUntilChanged,
  map,
  of,
  shareReplay,
  startWith,
  switchMap
} from "rxjs";
import { environment } from "../../environments/environment";
import { SelectionService } from "./selection.service";

type CityDetails = {
  inseeCode: string;
  name: string;
  slug: string;
  population: number | null;
  departmentCode: string | null;
  departmentName: string | null;
  regionCode: string | null;
  regionName: string | null;
  lat: number | null;
  lon: number | null;
  postalCodes: string[];
};

export type DetailsState = {
  status: "idle" | "loading" | "loaded" | "error";
  city?: CityDetails;
  message?: string;
};

@Injectable({ providedIn: "root" })
export class CityDetailsService {
  readonly detailsState$: Observable<DetailsState> = this.selection.selectedId$.pipe(
    distinctUntilChanged(),
    switchMap((id) => {
      if (!id) {
        return of({ status: "idle" as const });
      }
      return this.http
        .get<CityDetails>(`${environment.apiBaseUrl}/cities/${encodeURIComponent(id)}`)
        .pipe(
          map((city) => ({ status: "loaded" as const, city })),
          startWith({ status: "loading" as const }),
          catchError(() =>
            of({
              status: "error" as const,
              message: "The city details could not be loaded."
            })
          )
        );
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  constructor(
    private readonly http: HttpClient,
    private readonly selection: SelectionService
  ) {}
}
