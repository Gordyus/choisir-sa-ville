import { Injectable, effect, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { SearchSessionFacade } from "../search/search-session.facade";
import { SelectionService } from "../selection/selection.service";

export type RightPanelMode = "edit" | "results";

@Injectable({ providedIn: "root" })
export class RightPanelStore {
  readonly mode = signal<RightPanelMode>("edit");
  readonly selectedZoneId = signal<string | null>(null);
  readonly bottomSheetExpanded = signal(false);
  readonly lastSearchHasResults = signal(false);
  readonly hoveredZoneId = signal<string | null>(null);

  constructor(
    session: SearchSessionFacade,
    selection: SelectionService
  ) {
    const searchState = toSignal(session.searchState$, {
      initialValue: { status: "idle", items: [], total: 0 }
    });
    const selectedId = toSignal(selection.selectedId$, { initialValue: null });

    effect(() => {
      const state = searchState();
      if (state.status !== "loaded") {
        this.lastSearchHasResults.set(false);
        return;
      }

      const hasResults = state.items.length > 0;
      if (hasResults && !this.lastSearchHasResults()) {
        this.lastSearchHasResults.set(true);
        if (this.mode() === "edit") {
          this.mode.set("results");
        }
        return;
      }

      if (!hasResults) {
        this.lastSearchHasResults.set(false);
      }
    });

    effect(() => {
      const id = selectedId();
      this.selectedZoneId.set(id);
      if (id) {
        this.bottomSheetExpanded.set(false);
      }
    });
  }

  enterEditMode(): void {
    this.mode.set("edit");
  }

  enterResultsMode(): void {
    this.mode.set("results");
  }

  toggleBottomSheet(): void {
    this.bottomSheetExpanded.update((value) => !value);
  }

  setHoveredZone(id: string | null): void {
    this.hoveredZoneId.set(id);
  }
}
