# BUGFIX 2026-02-08 (18:XX) — Security Index Level Mapping

## Issue
Communes with low `indexGlobal` values (0–24, "Très faible" level) were being displayed with high levels like "Élevé" (level 3).

## Root Cause
The level calculation used `mapScoreToLevel(scoreRaw, quartiles)` which relied on quartile thresholds from the raw score distribution. When quartiles were all 0 (Q1=0, Q2=0, Q3=2), the logic became:
- if scoreRaw < Q1 (< 0) → level = 1
- if scoreRaw < Q2 (< 0) → level = 2
- if scoreRaw < Q3 (< 2) → level = 3 ← **BUG: communes with scoreRaw between 0–2 were assigned level 3 "Élevé"**

## Solution
Replaced `mapScoreToLevel()` with `mapIndexToLevel(indexGlobal)` that directly maps the percentile index to levels:
- indexGlobal 0–24 → level 0 ("Très faible")
- indexGlobal 25–49 → level 1 ("Faible")
- indexGlobal 50–74 → level 2 ("Modéré")
- indexGlobal 75–99 → level 3 ("Élevé")
- indexGlobal 100 → level 4 ("Plus élevé")

## Changes
**File**: `packages/importer/src/exports/communes/metrics/insecurity/exportMetricsInsecurity.ts`
- Removed `calculateQuartiles()` and `percentile()` functions
- Removed `thresholdsByYear` variable and passing to `buildMeta()`
- Replaced function call: `mapScoreToLevel(r.scoreRaw, thresholds)` → `mapIndexToLevel(indexGlobal)`
- New function `mapIndexToLevel()` uses simple percentile ranges

**File**: `packages/importer/src/exports/shared/insecurityMetrics.ts`
- Updated `INSECURITY_LEVELS` descriptions to match the percentile ranges (fixed duplicate 50–74 range)

**File**: `apps/web/lib/config/insecurityMetrics.ts`
- Updated level descriptions to match (fixed duplicate 50–74 range)

## Verification
```
Level 0: indexGlobal 0–24    → 29,542 communes ✅
Level 1: indexGlobal 25–49   → 2,129 communes ✅
Level 2: indexGlobal 50–74   → 1,786 communes ✅
Level 3: indexGlobal 75–99   → 1,394 communes ✅
Level 4: indexGlobal 100     → 24 communes ✅
```

All communes now display correct levels matching their indexGlobal percentile rank.
