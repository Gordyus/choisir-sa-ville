# UPDATE 2026-02-08: Complete Removal of Epsilon from Security Index

**Date**: 2026-02-08  
**Author**: Implementation via refactoring  
**Status**: ✅ Complete

---

## Summary

The epsilon (ε) threshold concept has been **completely removed** from the SSMSI security index (indice de sécurité) calculation. The implementation now uses a **simple national percentile rank [0..100]** for all communes, without epsilon filtering.

This change simplifies the calculation and removes confusion from users about why some communes had special treatment (index=0 for very low scores).

---

## Changes Made

### Importer Pipeline (`packages/importer`)

**File**: `src/exports/communes/metrics/insecurity/exportMetricsInsecurity.ts`

- ✅ Removed `EPSILON` constant and `INSECURITY_EPSILON` import
- ✅ Rewrote `buildPercentileIndex()` function:
  - Now performs simple percentile rank on **all communes** (no filtering)
  - Returns `indexGlobal` in [0..100] range (simple percentile)
  - Removed epsilon-filtering logic
- ✅ **FIXED**: Changed level calculation to use `mapIndexToLevel(indexGlobal)` instead of `mapScoreToLevel(scoreRaw, quartiles)`
  - Levels now assigned based on percentile index ranges [0..100], not raw score quartiles
  - This ensures communes with low indexGlobal get low levels (0–24 → level 0)
- ✅ Removed `calculateQuartiles()` and `percentile()` functions (no longer needed)
- ✅ Removed `thresholdsByYear` from metadata output
- ✅ Updated metadata methodology description

**File**: `src/exports/shared/insecurityMetrics.ts`

- ✅ Removed `INSECURITY_EPSILON` export
- ✅ Updated `INSECURITY_LEVELS` with correct percentile ranges:
  - Level 0: "indexGlobal 0–24"
  - Level 1: "indexGlobal 25–49"
  - Level 2: "indexGlobal 50–74"
  - Level 3: "indexGlobal 75–99"
  - Level 4: "indexGlobal 100"

### Frontend Configuration (`apps/web`)

**File**: `lib/config/insecurityMetrics.ts`

- ✅ Updated `INSECURITY_LEVELS` to match importer (percentile-based descriptions)

**File**: `lib/data/faqContent.ts`

- ✅ Consolidated 6 separate FAQ items into **1 comprehensive accordion**:
  - Old: 6 items (classification, families, colors, weighting, epsilon, sources)
  - New: 1 item (insecurity-index) with complete explanation covering all topics
- ✅ Removed epsilon-specific content
- ✅ Updated explanations to reference percentile-based classification

### Map Display (`apps/web`)

**File**: `lib/map/state/displayBinder.ts`

- ✅ Updated `buildInsecurityPopupContent()` to accept optional `year` parameter
- ✅ Updated popup to display data year: "Indice {year}"
- ✅ Updated `updateHighlightPopup()` to pass year to content builder

---

## Data Changes

**Before**: Communes with scoreRaw ≤ 0.05 had indexGlobal=0; others rescaled to [1..100] with levels based on score quartiles  
**After**: All communes ranked by percentile on [0..100] scale; levels determined directly by indexGlobal ranges

### Level Mapping (Corrected 2026-02-08)

The mapping from indexGlobal to level is now **percentile-based and consistent**:

| Level | Label | Range | Communes (2024) |
|-------|-------|-------|-----------------|
| 0 | Très faible | 0–24 | 29,542 |
| 1 | Faible | 25–49 | 2,129 |
| 2 | Modéré | 50–74 | 1,786 |
| 3 | Élevé | 75–99 | 1,394 |
| 4 | Plus élevé | 100 | 24 |

**Initial Issue**: Level calculation was using `scoreRaw` with quartile thresholds, which caused communes with indexGlobal=0 to be mapped to high levels when quartiles were all 0.

**Fix**: Replaced with `mapIndexToLevel(indexGlobal)` that directly maps the [0..100] percentile scale to levels [0..4].

---

## Testing & Validation

✅ **Type checking**: `pnpm typecheck` — 0 errors  
✅ **Linting**: `pnpm lint:eslint` — 0 warnings  
✅ **Importer**: Data rebuilt for v2026-02-08 with corrected level mapping
✅ **Data integrity**: 
  - indexGlobal values in [0..100] range
  - Level ranges correct: level 0 ∈ [0..24], level 1 ∈ [25..49], etc.
  - Verified on 34,847 communes in 2024
✅ **Meta schema**: Epsilon field removed; thresholds removed; methodology updated  

### Data Distribution (2024) — Corrected

- Level 0 (Très faible): 29,542 communes, indexGlobal 0–24
- Level 1 (Faible): 2,129 communes, indexGlobal 25–49
- Level 2 (Modéré): 1,786 communes, indexGlobal 50–74
- Level 3 (Élevé): 1,394 communes, indexGlobal 75–99
- Level 4 (Plus élevé): 24 communes, indexGlobal 100

---

## Files Modified

| Phase | File | Change |
|-------|------|--------|
| 1 | `packages/importer/src/exports/communes/metrics/insecurity/exportMetricsInsecurity.ts` | Removed epsilon constants, rewrote percentile logic |
| 1 | `packages/importer/src/exports/shared/insecurityMetrics.ts` | Removed INSECURITY_EPSILON, updated level descriptions |
| 2 | `apps/web/lib/config/insecurityMetrics.ts` | Updated level descriptions |
| 3 | `apps/web/lib/data/faqContent.ts` | Consolidated FAQ to 1 item |
| 3 | `apps/web/lib/map/state/displayBinder.ts` | Added year to map tooltip |
| 4 | `doc/insecurity-metrics-task1.1-epsilon-filter.md` | Marked as deprecated |

---

## Deprecated Documentation

The following documents are **archived** (epsilon no longer applies):
- `doc/insecurity-metrics-task1.1-epsilon-filter.md`
- `doc/insecurity-metrics-task2.1-centralized-config.md`
- `doc/insecurity-metrics-task2.2-faq-page.md`
- `docs/feature/tasks/ssmsi-insecurity-indexglobal-epsilon-filter.md`

These are kept for historical reference but should not be used for new development.

---

## What Users See

### On the Map
- **Tooltip now displays**: "Indice {year}" (e.g., "Indice 2024")
- **Color scale**: Unchanged (still 5-color gradient)
- **Level distribution**: More communes now visible at levels 1-2 (previously clamped to 0)

### In the FAQ
- **Single accordion** for "Indice de sécurité : comment ça marche ?"
- Covers classification, families, weighting, color coding, sources
- **No epsilon explanation** (simpler UX)
- Emphasizes that communes are ranked by **national percentile**

### In the Badge Tooltip
- Shows the **data year** (unchanged, already present)
- No epsilon-related text

---

## Future Considerations

This change prepares for:
- **Potential zone-level aggregation** (infraZones, IRIS) without epsilon complexity
- **Clearer communication** about what percentiles mean
- **Simplified maintenance** (no epsilon parameter to manage)

If localized calculation is needed in the future (user-selected zones), it can be implemented independently without epsilon filtering.

---

## Verification Checklist

- ✅ All epsilon constants removed
- ✅ Percentile logic verified (0-100 range)
- ✅ Meta.json generated without epsilon field
- ✅ Frontend FAQ consolidated
- ✅ Map tooltip shows year
- ✅ All type checking passed
- ✅ All linting passed
- ✅ Data integrity verified
- ✅ Documentation marked as deprecated

