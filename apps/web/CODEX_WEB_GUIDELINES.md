# Codex Web App Guidelines (Angular) — SOLID, Patterns, and Maintainability

> **Purpose:** Prevent “God components/services”, reduce coupling, and keep the web app easy to extend.  
> These rules are **mandatory** for Codex when changing the web app.

---

## 0) Non‑negotiables (read first)

- **No God components**: components must not orchestrate the whole app.
- **One source of truth** for session state (search area, travel options, selection).
- **Side effects are isolated** (API calls, caching, routing, timers).
- **No direct third‑party calls from the browser** (geocode, routing, etc.) — always through our API.
- **Small PRs**: each PR should have one clear purpose, tests, and no unrelated refactors.

---

## 1) SOLID in practice (rules you can apply)

### S — Single Responsibility Principle (SRP)

- A **component** renders UI + handles UI events for *one* concern.
- A **service** does *one* of:
  - state management (store/facade)
  - side effects (effects)
  - pure computation (utils)

**Red flags**

- A component that:
  - holds many `Subject`s
  - coordinates multiple endpoints
  - performs mapping/formatting + orchestration + persistence

**Fix**

- Split into container components and a central state service (facade/store).

### O — Open/Closed Principle (OCP)

Add new features by:

- adding new components/services
- extending through interfaces/adapters
Not by editing a big switch statement in the app root.

### L — Liskov Substitution Principle (LSP)

Interfaces must be truly swappable:

- `GeocodeProvider` / `TravelProvider` must share identical semantics for return types and error statuses.

### I — Interface Segregation Principle (ISP)

Prefer small interfaces:

- `TravelProviderMatrix` and `TravelProviderRoute` can be separate if needed.
- Do not force providers to implement unsupported features.

### D — Dependency Inversion Principle (DIP)

Depend on abstractions:

- UI depends on `ApiClient`/services, not raw `fetch`.
- Features depend on interfaces, not concrete implementations.

---

## 2) Architecture pattern: “Facade Store + Effects”

### 2.1 Single “Session Store” (Facade)

Create a central facade service (example name):

- `SearchSessionFacade` / `SearchSessionStore`

It owns the session state:

- search area
- travel options (enabled, destination, mode, timeBucket)
- results status
- selected zone

**Rules**

- Components only call **methods** (commands) on the facade.
- Components only read **observables/signals** exposed by the facade.
- No component should coordinate multiple services directly.

### 2.2 Effects Services

All side effects live in dedicated services:

- `SearchEffects` (calls `/api/search`)
- `TravelMatrixEffects` (calls `/api/travel/matrix`)
- `RouteEffects` (calls `/api/route`)
- `AreaSuggestEffects` (calls `/api/areas/suggest`)
- `DestinationSuggestEffects` (calls `/api/geocode/suggest`)

Effects listen to facade state and produce updates back to the facade.

**Rule:** Components must not `subscribe()` for side effects.  
Use `async` pipe or signals.

---

## 3) Component design: Container vs Presentational

### 3.1 Container components

- Connect to facade
- Define UI event handlers
- Minimal template logic

Examples:

- `SearchAreaPanelComponent`
- `TravelOptionsPanelComponent`
- `ResultsPanelComponent`
- `CityDetailsPanelComponent`

### 3.2 Presentational components

- Pure UI
- Inputs/Outputs only
- No API calls, no facade usage

Examples:

- `SuggestionsListComponent`
- `ResultsTableComponent`
- `RouteSummaryComponent`

**Rule:** Presentational components have **no injected services**.

---

## 4) RxJS / Angular best practices (mandatory)

### 4.1 Avoid manual subscriptions in components

- Prefer `async` pipe or signals.
- If absolutely necessary: `takeUntilDestroyed()` and a clear comment why.

### 4.2 Cancel stale requests

For autocompletion and dynamic queries:

- `debounceTime(250–400ms)`
- `distinctUntilChanged()`
- `switchMap()` (cancels previous)
- `shareReplay(1)` when multiple consumers

### 4.3 Keep streams pure

- Do not mutate arrays/objects inside stream operators.
- Use immutable updates (`map`, `filter`, spreads).

