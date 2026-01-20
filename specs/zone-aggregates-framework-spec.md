# Zone Aggregates Framework Spec
Status: Draft  
Owner: Product/Tech  
Last updated: 2026-01-20

## 1. Purpose
Provide a **generic, extensible, and decoupled** framework to compute and expose **Zone-level aggregates** (rent, safety, politics, air quality, schools, etc.) end-to-end:

- **Ingest** base-geo data (commune/IRIS/etc.)
- **Normalize** and validate
- **Compute** Zone aggregates using a common zone→geo weighting mapping
- **Store** computed results (idempotent upserts)
- **Expose** via API (single + batch)
- **Render** in the web UI (generic cards)

Key constraint:
> **Zero coupling between aggregates**.  
> Aggregates are implemented as independent plugins that only depend on shared interfaces/types.

This spec is **stack-agnostic** (but aligned with the current monorepo layout).

---

## 2. Non-goals
- Real-time or streaming computations (V1)
- ML/forecasting models (future)
- Per-user personalization (future)
- Any aggregate that enables wrongdoing (must be reviewed case-by-case)

---

## 3. Definitions
- **Zone**: app-defined geographic unit for displaying results and computing scores.
- **Base geography**: unit for which raw metrics are available (COMMUNE, IRIS, EPCI, DEPARTMENT…).
- **Aggregate**: a derived Zone-level value (e.g., median rent €/m²).
- **Plugin**: an aggregate module implementing a shared interface and registering itself.
- **Params**: validated query parameters that determine which variant is requested (year, segmentKey, metricKey…).
- **Coverage**: [0..1] measure of how much of the Zone is represented by base-geo data used in compute.

---

## 4. Architectural Principles (non-negotiable)
1. **Decoupling**
   - No aggregate imports another aggregate.
   - All shared logic lives in the framework package (core types, registry, hashing, persistence adapters).

2. **Idempotency**
   - Re-running compute must be safe.
   - Computed outputs keyed by (zoneId, aggregateId, periodYear, paramsHash).

3. **Determinism**
   - Same inputs → same outputs.
   - Avoid request-time randomness.

4. **Runtime validation**
   - Params and outputs are validated with schemas (e.g., Zod).
   - Invalid inputs fail fast with structured errors.

5. **Traceability**
   - Store `source`, `sourceVersion`, and `computedAt` for every result.

6. **Generic UI**
   - UI renders generic “aggregate cards” driven by metadata (labels/units) and a light formatting adapter.
   - No hardcoded aggregate-specific UI components required.

---

## 5. Versioning Strategy
### 5.1 Aggregate IDs
Each aggregate is identified by a stable string:
- Format: `"<name>.v<major>"` (e.g., `rent.v1`, `safety.v1`).

A major version bump indicates a breaking change in:
- interpretation
- output schema
- compute method

### 5.2 Params hashing
Results must be keyed by a stable `paramsHash`:
- canonical JSON stringify of validated params
- cryptographic hash (e.g., sha256)
- same params always produce same hash

---

## 6. Data Model (logical)
### 6.1 Generic Zone aggregate storage
**ZoneAggregateRecord**
- `zoneId`: string
- `aggregateId`: string
- `periodYear`: int
- `paramsHash`: string
- `coverage`: number (0..1)
- `source`: string
- `sourceVersion`: string
- `computedAt`: datetime
- `payloadJson`: JSON (aggregate-specific, validated)
- PRIMARY KEY: (`zoneId`, `aggregateId`, `periodYear`, `paramsHash`)

### 6.2 Optional generic base-geo storage (recommended)
Stores normalized base-geo values for plugins to read.
**GeoAggregateValue**
- `aggregateId`: string
- `periodYear`: int
- `geoLevel`: enum
- `geoCode`: string
- `paramsHash`: string
- `payloadJson`: JSON
- PRIMARY KEY: (`aggregateId`, `periodYear`, `geoLevel`, `geoCode`, `paramsHash`)

---

## 7. Plugin Contract (logical)
Each aggregate plugin provides:

