# Zone Rent Aggregate Spec
Status: Draft  
Owner: Product/Tech  
Last updated: 2026-01-20

## 1. Purpose
Add a **“rent price” aggregate** to each *Zone* so users can compare areas by expected rental cost and use it in ranking/scoring.

This spec is **stack-agnostic** and defines:
- Data sources and constraints
- Import + normalization pipeline
- Aggregation rules from base geography → Zone
- Storage, API contract, UI display expectations
- Version plan (V1 / V2 / V3+)

---

## 2. Definitions
- **Zone**: A geographic unit used by the app to display results and compute scores (custom zoning).
- **Base geography**: Administrative/statistical unit for which rent data exists (e.g., **Commune**, **IRIS**, **EPCI**, etc.).
- **Rent metric**: A numeric estimate of rental price level, preferably in **€/m²**.
- **Aggregate**: A derived value stored for a Zone (e.g., median rent €/m² for the Zone).

---

## 3. Product Requirements
### 3.1 User value
Users must be able to:
- See an estimated rent level for a Zone (€/m²).
- Compare Zones quickly (cheaper ↔ more expensive).
- Understand the **source** and **date** of the data.

### 3.2 Non-goals (V1)
- Real-time rent estimation from listings
- Address-level / building-level rent predictions
- Complex modeling (ML), seasonality, “current month” pricing

---

## 4. Data Sources
### 4.1 Source principles (must)
- **Legal to use** (open data or licensed for use)
- **Nationwide coverage** preferred
- **Stable identifiers** (INSEE codes / IRIS codes)
- **Documented update cadence** (usually annual)

### 4.2 Source candidates
- **Primary (recommended for V1)**: Public national rent datasets published by official bodies and distributed via open data portals.
  - Typical granularity: Commune and/or IRIS depending on availability.
  - Typical metrics: median rent €/m² and sometimes distribution quantiles.

- **Secondary (V2+)**: Local observatories (OLL) and other regional sources
  - Pros: more granular, sometimes more recent
  - Cons: partial coverage and heterogeneous formats

### 4.3 Compliance requirements
- Store the **source name**, **source version/date**, and **license reference** (or dataset identifier).
- Display a **disclaimer** in UI (e.g., “estimate from public data, year YYYY”).

---

## 5. Data Model (logical)
### 5.1 Raw ingestion table (immutable)
Stores each record from the source with minimal transformation.

**RentRaw**
- `source`: string (e.g., "PUBLIC_INSEE_DATASET_X")
- `sourceVersion`: string (e.g., "2023-11" or dataset release id)
- `periodYear`: int (e.g., 2023)
- `geoLevel`: enum ("COMMUNE" | "IRIS" | "EPCI" | "OTHER")
- `geoCode`: string (e.g., INSEE commune code, IRIS code)
- `rentMedianPerM2`: number
- `rentP25PerM2?`: number
- `rentP75PerM2?`: number
- `housingType?`: enum ("APT" | "HOUSE" | "ALL")
- `furnishing?`: enum ("FURNISHED" | "UNFURNISHED" | "ALL")
- `currency`: "EUR"
- `unit`: "EUR_PER_M2"
- `ingestedAt`: datetime
- `rawPayload`: json/text (optional, for traceability)

### 5.2 Normalized base-geo table (optional but recommended)
A cleaned, deduplicated set keyed by `(periodYear, geoLevel, geoCode, segment)`.

**RentGeo**
- `periodYear`
- `geoLevel`
- `geoCode`
- `segmentKey`: string (e.g., "ALL_ALL" or "APT_UNFURNISHED")
- `rentMedianPerM2`
- `rentP25PerM2?`
- `rentP75PerM2?`
- `source`
- `sourceVersion`
- `computedAt`

### 5.3 Zone aggregate table
The data actually used by the app.

**RentZoneAggregate**
- `zoneId`: string
- `periodYear`: int
- `segmentKey`: string (V1 uses "ALL_ALL")
- `rentMedianPerM2`: number
- `rentP25PerM2?`: number
- `rentP75PerM2?`: number
- `coverage`: number (0..1) — share of zone population (or area) covered by rent data
- `source`
- `sourceVersion`
- `computedAt`

---

## 6. Aggregation Rules (base geography → Zone)
### 6.1 Inputs required
To aggregate base-geo rent values into a Zone, we need a mapping:
- `zoneId` → list of `(geoCode, weight)` tuples where weight is:
  - **Population weight** (recommended), or
  - **Area overlap weight** (fallback if population not available)

### 6.2 Default aggregation (V1)
- Metric: `rentMedianPerM2` in €/m²
- Segment: `"ALL_ALL"` (no distinction by housing type or furnishing)
- Aggregation: **weighted average of median values**
  - `zoneRent = Σ(weight_i * rentMedian_i) / Σ(weight_i)` for i in covered base geos

> Note: A true “median of medians” is not mathematically correct without distributions.
> Weighted average is acceptable for V1 as an *estimate*, but must be disclosed as such.

### 6.3 Coverage calculation
- `coverage = Σ(weight_i where rent exists) / Σ(weight_i total for zone)`
- Coverage is used to:
  - Warn the user if estimate is weak
  - Optionally down-weight the score impact

### 6.4 Fallback strategy (V1)
If a Zone has insufficient coverage:
1. Try a broader geo level (e.g., Commune → EPCI/Department/Region) if available.
2. If still missing, mark as “no data” and exclude from rent-based scoring (or use neutral score).