### 4.4 Typed statuses, not booleans

Avoid multiple flags like `isLoading`, `hasError`, etc. scattered around.  
Use one union type:

- `idle | loading | loaded | error`

---

## 5) API contract discipline

### 5.1 DTOs live in one place

- Shared types/DTOs are defined once and reused.
- No duplicated “same shape” interfaces across files.

### 5.2 Consistent error envelope

UI must handle API errors uniformly:

- `ApiError { code, message, details?, requestId? }`

### 5.3 Deterministic keys and versioning

If caching keys exist, they must be built in pure functions:

- `buildTravelTimeKey(...)`
- `buildGeocodeKey(...)`
Keys must include a `v1` prefix to allow future migrations.

---

## 6) Design patterns to apply (when relevant)

### 6.1 Adapter

Use adapters for external integrations:

- OSRM adapter (car routing)
- Photon/Nominatim adapter (geocode)
- Future providers can swap without touching UI.

### 6.2 Strategy

For mode-specific behavior:

- `car` vs `transit` selection should be via a strategy map:
  - `{ car: CarProvider, transit: TransitProvider }`
Not a cascade of `if/else`.

### 6.3 Factory

Provider creation lives in a single place:

- `createTravelProvider(config)`
- `createGeocodeProvider(config)`

### 6.4 Repository (optional)

If local persistence grows:

- a repository abstracts storage (cache/localStorage) from consumers.

---

## 7) Folder structure (mandatory)

The following structure is mandatory for all new and refactored code.
The folder `src/app/services/` is forbidden.

All logic must be organized by feature under `src/app/features/`.
Core cross-cutting concerns live under `src/app/core/`.

```
src/app/
  core/
    api/
      geocode.service.ts
      search.service.ts
      travel-matrix.service.ts
      travel-route.service.ts
    dto/
    utils/

  features/
    search-area/
      area-suggest.facade.ts
      area-suggest.effects.ts
      area-suggest.effects.spec.ts

    travel/
      destination/
        destination-suggest.facade.ts
        destination-suggest.effects.ts
        destination-suggest.effects.spec.ts
      matrix/
        travel-matrix.effects.ts
      route/
        travel-route.effects.ts

    results/
      results.facade.ts

    city-details/
      city-details.facade.ts

  shared/
    ui/
    models/

  map/
    map.component.ts
```

**Rule:** Cross-feature communication happens through the **facade/state**, not direct imports.

---

## 8) Code review checklist (Codex must self-check)

Before opening a PR, ensure:

- [ ] No new “God component” introduced.
- [ ] Feature logic is in facade + effects, not in component.
- [ ] No raw `fetch` in components (API calls via services).
- [ ] Requests are cancelable (switchMap) where needed.
- [ ] Shared DTOs are reused (no duplicate shapes).
- [ ] Errors handled via a common pattern.
- [ ] New code has tests (unit/contract) for critical logic.
- [ ] Naming is consistent: `lat,lng` internally; provider converts to `lon,lat` at boundary only.

---

## 9) When you must refactor

If a change requires touching more than ~200 lines in a component:

- Stop and split it first (container/presentational + facade).  
If a service grows beyond ~250 lines or has multiple concerns:
- Split into `*Facade` + `*Effects` + `*Utils`.

---

## 10) “Do / Don’t” examples

### ✅ Do

- `SearchSessionFacade.setDestinationAddress(text)`
- `DestinationSuggestEffects` listens to `destinationInput$` and updates `destinationSuggestions$`
- `TravelMatrixEffects` runs when `travel.enabled && destination.resolved && results.loaded`

### ❌ Don’t

- `AppComponent` holds:
  - destination input
  - suggestions
  - selected zone
  - travel options
  - results + route state
  - multiple network calls and subscriptions

---

## 11) Definition of Done (PR)

A PR is done only if:

- [ ] functionality works
- [ ] architecture rules above are respected
- [ ] tests pass and new tests added where needed
- [ ] no regressions in UX (loading/error states)
- [ ] code remains hosting-agnostic (no platform-specific coupling)
