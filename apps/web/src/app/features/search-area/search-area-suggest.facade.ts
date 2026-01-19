import { Injectable } from "@angular/core";
import { BehaviorSubject, Subject, catchError, debounceTime, distinctUntilChanged, map, of, switchMap } from "rxjs";
import type { GeocodeCandidate } from "@csv/core";
import { AreaSuggestService } from "../../core/api/area-suggest.service";

@Injectable({ providedIn: "root" })
export class SearchAreaSuggestFacade {
  private readonly querySubject = new Subject<string>();
  private readonly suggestionsSubject = new BehaviorSubject<GeocodeCandidate[]>([]);
  private readonly loadingSubject = new BehaviorSubject<boolean>(false);
  private latestSuggestions: GeocodeCandidate[] = [];

  readonly suggestions$ = this.suggestionsSubject.asObservable();
  readonly isSuggesting$ = this.loadingSubject.asObservable();

  constructor(private readonly areaSuggest: AreaSuggestService) {
    this.querySubject
      .pipe(
        map((value) => value.trim()),
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((query) => {
          if (!shouldSuggestAreaQuery(query)) {
            this.loadingSubject.next(false);
            return of<GeocodeCandidate[]>([]);
          }
          this.loadingSubject.next(true);
          return this.areaSuggest.suggest(query).pipe(
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

  setQuery(value: string): void {
    this.querySubject.next(value);
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

function shouldSuggestAreaQuery(value: string): boolean {
  const query = value.trim();
  if (query.length < 2) return false;
  if (/^\d/.test(query)) return true;
  return query.length >= 3;
}