Thresholds (V1 defaults):
- `coverage >= 0.70`: normal
- `0.40 <= coverage < 0.70`: show “limited coverage” warning
- `coverage < 0.40`: treat as missing for scoring, show “insufficient data”

---

## 7. Import + Compute Pipeline
### 7.1 Overview
1. **Fetch** dataset files (CSV/Parquet/etc.)
2. **Ingest** into `RentRaw` (append-only)
3. **Normalize** into `RentGeo` (dedupe, clean, validate)
4. **Compute aggregates** into `RentZoneAggregate`
5. **Expose** via API to the frontend
6. **Cache** API responses as needed (optional)

### 7.2 Validation rules
- Reject records with:
  - missing `geoCode` or invalid format for its geoLevel
  - non-positive rent values
  - wrong unit/currency (must be €/m²)
- Outlier handling (V1):
  - Keep values but log warnings for extreme values (configurable thresholds)

### 7.3 Idempotency
Pipeline must be re-runnable without duplicating aggregates:
- Use `(source, sourceVersion, periodYear)` as a batch key.
- Recompute aggregates for impacted years and overwrite by `(zoneId, periodYear, segmentKey)`.

### 7.4 Caching strategy (V1)
- Aggregates are stored in DB.
- Do **not** compute on request (except temporary debugging endpoints).

---

## 8. API Contract (logical)
### 8.1 Read zone rent aggregate
`GET /api/zones/:zoneId/rent?year=YYYY&segment=ALL_ALL`

Response (200):
```json
{
  "zoneId": "string",
  "periodYear": 2023,
  "segmentKey": "ALL_ALL",
  "rentMedianPerM2": 18.4,
  "rentP25PerM2": null,
  "rentP75PerM2": null,
  "coverage": 0.82,
  "source": "PUBLIC_INSEE_DATASET_X",
  "sourceVersion": "2023-11",
  "computedAt": "2026-01-20T10:00:00Z"
}
```

If no data:
- 404 with `{ "error": "NO_RENT_DATA" }` OR 200 with `rentMedianPerM2: null` (choose one convention across the API).

### 8.2 Batch endpoint (recommended)
`POST /api/zones/rent:batch`
```json
{ "zoneIds": ["z1","z2"], "year": 2023, "segmentKey": "ALL_ALL" }
```

---

## 9. UI/UX Requirements
### 9.1 Display in Zone details panel (V1)
- Label: **“Estimated rent (€/m²)”**
- Value: `rentMedianPerM2` rounded (e.g., 18.4 → 18.4 or 18.0 depending on UI rules)
- Secondary text:
  - `Year YYYY`
  - `Source …`
  - Coverage badge if `< 0.70`

### 9.2 Sorting / scoring integration (V1)
- Add a rent dimension to ranking:
  - Lower rent = better score
  - Normalize across visible results (viewport) or across national distribution (V2+)
- If `coverage < 0.40` or missing:
  - Exclude from rent scoring OR assign neutral value

---

## 10. Version Plan
### V1 — “Nationwide baseline rent”
**Goal:** Show a reliable *estimate* of rent level per Zone for one year.

Includes:
- One primary public dataset
- Segment = `"ALL_ALL"`
- Metric = median €/m² (or equivalent available)
- Weighted average aggregation
- Coverage + warnings
- Stored aggregates in DB + API endpoints
- UI display in zone panel + optional simple scoring

Excludes:
- Housing type (apt/house)
- Furnished/unfurnished
- Multi-source blending
- Time series trends

### V2 — “Segmentation + better weighting”
Adds:
- Segments:
  - `"APT_ALL"`, `"HOUSE_ALL"`, `"ALL_FURNISHED"`, `"ALL_UNFURNISHED"` (depending on data availability)
- Better weighting:
  - population-based weighting by default
  - area-overlap weighting fallback
- Multi-year support (time series)
- Improved scoring:
  - normalization by national distribution per year/segment
- Admin tooling:
  - run pipeline per dataset version/year
  - quality reports (coverage histograms, missing zones)

### V3 — “Multi-source + local precision”
Adds:
- Integrate local observatories where available, with precedence rules:
  - if local data coverage high, override national
  - otherwise blend (weighted)
- Add uncertainty bands:
  - display p25/p75 where available
  - show “confidence” score derived from coverage + variance
- User preferences:
  - allow selecting housing type and furnishing to re-rank zones

### V4+ — “Near real-time market signal (optional)”
Potential additions:
- Licensed partner data / listing-based indicators (no scraping)
- Monthly/quarterly updates
- ML estimation per zone with uncertainty
- Alerts: “rents rising” vs “stable”

---

## 11. Acceptance Criteria (V1)
- Import pipeline loads at least one national dataset successfully.
- For a set of test Zones:
  - rent aggregate exists with `coverage` computed
  - missing-data zones handled per fallback rules
- API returns correct aggregates for known Zone IDs.
- UI displays rent metric with source + year.
- Scoring/ranking does not crash when rent data missing.

---

## 12. Open Questions
- Which exact dataset will be the V1 primary source (identifier + license)?
- Which base geography is best aligned with existing Zone mapping (Commune vs IRIS)?
- Decide 404 vs nullable payload convention for missing data.
- Confirm weighting data availability (population per geo unit).

