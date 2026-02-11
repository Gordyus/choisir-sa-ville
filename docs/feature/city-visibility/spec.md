# Specification — Progressive City Display (Stack-Agnostic)

**Statut** : Draft  
**Implémentation** : Non commencée

## 1. Purpose

This specification defines a stack-agnostic system to stabilize map navigation and city display
by replacing numeric clustering (pastilles) with a progressive, priority-based city rendering.

Goals:

- Fewer cities at low zoom levels
- More cities as the user zooms in
- Stable visual behavior during pan and zoom
- Predictable, configurable rules suitable for a POC

Non-goals (POC):

- No routing
- No advanced label collision engine
- No heavy server-side preprocessing

---

## 2. Definitions

- City: A geographic entity with coordinates and a priority score
- Viewport: The currently visible geographic area + screen dimensions
- Zoom Tier: A zoom/scale range defining a target density
- Grid Cell: A screen-space rectangle used to limit density
- Display Budget: Maximum number of visible cities

---

## 3. Required Data

### 3.1 City Data Model (Minimal)

- id: string
- name: string
- lat: number
- lon: number
- population?: number
- adminLevel?: enum (optional)
- priorityScore: number

### 3.2 Priority Score

Default rule (POC):
priorityScore = log10(population)

Fallback:
priorityScore = 1

Optional extension:
priorityScore = log10(population) + adminLevelBonus

The score must be deterministic and stable.

---

## 4. Zoom Tiers

A zoom tier defines how many cities may be shown and how they are distributed.

Each tier contains:

- id
- zoomRange (or scaleRange)
- targetMaxVisibleCities
- gridCellSizePx
- maxCitiesPerCell
- optional minScoreThreshold

Example (indicative):

| Tier | Budget | Cell Size | Max / Cell |
|----|----|----|----|
| A (low zoom) | 50 | 220px | 1 |
| B | 200 | 180px | 1 |
| C | 800 | 140px | 1 |
| D (high zoom) | 3000 | 110px | 2 |

---

## 5. City Selection Algorithm

Triggered on viewport update.

### Step 1 — Spatial Filtering

Select cities inside the viewport bounding box
(optional overscan margin allowed).

### Step 2 — Grid Distribution

- Divide viewport into grid cells (screen space).
- Assign each city to a cell.
- For each cell, keep up to maxCitiesPerCell
  with the highest priorityScore.

### Step 3 — Global Budget Enforcement

If total cities exceed targetMaxVisibleCities:

- Sort by priorityScore descending
- Keep only the top N

### Output

Return a deterministic list of visible cities.

---

## 6. Visual Stability Rules

### 6.1 Update Timing

- Recompute city list only on pan/zoom end
- Or use debounce (120–250 ms)

### 6.2 Zoom Hysteresis

To avoid flicker between tiers:

- Tier change only occurs if zoom exceeds
  threshold ± hysteresisMargin

Recommended margin: 0.3

### 6.3 Stickiness (Optional)

Once displayed, a city remains visible for a short duration:

- stickyDurationMs: 300–600 ms
- A city can be replaced only if the new candidate
  has a priorityScore greater by replaceFactor (e.g. 1.15)
- Or if the city exits the viewport

---

## 7. Performance Constraints

- Display budget must always be enforced
- Spatial filtering should use an index if available
  (quadtree, geohash, R-tree)
- Target computation time (indicative): < 50 ms

---

## 8. Configuration Parameters

- zoomTiers[]
- priorityScore(city)
- hysteresisMargin
- debounceMs
- stickyDurationMs
- replaceFactor
- overscanBBoxFactor

---

## 9. Edge Cases

- Empty viewport → no cities
- Missing population → fallback score
- High-density areas handled via grid
- Label collisions out of scope (POC)

---

## 10. Acceptance Criteria

- No numeric clustering pastilles
- City count increases smoothly with zoom
- No visible flicker when panning
- Stable behavior near zoom thresholds
- Even spatial distribution at low zoom
- Readable density at high zoom

---

## 11. Future Extensions (Post-POC)

- Server-side pre-aggregation per zoom tier
- Tile-based city datasets
- POI layers
- Advanced label collision handling
- Local-importance weighting (per region/department)

---
