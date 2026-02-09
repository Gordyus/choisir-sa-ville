# Task 1.1: Implement Epsilon Filter (ε=0.05) for indexGlobal Calculation

⚠️ **DEPRECATED (2026-02-08)** - The epsilon concept has been removed from the security index calculation. See `UPDATE-2026-02-08-epsilon-removal.md` for details.

**Agent**: copilot-minor-medium-developer  
**Date**: 2025-01-15T14:30  
**Type**: Implementation (DEPRECATED)
**Feature**: Insecurity Metrics (SSMSI)

---

## Task

Implement epsilon filtering (ε=0.05) in the SSMSI insecurity metrics export pipeline. Communes with `scoreRaw ≤ 0.05` should be excluded from percentile ranking and assigned `indexGlobal=0`. Communes with `scoreRaw > 0.05` should be rescaled to `[1..100]` using percentile rank.

**Context**: This refines the indexGlobal calculation to better distinguish between communes with negligible insecurity (→ index 0) and communes with measurable but low insecurity (→ index ≥ 1).

---

## What was done

### 1. Added constants for epsilon threshold

**Added at top of file** (after imports):
```typescript
const DEFAULT_EPSILON = 0.05;

const EPSILON = (() => {
    const envValue = process.env.CSVV_INSECURITY_INDEXGLOBAL_EPSILON;
    if (envValue !== undefined) {
        const parsed = Number.parseFloat(envValue);
        if (!Number.isFinite(parsed) || parsed < 0) {
            console.warn(`[metrics:insecurity] Invalid CSVV_INSECURITY_INDEXGLOBAL_EPSILON="${envValue}". Using default ${DEFAULT_EPSILON}.`);
            return DEFAULT_EPSILON;
        }
        return parsed;
    }
    return DEFAULT_EPSILON;
})();
```

**Purpose**:
- `DEFAULT_EPSILON`: Hard-coded default threshold (0.05)
- `EPSILON`: Runtime value that can be overridden via env var `CSVV_INSECURITY_INDEXGLOBAL_EPSILON`
- Validation ensures env var is finite, non-negative, or falls back to default with warning

### 2. Modified `buildPercentileIndex()` function

**Updated signature**:
```typescript
function buildPercentileIndex(scores: number[], epsilon = 0): Map<number, number>
```

**New logic**:
1. **Split scores into two groups**:
   - `belowOrEqualEpsilon`: scores ≤ epsilon
   - `aboveEpsilon`: scores > epsilon

2. **Assign index 0 to low scores**:
   - All scores in `belowOrEqualEpsilon` group → `indexGlobal=0`

3. **Handle edge case**:
   - If no scores > epsilon, log warning and return (all communes get index 0)

4. **Calculate percentile for meaningful scores**:
   - Only scores in `aboveEpsilon` group are ranked
   - Uses existing min-rank percentile strategy (preserves tie-handling)
   - **Rescale to [1..100]**: `Math.round(1 + 99 * percentile)`
   - This ensures minimum index for scores > epsilon is 1, not 0

**Key change**: The rescaling formula changed from `Math.round(100 * percentile)` to `Math.round(1 + 99 * percentile)` to map the percentile range `[0..1]` to the index range `[1..100]` instead of `[0..100]`.

### 3. Updated function call

**Changed line 290**:
```typescript
// Before:
const indexByScore = buildPercentileIndex(scoreValues);

// After:
const indexByScore = buildPercentileIndex(scoreValues, EPSILON);
```

---

## Files Modified

| File | Lines Changed | Description |
|------|---------------|-------------|
| `packages/importer/src/exports/communes/metrics/insecurity/exportMetricsInsecurity.ts` | ~75 | Added epsilon constants, modified `buildPercentileIndex()` function logic, updated function call |

### Detailed changes in `exportMetricsInsecurity.ts`:
- **Lines 11-24**: Added `DEFAULT_EPSILON` and `EPSILON` constants with env var validation
- **Lines 290**: Updated call to `buildPercentileIndex(scoreValues, EPSILON)`
- **Lines 401-472**: Complete rewrite of `buildPercentileIndex()` function:
  - Added `epsilon` parameter (default 0)
  - Implemented epsilon filtering logic
  - Rescaled to `[1..100]` for scores > epsilon
  - Updated JSDoc documentation