### 7.1 Metadata
- `id`: aggregateId
- `version`: major version number
- `display`: label/unit/category (for UI)

### 7.2 Schemas
- `paramsSchema`: validates query params (includes `periodYear` or `year`)
- `outputSchema`: validates payload

### 7.3 Compute function
`compute(ctx) -> { base, payload }`

**ctx inputs (minimum):**
- `zoneId`
- `periodYear`
- `params` (validated)
- `zoneGeoWeights`: list of { geoCode, weight, geoLevel? }
- `geoStore`: read adapter to retrieve GeoAggregateValue(s) relevant to the plugin
- `logger`

---

## 8. Core Service Responsibilities
### 8.1 Registry
- register(plugin)
- get(aggregateId)
- list()

### 8.2 Aggregates service (read-through cache)
`getAggregate(zoneId, aggregateId, params)`
- Validate aggregateId exists
- Validate params
- Compute paramsHash
- Lookup ZoneAggregateRecord
- If found: return (base + payload)
- Else:
  - Load zoneGeoWeights (mapper)
  - Let plugin compute result
  - Validate payload with outputSchema
  - Upsert ZoneAggregateRecord
  - Return result

`getMany(zoneId, requests[])`
- Executes multiple plugin requests
- Returns partial successes + per-request errors

---

## 9. Zone → Geo Weight Mapping
Framework must define a single generic method to retrieve the mapping:
- `zoneId -> (geoCode, weight, geoLevel)[]`

V1 acceptable implementations:
- A simple `zone_geo_map` table storing weights
- Or a deterministic method based on existing commune data

Weights:
- Prefer population-based weights where possible
- Area overlap weighting is a fallback

---

## 10. API Contract (logical)
### 10.1 Single aggregate
`GET /api/zones/:zoneId/aggregates/:aggregateId?year=YYYY&...`

Returns:
```json
{
  "base": {
    "zoneId": "z1",
    "aggregateId": "rent.v1",
    "periodYear": 2023,
    "coverage": 0.82,
    "source": "PUBLIC_DATASET_X",
    "sourceVersion": "2023-11",
    "computedAt": "2026-01-20T10:00:00Z"
  },
  "payload": { }
}
```

### 10.2 Batch
`POST /api/zones/:zoneId/aggregates:batch`
Body:
```json
{ "requests": [ { "aggregateId": "rent.v1", "params": { "year": 2023 } } ] }
```

Returns:
- `results[]` and `errors[]` (no total failure unless request is invalid)

### 10.3 “Special aggregates”
Optional alias for a curated set of default aggregates (later):
`GET /api/zones/:zoneId/special-aggregates?year=YYYY`

---

## 11. Web UI Requirements
- Introduce a generic “Zone Aggregates” feature:
  - API client
  - state store (optional)
  - generic card component
- Formatting layer:
  - given aggregateId + payload, produce strings/badges
  - keep aggregate formatting minimal and centralized

---

## 12. V1 Scope
V1 implements the **framework + one aggregate plugin only** (to validate architecture).
Recommended first aggregate: **Rent (rent.v1)**, because:
- simple computation (weighted average)
- stable units (€/m²)
- minimal ethical risks

V1 includes:
- registry + service
- generic DB tables + access functions
- API endpoints (single + batch)
- Web UI: one generic card showing rent aggregate
- Fixture-based geo values ingestion for dev

---

## 13. Acceptance Criteria (V1)
- A new aggregate plugin can be added by:
  1) implementing the plugin interface
  2) registering it in exactly one place
  3) (optionally) providing fixtures for geo values
- Existing plugin code remains unchanged when adding new plugins.
- API can return the rent aggregate for a given zoneId/year.
- Web renders the rent aggregate card.
- Coverage is computed and displayed.
- Idempotent re-run: computing twice yields one stored record (same key).

---

## 14. Open Questions
- Where will zone→geo weights come from in V1 (table vs computed)?
- What is the global convention for “no data” (404 vs null payload)?
- Do we store payloadJson as JSONB or text (DB choice)?
