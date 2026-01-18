# tasks.md - Implementation Checklist (Host-Agnostic)

This file is an actionable task list to implement the "Search + Travel Time (Car/Transit) + Route Polyline on Click" feature.
Keep PRs small. Prefer 1 PR per task group. Every PR must include:

- tests (unit or contract where relevant)
- type-safety (no `any` leaks)
- basic error handling + user-friendly messages
- docs updated if public API changes

---

## Conventions

### Terms

- Zone: city / district / neighborhood returned by search.
- Origin point: poiHub (preferred for transit if available) else centroid.
- Destination: geocoded user address.
- Time bucket: mon_08:30 (Europe/Paris), rounded to 15 min steps.

### Cache keys (canonical)

- Travel time (matrix) key: `tt:v1:{mode}:{zoneId}:{destGeohash6}:{timeBucket}`
- Route (polyline) key: `route:v1:{mode}:{originKey}:{destGeohash6}:{timeBucket}`

### Response status enum

- OK
- NO_ROUTE
- ERROR

---

## 0) Repo Setup & Data Model

### 0.1 Add/validate Zone schema

- [ ] Define/confirm Zone (shared types if you have a shared package):
  - [ ] id: string
  - [ ] name: string
  - [ ] type: "city" | "district" | "neighborhood" | string
  - [ ] centroid: { lat: number; lng: number }
  - [ ] poiHub?: { lat: number; lng: number; label?: string; kind?: "station" | "downtown" | string }
  - [ ] attributes: Record<string, number | string | boolean | null>
- [ ] Ensure every zone has a valid centroid.
- [ ] (Optional, transit) Populate poiHub for major cities if dataset allows.

Acceptance criteria

- Zone can be serialized to JSON and used by both API and web.
- Minimum: centroid exists and is within expected bounds.

### 0.2 Add geohash utility (destGeohash6)

- [ ] Implement toGeohash6(lat,lng) or "rounded grid" (~1km) helper.
- [ ] Unit test: stable output for same input; different for clearly different inputs.

---

## 1) Shared - Time Bucket Logic

### 1.1 Implement time bucket parsing & rounding

- [ ] Define TimeBucket format: {dow}_{HH}:{MM} with MM in {00,15,30,45}
- [ ] Functions:
  - [ ] normalizeBucket(input: string): TimeBucket (validates + rounds if needed)
  - [ ] defaultBucket(): TimeBucket returns mon_08:30
  - [ ] bucketToNextDateTime(bucket, now, tz="Europe/Paris"): ISOString
    - next occurrence of the bucket in the user TZ
- [ ] Unit tests:
  - [ ] Rounding behavior
  - [ ] Next occurrence logic

Acceptance criteria

- Given any valid TimeBucket, you can compute a concrete timestamp for providers that require it.

---

## 2) Host-Agnostic Adapters

### 2.1 Add CacheStore interface (shared)

- [ ] Create interface CacheStore in shared types (packages/core is preferred):
  - [ ] get(key): Promise<string | null>
  - [ ] set(key, value, ttlSeconds): Promise<void>
- [ ] Pure helper for cache key building (matrix + route).

Acceptance criteria

- No infrastructure-specific code in the interface or helpers.

### 2.2 Add TravelProvider interface (shared)

- [ ] Create interface TravelProvider:
  - [ ] matrixCar(origins, destination): Promise<MatrixResult[]>
  - [ ] matrixTransit(origins, destination, arriveByIso): Promise<MatrixResult[]>
  - [ ] routeCar(origin, destination): Promise<RouteResult>
  - [ ] routeTransit(origin, destination, arriveByIso): Promise<RouteResult>
- [ ] Provide a stub/mock provider for tests.

Acceptance criteria

- Worker/service code uses provider through adapter (easy to swap later).

### 2.3 Reference CacheStore implementation (Postgres)

- [ ] Add a Kysely migration in packages/db:
  - [ ] travel_time_cache table (or shared cache table)
  - [ ] key text primary key
  - [ ] value jsonb
  - [ ] expiresAt timestamptz not null
  - [ ] createdAt/updatedAt default now()
  - [ ] index on expiresAt
