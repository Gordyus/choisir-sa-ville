import { Injectable } from "@angular/core";
import type { GeocodeCandidate } from "@csv/core";
import {
  DestinationSuggestEffects,
  type DestinationSuggestInput
} from "./destination-suggest.effects";

@Injectable({ providedIn: "root" })
export class DestinationSuggestFacade {
  readonly suggestions$ = this.effects.suggestions$;
  readonly isSuggesting$ = this.effects.isSuggesting$;

  constructor(private readonly effects: DestinationSuggestEffects) {}

  setQuery(input: DestinationSuggestInput): void {
    this.effects.setQuery(input);
  }

  clear(): void {
    this.effects.clear();
  }

  getSnapshot(): GeocodeCandidate[] {
    return this.effects.getSnapshot();
  }
}
