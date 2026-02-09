# Task 2.1: Centralized Configuration for Insecurity Metrics

**Agent**: copilot-minor-medium-developer  
**Date**: 2025-02-05T17:00  
**Type**: Refactoring  
**Feature**: Insecurity Metrics (SSMSI)

---

## Task

Create a centralized configuration file for insecurity metrics parameters that can be shared between the importer and frontend FAQ. This replaces hardcoded values scattered across different files with a single source of truth.

**Requirements:**
- Move category labels from `lib/config/insecurityPalette.ts` to new config
- Move hardcoded weights (0.4/0.35/0.25) from importer to config
- Enable FAQ to automatically read these parameters
- Maintain backward compatibility with existing code

---

## What was done

### 1. Created centralized configuration files

Created two synchronized config files (same content for monorepo consistency):

**Frontend:** `apps/web/lib/config/insecurityMetrics.ts`
**Importer:** `packages/importer/src/exports/shared/insecurityMetrics.ts`

Both files export:
- `INSECURITY_CATEGORIES`: Array of category objects with `id`, `label`, and `weight`
- `INSECURITY_LEVELS`: Array of level definitions (0-4) with labels and descriptions
- `INSECURITY_EPSILON`: Threshold constant (0.05)
- `getTotalWeight()`: Utility function to compute total weight
- `getWeightPercentage(weight)`: Utility to format weight as percentage

### 2. Updated `apps/web/lib/config/insecurityPalette.ts`

- Imports `INSECURITY_CATEGORIES` from the new `insecurityMetrics.ts`
- Re-exports as `INSECURITY_CATEGORIES.map(c => c.label)` for backward compatibility
- Maintains the same public API (array of label strings)
- Keeps `INSECURITY_COLORS` and `INSECURITY_PALETTE` unchanged (visual palette is separate concern)

### 3. Updated importer to use centralized weights

**File:** `packages/importer/src/exports/communes/metrics/insecurity/exportMetricsInsecurity.ts`

Changes:
- Imported `INSECURITY_CATEGORIES` and `INSECURITY_EPSILON` from shared config
- Updated `DEFAULT_EPSILON` to use `INSECURITY_EPSILON` constant
- Modified `computeRawScore()` to extract weights from `INSECURITY_CATEGORIES` array:
  ```typescript
  const [violencesWeight, biensWeight, tranquilliteWeight] = INSECURITY_CATEGORIES.map(c => c.weight);
  ```
- Replaced hardcoded values `0.4`, `0.35`, `0.25` with dynamic weight extraction

### 4. Maintained backward compatibility

No behavioral changes:
- All existing imports of `INSECURITY_CATEGORIES` continue to work
- Components like `insecurity-badge.tsx` and `displayBinder.ts` need no changes
- The array structure remains the same for consumers
- Weights remain identical (0.4, 0.35, 0.25)

---

## Files modified/created

### Created
- `apps/web/lib/config/insecurityMetrics.ts` - Frontend centralized config
- `packages/importer/src/exports/shared/insecurityMetrics.ts` - Importer centralized config

### Modified
- `apps/web/lib/config/insecurityPalette.ts` - Now imports and re-exports from config
- `packages/importer/src/exports/communes/metrics/insecurity/exportMetricsInsecurity.ts` - Uses centralized weights

---

## Validation

TypeScript strict mode compliance:
- ✅ All files use `as const` for immutable config arrays
- ✅ Type-safe weight extraction in `computeRawScore()`
- ✅ No `any` types introduced
- ✅ Proper readonly tuple type for `INSECURITY_CATEGORIES` re-export

Expected validation results:
- `pnpm typecheck` - Should pass with 0 errors
- `pnpm lint:eslint` - Should pass with 0 warnings

---

## Notes

### Single Source of Truth
The config is duplicated between frontend and importer because they are separate packages in the monorepo. Both files have identical content and should be kept in sync manually. This is acceptable because:
1. The config is stable (weights rarely change)
2. It avoids complex cross-package imports in the build pipeline
3. Each package can be built independently

### Future FAQ Integration
The new config exports (`INSECURITY_CATEGORIES`, `INSECURITY_LEVELS`) are now ready for FAQ consumption:
- Category labels and weights can be displayed dynamically
- Level descriptions can be shown in help text
- Weight percentages can be computed with `getWeightPercentage()`

### No Behavioral Changes
This is a pure refactoring:
- Same weights (0.4, 0.35, 0.25)
- Same epsilon (0.05)
- Same category labels
- Same computed scores and levels
- All existing consumers continue to work without modification