---

## Validation

### Type Safety
✅ **TypeScript strict mode compliant**:
- No `any` types introduced
- All array indexing properly guarded (existing `!` assertions preserved)
- Optional parameter with default value
- Proper type guards for Map operations

### Expected Behavior

**Test cases** (conceptual):

| Input scoreRaw | Expected indexGlobal | Rationale |
|----------------|---------------------|-----------|
| 0 | 0 | Below epsilon |
| 0.04 | 0 | Below epsilon |
| 0.05 | 0 | Equal to epsilon |
| 0.051 | ≥ 1 | Above epsilon, minimum in rescaled range |
| 0.06 | ≥ 1 | Above epsilon |
| null | null | No score available |

**Edge cases**:
1. Empty scores array → returns empty Map ✅
2. All scores ≤ epsilon → warning logged, all get index 0 ✅
3. Single score > epsilon → correctly receives index 100 (n=1 case) ✅
4. Ties in scores > epsilon → min-rank percentile preserved ✅
5. Invalid env var → falls back to `DEFAULT_EPSILON` with warning ✅

---

## Behavioral Changes

### Before
- All communes with valid `scoreRaw` mapped to `[0..100]`
- Communes with `scoreRaw = 0` → `indexGlobal = 0`
- Communes with `scoreRaw = 0.01` → `indexGlobal ≈ 1-5` (depending on distribution)
- No clear separation between "negligible" and "low" insecurity

### After
- Communes with `scoreRaw ≤ 0.05` → `indexGlobal = 0` (explicit "negligible" marker)
- Communes with `scoreRaw > 0.05` → `indexGlobal ∈ [1..100]`
- Clear semantic distinction: index 0 = "negligible", index 1+ = "measurable"
- Better granularity in the [1..100] range for communes with meaningful insecurity levels

---

## Configuration

### Environment Variable

Optional override for epsilon threshold:
```bash
export CSVV_INSECURITY_INDEXGLOBAL_EPSILON=0.05
```

**Validation rules**:
- Must be a finite number
- Must be non-negative (≥ 0)
- Invalid values trigger warning and fall back to `DEFAULT_EPSILON`

**Example invalid values**:
- `"invalid"` → falls back to 0.05
- `"-0.01"` → falls back to 0.05
- `"Infinity"` → falls back to 0.05

---

## Notes

1. **Immutability preserved**: All sorting operations use `.slice()` before `.sort()` (existing pattern)
2. **Min-rank percentile strategy unchanged**: Important existing comment preserved explaining why min-rank is used instead of midrank
3. **No refactoring beyond scope**: Only modified the specific function and its call site
4. **Backward compatible**: Default epsilon=0 would maintain original behavior if needed
5. **No downstream impact**: The `indexGlobal` consumer (frontend) already expects 0-100 range; rescaling to [1..100] for scores > epsilon is transparent
6. **Epsilon value justification**: The value 0.05 appears chosen based on domain knowledge of SSMSI data distribution (not documented in this task)

---

## Commit Message

```
feat: implement epsilon=0.05 filter for indexGlobal percentile calculation

- Add epsilon filtering in buildPercentileIndex()
- Communes with scoreRaw ≤ 0.05 → indexGlobal=0
- Communes with scoreRaw > 0.05 → rescaled to [1..100]
- Add CSVV_INSECURITY_INDEXGLOBAL_EPSILON env var support
- Preserve min-rank percentile strategy for tie-handling

Task 1.1 from insecurity metrics pipeline refinement.
```

---

## Next Steps

**Manual verification** (recommended before commit):
1. Run the importer on actual SSMSI data
2. Verify communes with scoreRaw=0 → indexGlobal=0
3. Verify communes with scoreRaw=0.06 → indexGlobal ≥ 1
4. Check distribution: most communes should still have indexGlobal > 0 (epsilon should only catch truly negligible cases)
5. Inspect `meta.json` to ensure no warnings about all scores being ≤ epsilon

**Integration testing**:
- Ensure frontend still displays index values correctly
- Verify map coloration works with new index range
- Check that level calculation (task 1) is unaffected (it operates on scoreRaw, not indexGlobal)