- [ ] Implement CacheStore in apps/api using Kysely.
- [ ] Add basic cleanup helper (optional): delete expired rows.

Acceptance criteria

- CacheStore set/get honors TTL and does not return expired values.

---

## 3) API - Search (no travel)

### 3.1 Implement POST /api/search

- [ ] Create endpoint handler
- [ ] Request DTO:
  - [ ] area (shape depends on your app: bbox, admin code, radius)
  - [ ] filters (criteria)
  - [ ] sort (criteria key)
  - [ ] limit, offset
- [ ] Response DTO:
  - [ ] items: ZoneResult[] (zone + attributes)
  - [ ] meta: { limit, offset, total }
- [ ] Validate input (zod or equivalent)
- [ ] Add basic pagination

Acceptance criteria

- Search returns deterministic results and pagination works.
- Works without travel enabled.

### 3.2 Contract tests for /api/search

- [ ] Add minimal contract test using local server environment.
- [ ] Assert schema + pagination behaviors.

---

## 4) API - Travel Time Matrix (estimation)

### 4.1 Implement POST /api/travel/matrix

- [ ] Request DTO:
  - [ ] mode: "car" | "transit"
  - [ ] destination: { lat, lng }
  - [ ] timeBucket: TimeBucket
  - [ ] origins: { zoneId, lat, lng }[]
- [ ] Response DTO:
  - [ ] mode, timeBucket, results: { zoneId, duration_s?, distance_m?, status }[]
- [ ] Input validation + max origins limit (server-side):
  - [ ] e.g. reject > 1000 origins (front should page anyway)
- [ ] Batching:
  - [ ] chunk origins by 25-50 per provider call
- [ ] Cache (CacheStore):
  - [ ] read-through cache per origin (not per batch)
  - [ ] write with TTL: car=30d, transit=7d
  - [ ] if timeBucket missing for car, use "none" for cache keys
- [ ] Return results in same order as input or keyed by zoneId (document it)

Acceptance criteria

- Given 200 origins, endpoint returns durations for most within reasonable time.
- Cache hit rate improves on repeated calls.

### 4.2 Unit tests for caching + batching

- [ ] Test cache key composition
- [ ] Test "some cached, some not" behavior
- [ ] Test batching chunk size logic

### 4.3 API - Geocode (address to lat/lng)

- [ ] Implement POST /api/geocode
- [ ] Request DTO: { query, near?, bbox?, limit? }
- [ ] Response DTO: { candidates: [{ label, lat, lng, score?, source? }] }
- [ ] Validate input (query length <= 200, limit 1..10)
- [ ] Use CacheStore with TTL 90 days
- [ ] Bias results with near + bbox when present
- [ ] Add contract tests for schema + cache hit

---

## 5) API - Route (polyline on click)

### 5.1 Implement GET /api/route

- [ ] Query params:
  - [ ] mode=car|transit
  - [ ] zoneId=...
  - [ ] originLatLng=... (optional if server resolves from zoneId)
  - [ ] dest=lat,lng
  - [ ] timeBucket=... (required for transit)
- [ ] Server resolves origin point:
  - [ ] prefer poiHub for transit if available else centroid
- [ ] Response DTO:
  - [ ] zoneId, origin, destination, mode, timeBucket
  - [ ] duration_s, distance_m, status
  - [ ] geometry (GeoJSON LineString or encoded polyline)
  - [ ] (Optional transit) segments: walk + transit legs
- [ ] Cache (CacheStore):
  - [ ] use route cache key
  - [ ] TTL: car=30d, transit=7d

Acceptance criteria

- Clicking a zone returns a drawable polyline and consistent duration/distance.

### 5.2 Contract tests for /api/route

- [ ] Validate schema
- [ ] Validate NO_ROUTE behavior

---

## 6) Web - Search UI + Results Table + Map

### 6.1 Search form (criteria only)

- [ ] Form skeleton
- [ ] Submit triggers /api/search
- [ ] Store searchQuery in state
- [ ] Render results table (name + criteria columns)

Acceptance criteria

- Search produces a table and map markers for the returned zones.

### 6.2 Add "Travel" option panel

