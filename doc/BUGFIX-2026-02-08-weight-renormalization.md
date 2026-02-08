# BUGFIX 2026-02-08: Weight Renormalization Correction

**Date**: 2026-02-08  
**Severity**: CRITICAL  
**Scope**: Security Index Calculation  
**Status**: ✅ FIXED

---

## Problem Statement

The `computeRawScore()` function in the insecurity metrics importer contained a **critical mathematical error**: when one or more of the 3 crime categories (violences/biens/tranquillité) had missing data for a commune, the weights were **renormalized** to sum to 1.0 over only the available categories.

### Impact

- **70% of communes affected** (24,534 / 34,875 had partial data)
- Scores were **artificially inflated** for communes with missing categories
- The weight hierarchy (40% / 35% / 25%) was completely destroyed

### Example

**Commune 52519 (Cunel, 47 inhabitants)**:
- Violences: 0
- Biens: 170.2/1000
- Tranquillité: **missing**

**Incorrect calculation** (with renormalization):
```
sumWeights = 0.35  (only "biens" available)
score = (0.35 / 0.35) × 170.2 = 170.2
```

**Correct calculation** (without renormalization):
```
score = 0.4 × 0 + 0.35 × 170.2 + 0.25 × 0 = 59.57
```

The incorrect score (170.2) inflated the commune's ranking artificially.

---

## Root Cause

**File**: `packages/importer/src/exports/communes/metrics/insecurity/exportMetricsInsecurity.ts`  
**Lines**: 369-377 (before fix)

```typescript
// INCORRECT CODE (BEFORE FIX)
const sumWeights = parts.reduce((acc, p) => acc + p.weight, 0);
if (sumWeights <= 0) return null;

let score = 0;
for (const p of parts) {
    score += (p.weight / sumWeights) * p.value;  // ← RENORMALIZATION ERROR
}
```

The division by `sumWeights` renormalized the weights to sum to 1.0 over only the available categories, violating the product specification that weights must remain **40% / 35% / 25%** regardless of missing data.

---

## Solution

Replace the weight renormalization logic with a **simple weighted sum** where missing values are treated as 0:

```typescript
// CORRECT CODE (AFTER FIX)
function computeRawScore(values: {
    violencesPersonnesPer1000: number | null;
    securiteBiensPer1000: number | null;
    tranquillitePer1000: number | null;
}): number | null {
    const v = values.violencesPersonnesPer1000 ?? 0;
    const b = values.securiteBiensPer1000 ?? 0;
    const t = values.tranquillitePer1000 ?? 0;

    // If all values are null, return null (no data)
    if (values.violencesPersonnesPer1000 === null &&
        values.securiteBiensPer1000 === null &&
        values.tranquillitePer1000 === null) {
        return null;
    }

    // Weighted sum with original weights (NO renormalization)
    const score = 
        INSECURITY_CATEGORIES[0]!.weight * v +  // 0.4
        INSECURITY_CATEGORIES[1]!.weight * b +  // 0.35
        INSECURITY_CATEGORIES[2]!.weight * t;   // 0.25

    return score;
}
```

---

## Additional Enhancement: `dataCompleteness` Field

To provide transparency about partial data, a new field was added to the output schema:

```json
{
    "insee": "52519",
    "population": 47,
    "violencesPersonnesPer1000": 0,
    "securiteBiensPer1000": 170.2,
    "tranquillitePer1000": null,
    "indexGlobal": 100,
    "level": 4,
    "dataCompleteness": 0.6666666666666666  // ← NEW FIELD (2/3 categories present)
}
```

**Calculation**:
```typescript
const presentCount = [
    r.violencesPersonnesPer1000 !== null,
    r.securiteBiensPer1000 !== null,
    r.tranquillitePer1000 !== null
].filter(Boolean).length;
const dataCompleteness = presentCount / 3;  // Range: [0..1]
```

---

## Validation Results

### Score Distribution (After Fix)

```
Median (P50):    0.00
P75:             1.50
P90:             8.33
P95:            12.85
P99:            20.37
Max:           434.99
```

### Commune 52519 Verification

