# City Search + Travel-Time Ranking (Host-Agnostic Spec)

**Statut** : Draft  
**Implémentation** : Non commencée

## 1) Scope

This feature lets users search and compare zones with multiple criteria and optionally include travel time to a destination.

Travel time inputs

- Destination address, geocoded to latitude and longitude
- Mode: car or transit
- Arrive-by time bucket, default Monday 08:30 Europe/Paris

Outputs

- A sortable table and a map with labels
- Clicking a zone opens a details panel and draws the real route polyline

This spec is hosting-agnostic. Adapters (CacheStore and TravelProvider) isolate
infra-specific code so the API contracts stay stable across hosts.

## 2) Core UX

### 2.1 Search form

Required

- Search area (e.g. around a city, department, region) and/or a bounding box
- Filters and scoring criteria (these become table columns)

Optional: Travel toggle

- Destination address input
- Mode selector: car, transit
- Arrive-by selector (day + time)
  - Default: Monday 08:30 Europe/Paris
  - Internally stored as a time bucket

### 2.2 Results layout

- Left: table view
- Right: map view

Table

- Each row is a zone
- Columns include zone name, travel duration (if enabled), and other criteria columns
- Sorting is available on any column, with travel duration as a key sort when enabled

Map

- Shows zone markers or polygons
- Labels summarise the main outcomes, including travel time when enabled
- Avoid clutter by limiting labels to top N results and visible viewport

Interaction

- Click a row or map item
  - Select zone
  - Open details panel
  - Draw route polyline for the selected zone

## 3) Travel time approach

We use two speeds

1) Estimated travel time for ranking and table display

- Uses a single representative origin point per zone
- Uses a matrix API to compute many origins to one destination in batches

2) Real route polyline for selected zone

- Uses a directions API for one origin to the destination

### 3.1 Representative origin point

Per zone, store one or more origin points

- centroid: lat, lng
- optional poiHub: e.g. main station or city center

Default origin choice

- car: centroid
- transit: poiHub if available else centroid

Rule: the origin point used for the estimate must match the origin point used for
the selected route, to prevent user distrust.

### 3.2 Time bucket

The system always uses a time bucket for transit.

Format

- mon_08:30, tue_18:00, etc.
- Bucket granularity: 15 minutes

Conversion

- For providers that require a concrete timestamp, convert the bucket to the next
  occurrence in Europe/Paris
- Cache keys must use the bucket, not the computed timestamp
- For car, timeBucket is still included in cache keys (use a fixed value like "none"
  if the client does not provide one)

## 4) Data model

### 4.1 Zone

- id: string
- name: string
- type: city or district
- centroid: { lat: number, lng: number }
- poiHub optional: { lat: number, lng: number, label: string }
- geometry optional: polygon or bounds
- attributes: dictionary of criteria values

### 4.2 Search request

- area: search area descriptor
- filters: key value constraints
- sort: column and direction
- pagination: limit, offset
- travel optional
  - enabled: boolean
  - destinationAddress: string
  - destination: { lat, lng }
  - mode: car or transit
  - timeBucket: string

### 4.3 Search result row

- zoneId
- zoneName
- attributes: criteria values for columns
- travel optional
  - distance_m
  - duration_s
  - status: OK or NO_ROUTE

### 4.4 Route detail

- origin: { lat, lng, label }
- destination: { lat, lng, label }
- mode
- timeBucket
- distance_m
- duration_s
- geometry
  - polyline string or GeoJSON LineString
- optional transitDetails
  - transfers count
  - walkSeconds
  - waitSeconds
  - segments

## 5) API contracts

Endpoints are host-agnostic. The reference implementation for this repo uses
Fastify + PostgreSQL, but the contracts do not change across hosts.

### 5.1 POST /api/search

Purpose

- Return zones matching non travel criteria

Input

- search area, filters, sort, pagination
- travel may be present, but this endpoint should not block on travel computation

Output

- items: ZoneResultRow without travel, or with travel set to null
- meta: total, limit, offset

### 5.2 POST /api/travel/matrix

