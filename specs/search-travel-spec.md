# App-urbaine — City Search + Travel-Time Ranking (spec.md)

## 1) Scope

This feature lets users search and compare zones with multiple criteria and optionally include travel time to a destination.

Travel time inputs

- Destination address, geocoded to latitude and longitude
- Mode: car or transit
- Arrive-by time bucket, default Monday 08:30 Europe/Paris

Outputs

- A sortable table and a map with labels
- Clicking a zone opens a details panel and draws the real route polyline

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

1) Real route polyline for selected zone

- Uses a directions API for one origin to the destination

### 3.1 Representative origin point

Per zone, store one or more origin points

- centroid: lat, lng
- optional poiHub: e.g. main station or city center

Default origin choice

- car: centroid
- transit: poiHub if available else centroid

Rule: the origin point used for the estimate must match the origin point used for the selected route, to prevent user distrust

### 3.2 Time bucket

The system always uses a time bucket for transit

Format

- mon_08:30, tue_18:00, etc.
- Bucket granularity: 15 minutes

Conversion

- For providers that require a concrete timestamp, convert the bucket to the next occurrence in Europe/Paris
- Cache keys must use the bucket, not the computed timestamp

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
- pagination: page, pageSize
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

All endpoints should be hosted behind Cloudflare Workers

### 5.1 POST /api/search

Purpose

- Return zones matching non travel criteria

Input

- search area, filters, sort, pagination
- travel may be present, but this endpoint should not block on travel computation

Output

- items: ZoneResultRow without travel, or with travel set to null
- meta: total, page, pageSize

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

## 6) Caching

### 6.1 Travel time cache

Key

- tt:v1:mode:zoneId:destGeohash6:timeBucket

Notes

- destGeohash6 should be derived from destination, providing stability and high cache hit rate
- For car, timeBucket can be fixed to a constant value e.g. none

TTL

- car: 30 days
- transit: 7 days

Storage

- Cloudflare KV is recommended for simple lookup cache
- D1 optional for analytics and debugging

### 6.2 Route cache

Key

- route:v1:mode:originKey:destGeohash6:timeBucket

TTL

- car: 30 days
- transit: 7 days

## 7) Frontend behaviour

### 7.1 Travel toggle behaviour

- When travel is enabled
  - Geocode destination
  - Request /api/travel/matrix for the current candidate set
  - Populate travel column and resort

### 7.2 Progressive enrichment

- Show table results immediately
- Travel values start as loading state
- Update rows when matrix results arrive

### 7.3 Sorting

- Default when travel enabled: duration ascending
- If no route, push to bottom

### 7.4 Map label strategy

- Avoid labeling every zone
- Suggested defaults
  - Show labels for top 50 results plus selected zone
  - Also show labels for currently visible viewport when zoomed in

### 7.5 Selection

- Clicking a zone triggers /api/route
- Draw polyline and show details panel

## 8) Edge cases

- Destination geocode fails
  - Show form validation error and disable travel
- Transit route not available
  - status NO_ROUTE, display in table and filterable
- API rate limits
  - Use batching, caching, and exponential backoff
- Very large result sets
  - Use pagination, and compute travel per page or for top N

## 9) Non functional requirements

- Use structured logs with request ids for travel calls
- Keep provider keys secret server side
- Ensure deterministic bucketing and cache keys

## 10) MVP defaults

- Bucket granularity: 15 min
- Default arrive-by: Monday 08:30 Europe/Paris
- Origin selection
  - car: centroid
  - transit: poiHub if present else centroid
- Labels on map: top 50
