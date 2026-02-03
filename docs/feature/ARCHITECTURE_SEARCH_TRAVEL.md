# Architecture: search area + travel options

This document describes the code architecture for:
- search area autocomplete and zone search
- travel options (travel time + route)

Scope: `apps/api`, `apps/web`, and shared types in `packages/core`.

## 1) Flow overview

### Search area
1. User types in the **Search area** field (frontend).
2. Autocomplete via `GET /api/areas/suggest?q=...`.
3. Selecting a suggestion pans the map to the area.
4. Clicking **Search this area** calls `POST /api/search` with the viewport bbox.

### Travel options
1. User enables **Enable travel time**.
2. User enters destination (address or lat,lng).
3. Address autocomplete via `POST /api/geocode` (Photon).
4. Validation + `timeBucket` computed from day + time.
5. `POST /api/travel-matrix` for table travel times.
6. Clicking a city triggers `GET /api/route` for the polyline.

## 2) API (apps/api)

### Routes
- `POST /api/search`
  Input: viewport bbox + filters.
  Output: list of zones.

- `GET /api/areas/suggest`
  Input: `q` (+ optional `limit`).
  Output: FR suggestions (commune / department / region / postal code).

- `POST /api/geocode`
  Input: `query` + `near` + `bbox`.
  Output: address candidates (Photon).

- `POST /api/travel-matrix`
  Input: origins + destination + mode + timeBucket.
  Output: durations/distances per zone.

- `GET /api/route`
  Input: zoneId or originLatLng + dest + mode + timeBucket.
  Output: route (GeoJSON polyline).

### Services
- `search.service.ts`
  Orchestrates search by bbox.

- `area-suggest.service.ts`
  FR suggestions from DB:
  - communes (`commune`)
  - departments (`department`)
  - regions (`region`)
  - postal codes (`commune_postal_code`)
  Ranking: exact > startsWith > contains + population tiebreak.

- `geocode.service.ts`
  Cache + Photon provider.

- `travel-matrix.service.ts`
  Cache + OSRM provider (car).

- `travel-route.service.ts`
  Cache + OSRM provider (car) + coordinate lookup.

### Providers / cache
- `photon-geocode-provider.ts`
  External Photon provider, FR filtering at API.

- `osrm-travel-provider.ts`
  OSRM provider (car only).

- `cache-store.ts`
  Postgres cache (table `cache_store`).

### Config
Env vars:
- `DATABASE_URL`
- `GEOCODE_BASE_URL` (Photon)
- `OSRM_BASE_URL`
- `PORT`

## 3) Frontend (apps/web)

### Components
- `AppComponent`
  Main UI: Search area + Travel options + results + details.

- `MapComponent`
  Leaflet + clustering + markers + route polyline.
  Listens to `moveend` / `zoomend` only.

### Frontend services
- `MapDataService`
  - Viewport + bbox loading.
  - Debounce, cancellation, request dedupe.
  - Exposes `requestPan` to center the map.

- `SearchService`
  - Builds `POST /api/search` from the viewport.

- `AreaSuggestService`
  - Search area autocomplete via `GET /api/areas/suggest`.

- `GeocodeService`
  - Address autocomplete via `POST /api/geocode`.

- `TravelMatrixService`
  - Calls `POST /api/travel-matrix` when options are enabled.

- `TravelRouteService`
  - Calls `GET /api/route` for the detail route.

- `SelectionService`
  - Tracks selected city.

- `CityDetailsService`
  - Fetches details for `/cities/:id`.

### UI/UX specifics
Search area:
- Autocomplete triggers from 3 chars (or 2 if numeric).
- Suggestions show a badge: Commune / Department / Region / Postal code.
- Selection pans the map.
- Search uses viewport bbox only (no keyword filter).

Travel options:
- Day/time selectors produce a `timeBucket`.
- Destination can be:
  - lat,lng directly
  - address resolved by geocode
- Table shows travel time per zone.
- Route is shown on the map + detail panel.

## 4) Shared types (packages/core)

Zod schemas:
- `SearchRequestSchema`
- `GeocodeRequestSchema`
- `TravelMatrixRequestSchema`
- `RouteQuerySchema`
- `AreaSuggestQuery`

DTO/Types:
- `GeocodeRequest`, `GeocodeResponse`, `GeocodeCandidate`
- `TravelMatrixResult`, `TravelMode`, `TimeBucket`

## 5) Data (DB)

Tables used:
- `commune` (lat/lon required for map)
- `department`, `region`
- `commune_postal_code`
- `cache_store`

## 6) Data flow summary

Search area:
`AppComponent` -> `AreaSuggestService` -> `GET /api/areas/suggest` -> DB -> suggestions -> UI

Search:
`AppComponent` -> `SearchService` -> `POST /api/search` -> DB -> results -> map + table

Travel:
`AppComponent` -> `GeocodeService` -> `POST /api/geocode` (Photon) -> destination
`TravelMatrixService` -> `POST /api/travel-matrix` (OSRM + cache)
`TravelRouteService` -> `GET /api/route` (OSRM + cache) -> polyline
