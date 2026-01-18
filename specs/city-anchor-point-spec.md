# Specification — City Anchor Point (User-Friendly City Marker)

## 1. Purpose

This specification defines a **stack-agnostic** method to compute and use a **City Anchor Point** (the “center users expect”)
for French communes, in order to avoid confusing marker placement caused by geometric centroids or administrative points.

**Key intent:** markers should match the “center-perceived” location commonly shown on mainstream map products (e.g., Google-like behavior),
not necessarily the mathematical centroid of the commune polygon.

This spec is designed for a POC and scales to production.

---

## 2. Inputs / Assumptions

### 2.1 Required inputs (already available in your project)
For each commune:
- `insee: string` (INSEE code)
- `name: string`
- `dept_code: string` (recommended)
- `region_code: string` (optional)
- `csv_lat: number`
- `csv_lon: number`

> Your current coordinate source is the data.gouv “communes + codes postaux” CSV.  
> These coordinates are acceptable as **fallback**, but can be “user-unfriendly” (often administrative points / centroids).

### 2.2 Optional inputs (future-friendly)
- Commune polygon geometry (if available later)
- Additional “center” datasets (chef-lieu/mairie, etc.)

### 2.3 Output data (new)
A stable anchor point per commune:
- `insee: string`
- `anchor_lat: number`
- `anchor_lon: number`
- `anchor_source: enum`
  - `OSM_PLACE_REF_INSEE`
  - `OSM_PLACE_FUZZY`
  - `POINT_ON_SURFACE` (if polygon-based later)
  - `CSV_FALLBACK`
- `confidence: number` (0–1)
- `updated_at: ISO datetime`
- Optional: `osm_type`, `osm_id`

---

## 3. City Anchor Point Policy (Priority Order)

When computing `anchor_lat/lon`, apply these rules in order.

### 3.1 Priority A — OSM “place” object matched by INSEE (best)
Use an OpenStreetMap object where:
- `place` in `{city, town, village, hamlet}` (and optionally `{suburb}` if you decide)
- `ref:INSEE == <insee>`

**Result:**
- `anchor_source = OSM_PLACE_REF_INSEE`
- `confidence = 1.0`

Rationale:
- `place=*` features are used by map renderers for labels and represent the **perceived center**.

### 3.2 Priority B — OSM “place” object matched fuzzily (fallback)
If no `ref:INSEE` match exists:
- Find the best candidate `place=*` by name + proximity checks (see section 4).

**Result:**
- `anchor_source = OSM_PLACE_FUZZY`
- `confidence = 0.6–0.9` depending on validation strength

Rationale:
- Many communes may lack `ref:INSEE` tagging on the place feature.
- Fuzzy matching can fill gaps but must be guarded by validation rules.

### 3.3 Priority C — Polygon-based point-on-surface (future option)
If commune polygons are available:
- Compute a **point-on-surface** (guaranteed inside polygon), not centroid.

**Result:**
- `anchor_source = POINT_ON_SURFACE`
- `confidence = 0.7`

Rationale:
- Better than centroid; still not as “Google-like” as `place=*`, but safe and consistent.

### 3.4 Priority D — CSV coordinate fallback (always available)
If nothing else:
- `anchor_lat/lon = csv_lat/csv_lon`

**Result:**
- `anchor_source = CSV_FALLBACK`
- `confidence = 0.3–0.5`

---

## 4. Validation Rules (Anti-Misplacement Guards)

Validation must run for any non-CSV anchor source (and especially for fuzzy matches).

### 4.1 Distance sanity check
Let `d = distance_km(anchor, csv_point)`.

- If `d > 30 km`: **reject candidate** (use next fallback)
- If `10 km < d <= 30 km`: accept only if you have strong evidence (dept/region match), else reject
- If `d <= 10 km`: generally acceptable

> Thresholds are configurable; France communes usually won’t have their expected center tens of km away.

### 4.2 Administrative area consistency (recommended)
If you have dept info:
- Candidate should be inside the expected department boundary OR
- at least not obviously outside (use a lightweight check if you have dept bbox).

### 4.3 Name matching (for fuzzy)
Normalize:
- lowercase
- remove accents
- remove punctuation/hyphens
- trim common tokens (optional): “le”, “la”, “les”, “sur”, etc.

Scoring:
- Exact match (normalized) > prefix match > token overlap
- Prefer candidates whose `place` rank is stronger:
  - city > town > village > hamlet

### 4.4 Tie-break rules (fuzzy)
If multiple candidates pass:
1. Highest name score
2. Stronger `place` category (city/town/village/hamlet)
3. Shortest distance to csv_point
4. Stable final tie-break: smallest `osm_id`

---

## 5. Runtime Usage (Map Rendering)

### 5.1 Single source of truth for marker position
Leaflet (or any map UI) must use **only**:
- `anchor_lat/lon`

Never mix with `csv_lat/lon` after anchors exist, except as fallback.

### 5.2 Filtering by zoom (already in your system)
Your existing rule “communes filtered by zoom” remains unchanged.
This spec only changes the coordinate used to place the marker.

### 5.3 Optional: Visual debugging layer (dev-only)
Provide a debug mode to render:
- `csv_point` and `anchor_point` simultaneously (different styles)
to quickly spot anomalies.

---

## 6. Data Pipeline (POC-friendly)

### 6.1 Recommended approach: precompute anchors offline
Create a build step (script/CLI) that:
1. Loads the commune CSV dataset (your current source)
2. Resolves anchor points using the policy (section 3)
3. Applies validation rules (section 4)
4. Writes `commune_anchor.csv` or `commune_anchor.json`

Your app then ships/serves this file and uses it at runtime.

### 6.2 Why offline?
- avoids runtime API rate limits (Overpass/Nominatim)
- faster map interactions
- stable and cache-friendly
- reproducible results

---

## 7. Acceptance Criteria

1. For major communes and most towns, marker appears at the “center users expect” (center/bourg), not in forests/fields.
2. No commune anchor is placed > 30 km away from the CSV fallback point.
3. Anchors are stable across sessions (same input data => same output).
4. Runtime map performance is unchanged or improved (no per-pan network calls required).

---

## 8. Configuration (Defaults)

- `max_distance_reject_km = 30`
- `max_distance_soft_km = 10`
- Place ranking: `city > town > village > hamlet`
- Default fallback confidence:
  - `OSM_PLACE_REF_INSEE = 1.0`
  - `OSM_PLACE_FUZZY = 0.6–0.9`
  - `POINT_ON_SURFACE = 0.7`
  - `CSV_FALLBACK = 0.4`

---

## 9. Notes / Future Extensions

- Add a small “manual overrides” file for edge cases:
  - `insee -> anchor_lat/lon`
- If you later introduce commune polygons, you can:
  - validate anchors are inside polygon
  - compute point-on-surface as another fallback
- If you later add address search:
  - anchors remain the reference for “go to city”.

---
