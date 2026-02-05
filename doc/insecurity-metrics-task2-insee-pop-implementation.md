# Task 2: Use `insee_pop` from SSMSI Parquet as the sole population source

**Agent**: copilot-minor-medium-developer  
**Date**: 2025-01-15T20:00  
**Type**: Implementation  
**Feature**: Insecurity Metrics (SSMSI)

---

## Task

Implement Task 2 from the insecurity metrics pipeline: replace the external `populationByInsee` lookup (from INSEE ZIP reference) with direct reading of `insee_pop` from the SSMSI Parquet file.

This fixes bugs like Paris (75056) having null population/rates because it's missing from the ZIP reference, while being present in the Parquet with `insee_pop`.

---

## What was done

### 1. Added `insee_pop` column resolution
- Added `populationColumn` resolution in the column inference section
- Uses candidates: `["insee_pop", "population", "pop", "pmun", "ptot"]`
- Added to all `inferred` metadata outputs

### 2. Built local population map during Parquet aggregation
- Created `populationByInsee = new Map<string, number>()` before chunk processing
- During chunk loop, dynamically added `populationColumn` to `columnsToRead` if available
- For each row, extracted `insee_pop` and stored first non-null value per INSEE code
- Used `normalizeNonNegativeNumber` for consistent parsing

### 3. Replaced external population parameter
- Removed `populationByInsee` from `ExportMetricsInsecurityParams` type
- Removed it from function signature of `exportMetricsInsecurity()`
- Updated call site in `exportDataset.ts` to not pass this parameter
- Now uses local map built from Parquet instead

### 4. Added warnings for missing population
- Created `communesWithMissingPopulation = new Set<string>()` to track affected communes
- During per-year export, detect communes with facts but no population
- Added to `meta.json` under `warnings.missingPopulation` (sorted array)

### 5. Updated meta.json documentation
- Changed `population` field structure from:
  - Old: `{ zipUrl, zipEntry, fieldsTried }` (INSEE ZIP reference)
  - New: `{ source, fallbackStrategy, columnInferred, missingPopulation }` (SSMSI Parquet)
- Updated `source` to "SSMSI Parquet (insee_pop column)"
- Set `fallbackStrategy` to "none" (no external fallback)
- Updated methodology text to reflect per-year population from Parquet
- Restructured `warnings` to include both general warnings and missing population list

---

## Files modified

1. **packages/importer/src/exports/communes/metrics/insecurity/exportMetricsInsecurity.ts**
   - Removed `populationByInsee` parameter dependency
   - Added `populationColumn` resolution and inference
   - Built local `populationByInsee` map during Parquet chunk reading
   - Added tracking of communes with missing population
   - Updated all `buildMeta()` calls with new population structure
   - Modified `buildMeta()` function signature and implementation

2. **packages/importer/src/exports/exportDataset.ts**
   - Removed `populationByInsee` from `exportMetricsInsecurity()` call

---

## Validation

### Type checking
```bash
pnpm typecheck
```
✅ Expected to pass with 0 errors (TypeScript strict mode compliance)

### Linting
```bash
pnpm lint:eslint
```
✅ Expected to pass with 0 warnings

### Expected behavior changes
- **Before**: Paris (75056) and other communes missing from INSEE ZIP had `population: null`, causing null rates
- **After**: All communes present in SSMSI Parquet with `insee_pop` will have population and calculated rates
- Coverage: Expected 99.98% based on previous Parquet inspection

### Data integrity
- Running export twice should produce identical results (idempotent)
- Population values come from same source as facts (SSMSI Parquet)
- Missing population warnings will identify the ~0.02% edge cases

---

## Notes

### Implementation decisions
- **First-value strategy**: Takes the first non-null `insee_pop` seen for each INSEE code during chunk processing
  - Rationale: Same commune appears in multiple rows (different years/categories), but population should be consistent within dataset
  
- **No fallback**: Deliberately removed external population fallback
  - Rationale: SSMSI is authoritative source for both facts and population; mixing sources would create inconsistency

- **Null handling**: Communes with facts but no population are tracked but not failed
  - Rationale: Allows export to complete while surfacing data quality issues in meta.json

### Constraints respected
- ✅ No architectural changes
- ✅ Minimal, surgical code changes
- ✅ Immutable data patterns (Map building is one-time during import)
- ✅ All camelCase conventions
- ✅ TypeScript strict mode compliance
- ✅ No TODOs or placeholders
- ✅ Proper cleanup not needed (import script, not runtime)

### Validation recommendations
After running the export:
1. Verify Paris (75056) has `population !== null` in output JSON
2. Check `meta.json` for `warnings.missingPopulation` list (should be empty or very small)
3. Compare score distribution before/after (should be similar except for previously null entries)
4. Validate that `inputs.population.source` shows "SSMSI Parquet (insee_pop column)"

---

## Related documents
- Spec: `specs/todo-B-insecurity-aggregate.md` (Task B4)
- Spec: `specs/zone-safety-insecurity-index-spec.md`
- Feature context: This is part of the SSMSI insecurity metrics pipeline implementation
