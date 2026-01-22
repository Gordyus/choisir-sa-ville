# City Visibility Fix - Quick Reference

## What Changed?

### 1. Scoring System

**Old:** `priority = log10(population) or 1`  
**New:** `score = log10(population) + majorCityBonus`

Major cities always get bonus (even without population data):

- Paris: +5
- Marseille, Lyon: +4
- Toulouse, Nice, Nantes, Montpellier, Strasbourg, Bordeaux, Lille: +3

### 2. Grid Cells at Low Zoom

**T0 (zoom 0-6):** Now allows **2 cities per cell** instead of 1  
→ Reduces bucket eviction, ensures major cities always visible

### 3. Tie-Breaker Order

1. Score DESC (new)
2. Population DESC
3. Name ASC
4. ID ASC

## Key Benefits

✅ **Paris always visible** before Alfortville  
✅ **Works even without population data** (bonus scoring)  
✅ **Deterministic** - same input = same output  
✅ **Backward compatible** - existing code still works  
✅ **Configurable** - edit `MAJOR_CITIES_BONUS` to add/remove cities  

## Testing the Fix

### Manual Test 1: Debug Helper

```typescript
// In component or browser console:
service.debugCityVisibility('Paris', allCities, 5, projection);
// Outputs: Score, bucket key, top 10 cities in that bucket
```

### Manual Test 2: Low Zoom

1. Load map at zoom level 5
2. Pan around Europe
3. Paris should always be visible
4. Alfortville should not appear at zoom 5

### Programmatic Test

Run unit tests (see `city-visibility.service.new.spec.ts.example`):

- `should rank Paris above Alfortville when Paris has no population`
- `should respect maxCitiesPerCell`
- All determinism tests still pass

## Configuration

Edit: `apps/web/src/app/core/services/city-visibility.config.ts`

```typescript
// Add/remove major cities here
export const MAJOR_CITIES_BONUS: Record<string, number> = {
  'paris': 5,      // Top tier
  'lyon': 4,       // Tier 2
  'toulouse': 3,   // Tier 3
  // Add more as needed
};

// Adjust tier limits here
export const ZOOM_TIERS: TierConfig[] = [
  {
    id: 'T0',
    minZoom: 0,
    maxZoom: 6,
    targetMaxVisibleCities: 50,
    gridCellSizePx: 220,
    maxCitiesPerCell: 2  // <-- Now 2, was 1
  },
  // ...
];
```

## Files to Review

1. **Implementation:**
   - [city-visibility.config.ts](apps/web/src/app/core/services/city-visibility.config.ts) - Bonuses & tiers
   - [city-visibility.service.ts](apps/web/src/app/core/services/city-visibility.service.ts) - computeScore() method
   - [city-visibility.types.ts](apps/web/src/app/core/services/city-visibility.types.ts) - CityWithScore

2. **Tests:**
   - [city-visibility.service.new.spec.ts.example](apps/web/src/app/core/services/city-visibility.service.new.spec.ts.example) - New tests

3. **Documentation:**
   - [CITY_VISIBILITY.md](docs/CITY_VISIBILITY.md) - Full docs
   - [CITY_VISIBILITY_FIX.md](docs/CITY_VISIBILITY_FIX.md) - Implementation details

## Troubleshooting

### Paris still not showing?

1. Check name is in `MAJOR_CITIES_BONUS` (case-insensitive)
2. Run `debugCityVisibility('Paris', ...)` to check score
3. Verify city is in viewport and city data

### Alfortville showing when it shouldn't?

1. Reduce `targetMaxVisibleCities` per tier
2. Increase `gridCellSizePx` to reduce grid density
3. Reduce `maxCitiesPerCell` for higher tiers

### Flicker when panning?

1. Increase `OVERSCAN_FACTOR` (default 1.2)
2. Increase `STICKINESS_DURATION_MS` (default 450)

## Performance Impact

✅ No significant impact:

- Score calculation: O(1) per city
- Sorting: O(n log n) same as before
- Grid bucketing: O(n) same as before
- Bonus lookup: O(1) map lookup

## Future Work

- **Phase 2:** Map insulae/inseeCode for more robust major city detection
- **Phase 3:** Admin level integration (prefecture, sous-préfecture)
- **Phase 4:** Importance scoring based on administrative classification