- [ ] Toggle: enable travel
- [ ] Destination input:
  - [ ] address autocomplete or plain input + "Search"
  - [ ] geocode to destLatLng
- [ ] Mode selector: car / transit
- [ ] Arrive-by selector:
  - [ ] default bucket mon_08:30
  - [ ] optional custom day+time -> bucket

Acceptance criteria

- User can enable travel, set destination, choose mode, choose arrive-by.

### 6.3 Travel enrichment (matrix) + sorting

- [ ] After destination resolved and results loaded:
  - [ ] call /api/travel/matrix for the current page (or top N)
  - [ ] merge duration_s into table rows
- [ ] Default sort by duration_s when travel enabled
- [ ] Handle statuses:
  - [ ] show "--" when NO_ROUTE
  - [ ] show error tooltip when ERROR

Acceptance criteria

- Table sorts by travel time and updates progressively.

### 6.4 Map labels and selection

- [ ] Display map markers/polygons for zones
- [ ] Show label snippet:
  - [ ] "{duration} - {topCriteriaSummary}"
- [ ] Limit label density:
  - [ ] show labels for top 50 + selected + hovered (optional)
- [ ] Click on zone or table row:
  - [ ] sets selectedZoneId
  - [ ] fetches /api/route
  - [ ] draws polyline

Acceptance criteria

- Selecting a zone draws a route polyline.

### 6.5 Details panel

- [ ] Panel shows:
  - [ ] zone name
  - [ ] travel duration/distance
  - [ ] origin label
  - [ ] criteria breakdown (same columns as table)
- [ ] Transit (optional v1):
  - [ ] display number of transfers + legs (if provided)

Acceptance criteria

- Panel is consistent whether selected from table or map.

---

## 7) Performance & Safety

### 7.1 Progressive loading strategy

- [ ] Only request matrix for:
  - [ ] current page of results OR
  - [ ] top N candidates (e.g. 200)
- [ ] Cancel/ignore stale requests when:
  - [ ] destination changes
  - [ ] mode changes
  - [ ] timeBucket changes
- [ ] Debounce destination geocode

Acceptance criteria

- Fast UI response; no request storms.

### 7.2 Rate limit & graceful degradation

- [ ] API returns 429 friendly body when provider rate limits
- [ ] UI shows "Service temporarily unavailable" and keeps non-travel results visible
- [ ] Implement basic retry with backoff (max 1 retry) on transient 5xx

Acceptance criteria

- App remains usable even if travel provider fails.

---

## 8) Observability & QA

### 8.1 Logging & metrics (server)

- [ ] Structured logs include:
  - [ ] requestId
  - [ ] mode
  - [ ] timeBucket
  - [ ] originsCount
  - [ ] cacheHitCount
  - [ ] providerLatencyMs
- [ ] (Optional) lightweight metrics counters

Acceptance criteria

- You can debug performance and cache effectiveness.

### 8.2 End-to-end test script (manual checklist)

- [ ] Search with travel disabled => table + map OK
- [ ] Enable travel, set destination, car => times populate and sort
- [ ] Switch to transit => times change (bucket applied)
- [ ] Change arrive-by => times refresh
- [ ] Click zone => polyline + panel OK
- [ ] NO_ROUTE zone => shown at bottom, click shows message not crash

---

## 9) Documentation

### 9.1 Update spec references

- [ ] Ensure endpoints and DTOs match implementation
- [ ] Add provider configuration notes (env vars)

### 9.2 Add ENV.md (optional but recommended)

- [ ] Required env vars for travel provider
- [ ] Required env vars for geocode provider (base URL)
- [ ] Local dev instructions
- [ ] How to rotate keys

---

## Suggested PR slicing

- PR0: Host-agnostic spec + tasks update
- PR1: Zone schema + geohash utility + time bucket utils + tests
- PR2: CacheStore + TravelProvider interfaces + Postgres cache table
- PR3: /api/search + contract tests
- PR4: /api/travel/matrix + cache + batching + tests (mock provider)
- PR5: Web search form + table + map (no travel)
- PR6: Web travel option + matrix enrichment + sorting
- PR7: /api/route + web selection + polyline + details panel
- PR8: Perf (paging/progressive) + logs + error handling polish
