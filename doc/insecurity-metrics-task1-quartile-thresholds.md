# Task 1: Calculate quartile thresholds and bake level (0–4) into exported JSON

**Agent**: copilot-minor-medium-developer  
**Date**: 2025-01-20T19:45  
**Type**: Implementation  
**Feature**: Insecurity Metrics (SSMSI)

---

## Task

Implement Task 1 from the insecurity metrics pipeline: Calculate quartile thresholds on `scoreRaw > 0` and bake the classification level (0–4) directly into exported JSON files.

This eliminates a giant match expression (~35k communes) in the frontend map code that was causing performance issues.

---

## What was done

### 1. Added quartile calculation

**Added function**: `calculateQuartiles(scores: Array<number | null>)`
- Filters all `scoreRaw` values to only include values strictly > 0
- Sorts values in ascending order for deterministic results
- Calculates Q1 (25th percentile), Q2 (median/50th), Q3 (75th percentile)
- Uses linear interpolation via new `percentile()` helper function
- Returns `{ q1: 0, q2: 0, q3: 0 }` if all scores are 0 or no valid scores exist

**Added function**: `percentile(sortedValues: number[], p: number)`
- Calculates p-th percentile using linear interpolation
- Consistent with existing `buildPercentileIndex()` pattern
- Handles edge cases (empty array, single value, exact position matches)

### 2. Created level mapping function

**Added function**: `mapScoreToLevel(scoreRaw, thresholds)`

Maps each commune's `scoreRaw` to a discrete level (0–4):
- `scoreRaw = 0` → `level = 0` ("Très faible")
- `0 < scoreRaw < Q1` → `level = 1` ("Faible")  
- `Q1 ≤ scoreRaw < Q2` → `level = 2` ("Modéré")
- `Q2 ≤ scoreRaw < Q3` → `level = 3` ("Élevé")
- `Q3 ≤ scoreRaw` → `level = 4` ("Plus élevé")
- `null` or non-finite → `level = 0`

### 3. Integrated level into export pipeline

**Modified per-year export loop**:
- Added `thresholdsByYear = new Map<number, { q1, q2, q3 }>()` to track thresholds
- After calculating all `scoreRaw` values for a year, calculate quartiles on the distribution
- Store thresholds in map keyed by year
- Apply `mapScoreToLevel()` when building each row
- Add `level` to row tuple after `indexGlobal`

**Updated `OUTPUT_COLUMNS`**:
```typescript
const OUTPUT_COLUMNS = [
    "insee",
    "population",
    "violencesPersonnesPer1000",
    "securiteBiensPer1000",
    "tranquillitePer1000",
    "indexGlobal",
    "level"  // ← NEW
] as const;
```

### 4. Updated meta.json structure

**Extended `buildMeta()` function**:
- Added `thresholdsByYear` parameter to function signature
- Generates `thresholds` object with per-year Q1/Q2/Q3 values
- Each year's entry includes method description: `"quartiles on scoreRaw > 0"`
- Added `levels` object with:
  - `labels`: Array of 5 level labels
  - `method`: Description of classification approach

**Updated all `buildMeta()` call sites**:
- Main export path: passes populated `thresholdsByYear` map
- Early-exit cases (empty mapping, missing columns): passes empty map

**Example meta.json output**:
```json
{
  "thresholds": {
    "2023": {
      "q1": 12.5,
      "q2": 18.3,
      "q3": 25.7,
      "method": "quartiles on scoreRaw > 0"
    }
  },
  "levels": {
    "labels": ["Très faible", "Faible", "Modéré", "Élevé", "Plus élevé"],
    "method": "Quartile-based classification on non-zero scoreRaw distribution"
  }
}
```

---

## Files modified