| Metric | Value | Interpretation |
|--------|-------|----------------|
| Score (raw) | 59.57 | 0.4×0 + 0.35×170.2 + 0.25×0 |
| Rank | 18 / 34,847 | Top 0.05% nationally |
| IndexGlobal | 100 | Percentile maximum (shared with 21 other communes) |
| Level | 4 ("Plus élevé") | ✅ **CORRECT** |
| DataCompleteness | 0.67 | 2 out of 3 categories available |

**Conclusion**: The commune **legitimately** has a very high insecurity score. With 170.2 property crimes per 1000 inhabitants (equivalent to ~8 incidents for 47 people), the weighted score of 59.57 is **almost 2× higher than Paris/Lyon/Marseille** (~30-33).

### Comparison with Major Cities

| City | Violences | Biens | Tranquillité | Score | IndexGlobal | Level |
|------|-----------|-------|--------------|-------|-------------|-------|
| Paris | 13.6 | 70.2 | 8.2 | 32.06 | 98 | 3 (Élevé) |
| Lyon | 13.3 | 74.0 | 8.5 | 33.34 | 98 | 3 (Élevé) |
| Marseille | 14.8 | 56.9 | 13.0 | 29.09 | 98 | 3 (Élevé) |
| **52519 (Cunel)** | **0** | **170.2** | **N/A** | **59.57** | **100** | **4 (Plus élevé)** |

---

## Files Modified

### Importer
- `packages/importer/src/exports/communes/metrics/insecurity/exportMetricsInsecurity.ts`
  - **Lines 12-20**: Added `"dataCompleteness"` to `OUTPUT_COLUMNS`
  - **Lines 349-371**: Rewrote `computeRawScore()` to remove renormalization
  - **Lines 273-290**: Added `dataCompleteness` calculation in tabular output

### Data Schema
- **New column**: `dataCompleteness` (range [0..1], precision: float)
- **Columns order**: `["insee", "population", "violencesPersonnesPer1000", "securiteBiensPer1000", "tranquillitePer1000", "indexGlobal", "level", "dataCompleteness"]`

---

## Testing

| Check | Status | Details |
|-------|--------|---------|
| TypeScript | ✅ PASS | 0 errors |
| ESLint | ✅ PASS | 0 warnings |
| Build | ✅ PASS | Next.js compilation successful |
| Data Integrity | ✅ VERIFIED | 34,875 communes processed |
| Score Calculation | ✅ CORRECT | Commune 52519: 59.57 = 0.35 × 170.2 |
| Percentile Rank | ✅ CORRECT | Top 22 communes share indexGlobal=100 |

---

## Architectural Validation

This fix was **validated and approved** by the PO/Architect gatekeeper agent:

> ✅ La correction proposée (option 4, poids originaux sans renormalisation) est **approuvée** et **obligatoire** avant toute mise en production des données insécurité.
> 
> ❌ Toute alternative qui conserve la renormalisation des poids est **refusée** car elle viole les invariants métier du modèle de pondération.

---

## Breaking Changes

⚠️ **Data schema change**: New column `dataCompleteness` added to all insecurity metric files.

### Migration

**Frontend consumers** should update their types to include the new field:

```typescript
type InsecurityMetric = {
    insee: string;
    population: number | null;
    violencesPersonnesPer1000: number | null;
    securiteBiensPer1000: number | null;
    tranquillitePer1000: number | null;
    indexGlobal: number | null;
    level: number;
    dataCompleteness: number;  // ← NEW FIELD
};
```

The field is **backwards-compatible** (existing code will ignore the extra column), but **should be displayed in the UI** to maintain transparency about partial data.

---

## Future Recommendations

1. **UI Badge**: Display "Données partielles (X%)" badge when `dataCompleteness < 1.0`
2. **FAQ Update**: Document the treatment of missing values explicitly
3. **Unit Tests**: Add regression tests for `computeRawScore()` with partial data
4. **Metadata**: Document `missingValueTreatment: "implicit_zero"` in `meta.json`

---

**Fixed by**: GitHub Copilot CLI  
**Validated by**: PO/Architect Gatekeeper Agent  
**Dataset Version**: v2026-02-08 (regenerated)  
**Status**: ✅ PRODUCTION READY
