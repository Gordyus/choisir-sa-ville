# Zone Political Color Index Spec

**Statut** : Draft  
**Implémentation** : Non commencée  
**Dernière révision** : 2026-01-20

## 1. Purpose
Add a **“political color / political orientation”** aggregate to each *Zone* so users can:
- Understand the **general political tendency** of an area
- Compare Zones on a neutral, descriptive basis
- Optionally include political alignment as a **filter or scoring dimension**

This spec is **stack-agnostic** and focuses on **descriptive aggregation**, not persuasion.

---

## 2. Definitions
- **Zone**: A geographic unit used by the app to display results and compute scores.
- **Base geography**: Administrative unit for which election results are available (Commune, Bureau de vote, Department).
- **Political color**: A categorical or continuous representation of dominant political orientation.
- **Political index (app)**: A normalized, descriptive indicator derived from official election results.

Important principle:
> The app **describes** past voting behavior.  
> It does **not** predict individual opinions or promote political content.

---

## 3. Product Requirements
### 3.1 User value
Users must be able to:
- See the **dominant political tendency** of a Zone.
- Understand **which election** and **which year** the data comes from.
- Interpret results visually (colors / labels) without technical knowledge.

### 3.2 Non-goals (V1)
- Predicting future election outcomes
- Profiling individuals or households
- Micro-targeting or persuasion
- Real-time political signals

---

## 4. Data Sources
### 4.1 Source principles (must)
- **Official and public election results**
- Legally reusable (open data)
- Nationwide coverage
- Stable geographic identifiers (INSEE codes, bureau IDs)

### 4.2 Source candidates
**Candidate A — National election results (preferred for V1)**
- Presidential elections
- Legislative elections
- High participation and clear political spectrum

**Candidate B — Local elections (V2+)**
- Municipal / regional elections
- More local signal, but higher variability

### 4.3 Compliance and neutrality requirements
- Store **source**, **election type**, **round**, and **year**
- UI disclaimer:
  - results are historical
  - political landscapes evolve
- No political messaging, recommendations, or persuasion

---

## 5. Political Spectrum Model
### 5.1 Political axis (V1)
V1 uses a **single left–right axis**, mapped to a numeric range:

| Value | Meaning |
|-----|--------|
| -100 | Far left dominance |
| -50 | Left |
| 0 | Center |
| +50 | Right |
| +100 | Far right dominance |

### 5.2 Party → axis mapping (configurable)
Each party/candidate is mapped to a fixed axis value.

Example (illustrative):
- Far left: -80
- Left: -40
- Center: 0
- Right: +40
- Far right: +80

Mapping must be:
- Explicit
- Documented
- Versioned

---

## 6. Data Model (logical)
### 6.1 Raw ingestion table
**PoliticalRaw**
- `source`
- `sourceVersion`
- `electionType`: enum ("PRESIDENTIAL", "LEGISLATIVE", "OTHER")
- `round`: int
- `year`: int
- `geoLevel`: enum ("COMMUNE" | "BUREAU" | "DEPARTMENT")
- `geoCode`
- `candidateOrParty`: string
- `votes`: number
- `votesPct`: number
- `ingestedAt`
- `rawPayload`

### 6.2 Normalized base-geo results
**PoliticalGeo**
- `year`
- `electionType`
- `round`
- `geoLevel`
- `geoCode`
- `candidateOrParty`
- `axisValue`
- `votesPct`
- `computedAt`

### 6.3 Zone aggregate
**PoliticalZoneAggregate**
- `zoneId`
- `year`
- `electionType`
- `round`
- `axisScore`: number (-100..100)
- `dominantColor`: string
- `dominantLabel`: string
- `turnoutPct?`
- `coverage`: number (0..1)
- `source`
- `sourceVersion`
- `computedAt`

---

## 7. Aggregation Rules
### 7.1 Base metric
For each base geography:
```
geoScore = Σ(votesPct_party * axisValue_party)
```

### 7.2 Zone aggregation
Aggregate geo scores into a Zone using population or voter-count weighting:
```
zoneScore = Σ(weight_i * geoScore_i) / Σ(weight_i)
```

### 7.3 Coverage
- Coverage based on population or registered voters covered by election data.
- Same thresholds as other aggregates:
  - ≥ 0.70: normal
  - 0.40–0.70: limited
  - < 0.40: insufficient

---

## 8. Index Interpretation
### 8.1 Labels (example)
| Axis score | Label |
|----------|------|
| ≤ -60 | Strongly left |
| -60 to -20 | Left |
| -20 to +20 | Center |
| +20 to +60 | Right |
| ≥ +60 | Strongly right |

### 8.2 Colors (example)
- Left: red
- Center: neutral / purple
- Right: blue  
(Color palette must be configurable and non-provocative.)

---

## 9. API Contract (logical)
### 9.1 Read political color for a Zone
`GET /api/zones/:zoneId/politics?year=YYYY&election=PRESIDENTIAL`

Response:
```json
{
  "zoneId": "string",
  "year": 2022,
  "electionType": "PRESIDENTIAL",
  "round": 1,
  "axisScore": -32,
  "dominantLabel": "Left",
  "dominantColor": "red",
  "coverage": 0.88,
  "source": "OFFICIAL_ELECTION_DATA",
  "computedAt": "2026-01-20T10:00:00Z"
}
```

---

## 10. UI/UX Requirements
### 10.1 Display (V1)
- Label: **“Political tendency”**
- Visual:
  - color badge or gradient bar
- Text:
  - dominant label
  - election + year
- Tooltip:
  - historical results disclaimer

### 10.2 Usage constraints
- Optional visibility (user can hide political info)
- Never used as default primary sorting
- No personalization based on political data

---

## 11. Version Plan
### V1 — “Single-axis political color”
Includes:
- One national election (presidential recommended)
- Single left–right axis
- One round (configurable)
- Zone-level aggregate with coverage
- Read-only API + UI display

### V2 — “Multiple elections & stability”
Adds:
- Legislative + presidential blending
- Stability indicator (consistency across elections)
- Turnout-based confidence

### V3 — “Temporal evolution”
Adds:
- Time series
- Trend labels (shifting left/right/center)
- Confidence decay for older elections

### V4+ — “Advanced (optional, cautious)”
Potential additions:
- User-controlled visibility/filtering
- Comparative visuals between Zones
- Explicit ethical review before any expansion

---

## 12. Acceptance Criteria (V1)
- Import official nationwide election results.
- Correct axisScore computed for known test Zones.
- Coverage correctly calculated.
- API returns stable, documented output.
- UI displays political tendency clearly and neutrally.

---

## 13. Open Questions
- Which election is the V1 reference (presidential year/round)?
- Exact party-to-axis mapping (must be documented & versioned).
- Weighting: population vs registered voters?
- Legal disclaimer wording to finalize.