### Modified
**`packages/importer/src/exports/communes/metrics/insecurity/exportMetricsInsecurity.ts`**
- Updated `OUTPUT_COLUMNS` constant to include `"level"`
- Added `thresholdsByYear` map in main export function
- Added quartile calculation in per-year loop before row generation
- Modified row mapping to include `level` field
- Extended `buildMeta()` signature to accept `thresholdsByYear` parameter
- Updated `buildMeta()` implementation to generate `thresholds` and `levels` metadata
- Updated all `buildMeta()` call sites (3 locations: 2 early exits + main path)
- Added 3 new helper functions at end of file:
  - `calculateQuartiles()` — Computes Q1/Q2/Q3 on scoreRaw > 0
  - `percentile()` — Linear interpolation for percentile calculation
  - `mapScoreToLevel()` — Maps scoreRaw to discrete level 0–4

---

## Validation

### Type Checking
✅ **PASS** — `pnpm typecheck` produces 0 errors

### Linting  
✅ **PASS** — `pnpm lint:eslint --max-warnings=0` produces 0 warnings

### Edge Cases Handled
1. **All communes have `scoreRaw = 0`**: Returns thresholds `{ q1: 0, q2: 0, q3: 0 }`, all levels = 0
2. **Null or non-finite `scoreRaw`**: Maps to level 0
3. **Single commune with `scoreRaw > 0`**: Quartiles all equal to that single value
4. **Empty data (early exit paths)**: Pass empty `thresholdsByYear` map to `buildMeta()`

### Determinism
- Quartile calculation uses deterministic sorting and interpolation
- Level mapping is a pure function based on thresholds
- Same input data always produces identical thresholds and levels

---

## Design decisions

### 1. Quartiles calculated on `scoreRaw > 0` only
Ensures the distribution represents actual insecurity levels, not the absence of data. Communes with `scoreRaw = 0` are explicitly assigned level 0 ("Très faible").

### 2. Linear interpolation for percentiles
Matches the existing `buildPercentileIndex()` pattern for consistency. Uses the same interpolation method as `indexGlobal` calculation.

### 3. Level added after `indexGlobal`
Preserves backward compatibility with existing column order. Frontend code consuming only the first 6 columns will continue to work.

### 4. Thresholds stored per year
Each year has independent thresholds calculated from that year's data distribution. Ensures temporal consistency and accounts for data evolution over time.

### 5. Method documentation in meta.json
Both `thresholds` (per-year) and `levels` (global) include `method` fields describing the calculation approach. Supports future auditing and reproducibility.

---

## Performance impact

### Importer
Minimal additional computation:
- Single pass for quartile calculation per year (O(n log n) for sorting)
- Negligible compared to Parquet reading and aggregation

### Frontend (expected)
Significant improvement:
- Eliminates ~35k-entry match expression in map rendering code
- Replaces runtime calculations with direct level lookup from JSON data
- Should reduce initial map render time and improve zoom/pan responsiveness

---

## Distribution impact

The quartile-based classification produces more balanced level distribution compared to previous binary rendering:

- **Level 0**: Communes with no insecurity data or `scoreRaw = 0`  
- **Level 1**: Bottom quartile of communes with data (0 < scoreRaw < Q1)
- **Level 2**: Second quartile (Q1 ≤ scoreRaw < Q2)
- **Level 3**: Third quartile (Q2 ≤ scoreRaw < Q3)
- **Level 4**: Top quartile (Q3 ≤ scoreRaw)

This provides better visual distinction on the map and allows for more nuanced color gradients.

---

## Next steps

This implementation completes **Task 1**. Follow-up tasks:

1. **Task 2** (frontend): Update map layer to consume the new `level` field
2. **Task 3** (frontend): Remove the giant match expression from map rendering code  
3. **Task 4** (frontend): Verify color palette matches level thresholds
4. **Validation**: Re-run importer and inspect output JSON to verify thresholds and levels

---

## References

- Original spec: `specs/zone-safety-insecurity-index-spec.md`
- Related work: `doc/insecurity-metrics-task2-insee-pop-implementation.md`