Purpose

- Enrich a set of zones with travel duration and distance

Input

- destination: { lat, lng }
- mode: car or transit
- timeBucket: required for transit, optional for car
- origins: array of { zoneId, lat, lng }

Output

- results: array of { zoneId, duration_s, distance_m, status }

Batching

- provider limits vary, so batch origins in chunks of 25 to 50

### 5.3 GET /api/route

Purpose

- Compute the real route geometry for the selected zone

Query

- origin: lat,lng
- destination: lat,lng
- mode: car or transit
- timeBucket: required for transit

Output

- Route detail including geometry

### 5.4 POST /api/geocode

Purpose

- Resolve a destination address near the current search area

Input

- query: string
- near: { lat, lng } optional
- bbox: { minLon, minLat, maxLon, maxLat } optional
- limit: number (1..10)

Output

- candidates: [{ label, lat, lng, score?, source? }]

Notes

- Always bias using near and bbox when available.
- Cache responses for up to 90 days.

## 6) Adapter interfaces

Adapters isolate infrastructure choices while preserving contracts.

### 6.1 CacheStore

Used for read-through caching of matrix and route results.

TypeScript shape

- get(key): Promise<string | null>
- set(key, value, ttlSeconds): Promise<void>

Notes

- Values are stored as serialized JSON (caller owns encoding/decoding).
- Expiration is enforced by the store or by comparing expiresAt in the value.

### 6.2 TravelProvider

Provides travel time estimates and route geometry.

TypeScript shape

- matrixCar(origins, destination): Promise<MatrixResult[]>
- matrixTransit(origins, destination, arriveByIso): Promise<MatrixResult[]>
- routeCar(origin, destination): Promise<RouteResult>
- routeTransit(origin, destination, arriveByIso): Promise<RouteResult>

MatrixResult

- zoneId
- duration_s
- distance_m
- status: OK | NO_ROUTE | ERROR

RouteResult

- duration_s
- distance_m
- status: OK | NO_ROUTE | ERROR
- geometry (polyline or GeoJSON LineString)
- optional transit details

## 7) Caching

### 7.1 Travel time cache

Key

- tt:v1:mode:zoneId:destGeohash6:timeBucket

Notes

- destGeohash6 should be derived from destination for stability
- For car, timeBucket can be fixed (e.g. "none") if omitted

TTL

- car: 30 days
- transit: 7 days

### 7.2 Route cache

Key

- route:v1:mode:originKey:destGeohash6:timeBucket

TTL

- car: 30 days
- transit: 7 days

## 8) Reference implementation (this repo)

This repo uses Fastify + PostgreSQL (Kysely) and Angular 20.

### 8.1 CacheStore (Postgres)

Implement CacheStore with a Postgres table for each cache domain, or a shared table
with a type discriminator.

Recommended columns

- key text primary key
- value jsonb
- expiresAt timestamptz not null
- createdAt timestamptz not null default now()
- updatedAt timestamptz not null default now()

Indexes

- expiresAt for cleanup jobs

### 8.2 TravelProvider

Provide a reference adapter (e.g. OSRM, OpenRouteService, or internal provider)
behind the TravelProvider interface.

### 8.3 GeocodeProvider

Use a provider adapter (e.g. Photon) behind GeocodeProvider.
Configure the base URL via env var (e.g. GEOCODE_BASE_URL).

### 8.4 API

- Fastify endpoints under apps/api
- Validation with Zod in packages/core
- Errors follow API_CONTRACT.md

## 9) Observability

- Structured logs with requestId
- Include cache hit rate and provider latency
- Do not log PII from destination address

## 10) MVP defaults

- Bucket granularity: 15 min
- Default arrive-by: Monday 08:30 Europe/Paris
- Origin selection
  - car: centroid
  - transit: poiHub if present else centroid
- Labels on map: top 50

## 11) Portability

To port to a different host (Workers/KV, serverless, etc.), implement:

- CacheStore adapter for the host cache
- TravelProvider adapter for the chosen routing vendor

API contracts and UI do not change.
