import { Injectable } from "@angular/core";
import { BehaviorSubject } from "rxjs";

@Injectable({ providedIn: "root" })
export class SelectionService {
  private readonly selectedIdSubject = new BehaviorSubject<string | null>(null);
  readonly selectedId$ = this.selectedIdSubject.asObservable();

  selectCity(id: string): void {
    this.selectedIdSubject.next(id);
  }
}
