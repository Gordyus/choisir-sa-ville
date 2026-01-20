# Zone Safety (Insecurity) Index Spec
Status: Draft  
Owner: Product/Tech  
Last updated: 2026-01-20

## 1. Purpose
Add a **“safety / insecurity index”** aggregate to each *Zone* so users can:
- Compare areas by perceived / statistical safety
- Include safety as a major dimension in ranking/scoring
- Understand the **source**, **period**, and **limitations** of the indicator

This spec is **stack-agnostic** and defines:
- Data sources and constraints
- Import + normalization pipeline
- Aggregation rules from base geography → Zone
- Storage, API contract, UI display expectations
- Version plan (V1 / V2 / V3+)

---

## 2. Definitions
- **Zone**: A geographic unit used by the app to display results and compute scores.
- **Base geography**: Statistical unit for which safety/crime data exists (e.g., Commune, IRIS, Department).
- **Safety indicator**: Any measurable quantity related to crime/insecurity (counts, rates, index).
- **Insecurity index (app)**: Normalized value in **[0..100]**
  - 0 = safest
  - 100 = least safe

---

## 3. Product Requirements
### 3.1 User value
Users must be able to:
- See a safety indicator for a Zone
- Compare Zones quickly
- See period (year), source, and coverage/confidence

### 3.2 Non-goals (V1)
- Predict individual risk
- Real-time incident feeds
- Street-level or address-level crime mapping

---

## 4. Data Sources
### 4.1 Source principles
- Official or public data
- Legally reusable
- Nationwide coverage preferred
- Stable geographic identifiers (INSEE codes)

### 4.2 Source types
- Official administrative crime statistics (preferred V1)
- Victimization surveys (V2+)
- Local open data portals (V3+)

---

## 5. Data Model (logical)
### 5.1 Raw ingestion
**SafetyRaw**
- source
- sourceVersion
- periodYear
- geoLevel
- geoCode
- metricKey
- count?
- ratePer1000?
- populationRef?
- ingestedAt
- rawPayload?

### 5.2 Normalized geo-level
**SafetyGeo**
- periodYear
- geoLevel
- geoCode
- metricKey
- count?
- ratePer1000?
- source
- sourceVersion
- computedAt

### 5.3 Zone aggregate
**SafetyZoneAggregate**
- zoneId
- periodYear
- metricKey
- index0to100
- indexMethod
- ratePer1000?
- coverage
- source
- sourceVersion
- computedAt

---

## 6. Aggregation Rules
### 6.1 Base metric (V1)
- metricKey = "ALL_RECORDED"
- Prefer rate per 1,000 inhabitants
- If only counts available, compute rate using population

### 6.2 Zone aggregation
- Weighted average of rates by population or area weight

### 6.3 Index computation
- Convert zone rate to percentile rank vs national distribution
- index0to100 = round(100 * percentile_rank)

### 6.4 Coverage
- coverage = covered weight / total weight
- <0.40 = insufficient data

---

## 7. API Contract (logical)
### GET /api/zones/:zoneId/safety?year=YYYY

Response:
```json
{
  "zoneId": "string",
  "periodYear": 2023,
  "metricKey": "ALL_RECORDED",
  "index0to100": 27,
  "ratePer1000": 32.1,
  "coverage": 0.81,
  "source": "OFFICIAL_SAFETY_DATASET",
  "sourceVersion": "2024",
  "computedAt": "2026-01-20T10:00:00Z"
}
```

---

## 8. UI/UX Requirements
- Display as “Safety index” or “Insecurity index”
- Low value = safer
- Show year, source, coverage badge

---

## 9. Version Plan
### V1
- Single national dataset
- One metric (ALL_RECORDED)
- One index 0..100

### V2
- Multiple crime categories
- Time series + trends

### V3+
- Finer geography
- Multi-source blending
- Confidence score

---

## 10. Acceptance Criteria
- Zone index computed and stored
- Coverage calculated
- API returns consistent output
- UI displays indicator clearly
