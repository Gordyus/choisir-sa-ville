# City Visibility System

Progressive city marker display system for map rendering without clustering.

## Overview

The city visibility system displays cities progressively based on zoom level, using a deterministic algorithm that ensures stable, user-friendly rendering. Cities are shown/hidden based on:

- **Zoom level** (via tier system)
- **Score** (population + major city bonus)
- **Grid-based distribution** (prevents overcrowding)
- **Viewport filtering** (with overscan)

## Architecture

The implementation follows a clean separation of concerns:

```
├── core/services/
│   ├── city-visibility.types.ts       # TypeScript types
│   ├── city-visibility.config.ts      # Tier configuration & major cities
│   ├── city-visibility.service.ts     # Pure logic (no Leaflet)
│   ├── city-visibility-leaflet.service.ts  # Leaflet integration
│   ├── city-visibility.service.spec.ts.example  # Original unit tests
│   └── city-visibility.service.new.spec.ts.example  # Updated unit tests
└── features/map/ui/
    └── map.component.ts                # Updated to use visibility system
```

## Key Features

### 1. **Pure Logic Service** (`CityVisibilityService`)

- No Leaflet dependencies
- Fully unit testable
- Deterministic: same input → same output

### 2. **Robust Score Calculation**

Ensures major cities like Paris rank above small communes even without population data:

```typescript
score = baseScore + majorCityBonus
baseScore = (population > 0) ? log10(population) : 0
majorCityBonus = MAJOR_CITIES_BONUS[cityName.toLowerCase()] ?? 0
```

**Major Cities Bonus Map:**

- Paris: +5
- Marseille, Lyon: +4
- Toulouse, Nice, Nantes, Montpellier, Strasbourg, Bordeaux, Lille: +3

This ensures **Paris is always visible before small communes** even if population is missing.

### 3. **Zoom Tier System**

Four tiers with progressive limits:

| Tier | Zoom Range | Max Cities | Grid Cell Size | Cities/Cell |
|------|------------|------------|----------------|-------------|
| T0   | 0-6        | 50         | 220px          | **2** (reduced eviction) |
| T1   | 6-8        | 200        | 180px          | 1           |
| T2   | 8-10       | 800        | 140px          | 1           |
| T3   | 10-24      | 3000       | 110px          | 2           |

T0 increased to 2 cities/cell to reduce bucket eviction at country-wide view.

### 4. **Stable Tie-Breaker**

Sorting order (consistent everywhere):

1. Score DESC (majorCityBonus + log10(population))
2. Population DESC (undefined = -1)
3. Name ASC
4. ID ASC

### 5. **Grid-Based Distribution**

- Projects cities to screen space
- Groups by grid cells
- Limits cities per cell (2 for T0, 1 for T1-T2, 2 for T3)
- Prevents visual overcrowding

### 6. **Hysteresis**

- Prevents tier flickering
- 0.3 zoom unit margin
- Stable transitions

### 7. **Overscan**

- 1.2× viewport bbox
- Reduces flicker on panning
- Pre-loads nearby cities

### 8. **Stickiness** (Optional)

- Keeps cities visible for 450ms
- Requires 1.15× score to replace
- Smooth transitions

## Usage

### Basic Integration

The map component automatically uses the visibility system:

```typescript
// Map component already wired up
private updateVisibleCities(): void {
  this.cityVisibility.updateVisibleCities(
    this.map,
    this.allCities,
    (visibleCities) => {
      // Update markers via diffing
      this.updateMarkerDiff(visibleCities);
    }
  );
}
```

### Configuration

Edit [city-visibility.config.ts](src/app/core/services/city-visibility.config.ts):

```typescript
// Major cities with bonuses (POC: hardcoded whitelist)
export const MAJOR_CITIES_BONUS: Record<string, number> = {
  'paris': 5,
  'marseille': 4,
  'lyon': 4,
  'toulouse': 3,
  'nice': 3,
  'nantes': 3,
  'montpellier': 3,
  'strasbourg': 3,
  'bordeaux': 3,
  'lille': 3
};

export const ZOOM_TIERS: TierConfig[] = [
  {
    id: 'T0',
    minZoom: 0,
    maxZoom: 6,
    targetMaxVisibleCities: 50,    // Adjust budget
    gridCellSizePx: 220,            // Adjust spacing
    maxCitiesPerCell: 2             // Reduced eviction at low zoom
  },
  // ... more tiers
];

export const HYSTERESIS_MARGIN = 0.3;      // Tier transition margin
export const OVERSCAN_FACTOR = 1.2;        // Viewport overscan
export const STICKINESS_DURATION_MS = 450; // Keep cities visible
export const STICKINESS_SCORE_MULTIPLIER = 1.15; // Replacement threshold
```

## API Reference

### `CityVisibilityService`

#### `computeScore(city): number`

Calculate robust score combining population + major city bonus.

Returns: `log10(population) + bonus` or just `bonus` if population missing.

#### `computeVisibleCities(input): Result`

Main computation function.

**Input:**

```typescript
{
  cities: City[];
  zoom: number;
  viewport: BBox;
  projection: ProjectionFn;
  tierState: TierState;
  visibilityState: VisibilityState | null;
}
```

**Output:**

```typescript
{
  visibleCities: City[];
  tierState: TierState;
  visibilityState: VisibilityState;
}
```

#### `getTierForZoom(zoom, state): { tier, state }`

Determine tier with hysteresis.

#### `computePriority(city): number` (deprecated)

Legacy: Calculate city priority. Use `computeScore` instead.

#### `debugCityVisibility(cityName, cities, zoom, projection): void`

**Dev-only helper.** Logs debugging information for a city:

- Computed score
- Grid bucket key
- Top 10 cities in that bucket with scores

**Example:**

```typescript
service.debugCityVisibility('Paris', allCities, 5, map.latLngToContainerPoint.bind(map));
```

Output:

```
[CityVisibility Debug] Paris:
  Score: 5
  Tier: T0 (maxCitiesPerCell: 2)
  Bucket Key: 652,380
  Cities in bucket (top 10):
    1. Paris (score: 5.00, pop: N/A) <-- TARGET
    2. Alfortville (score: 4.63, pop: 43000)
    ...
```

### `CityVisibilityLeafletService`

#### `updateVisibleCities(map, cities, onUpdate)`

Update visible cities based on map state.

**Parameters:**

- `map: L.Map` - Leaflet map instance
- `cities: City[]` - All cities
- `onUpdate: (cities: City[]) => void` - Callback with visible cities

#### `reset()`

Reset visibility state (call when city data changes).

## Performance

### Characteristics

- **O(n log n)** for sorting
- **O(n)** for grid distribution
- **O(k)** for marker updates (k = changes only)
- **Debounced**: 150ms on moveend/zoomend

### Optimizations

1. **Diff-based updates**: Only add/remove changed markers
2. **Grid bucketing**: Reduces comparisons
3. **Overscan**: Reduces recomputation frequency
4. **Stickiness**: Smooths transitions

## Testing

### Unit Tests

Test files included:

- `city-visibility.service.spec.ts.example` - Original tests
- `city-visibility.service.new.spec.ts.example` - Updated tests with major city bonus coverage

**Coverage:**

**Score/Ranking Tests:**

- ✅ Major city bonuses (Paris +5, Marseille +4, etc.)
- ✅ Case-insensitive name matching
- ✅ Score > population ranking
- ✅ Paris ranks above small communes (even without population)
- ✅ Score determinism

**Budget/Distribution Tests:**

- ✅ Determinism (same input → same output)
- ✅ Budget limits respected
- ✅ Grid distribution
- ✅ T0: maxCitiesPerCell = 2 (reduced eviction)
- ✅ Tie-breaker stability (score → population → name → id)
- ✅ Tier hysteresis
- ✅ Viewport filtering
- ✅ State updates

**Specific Scenarios:**

- ✅ Paris visible before Alfortville (population missing)
- ✅ Paris selected in crowded grid cell
- ✅ Debug helper works correctly

**To run (requires test framework setup):**

```bash
# Install testing dependencies first
pnpm add -D jest @types/jest
# Configure Jest for Angular
# Then: pnpm test
```

## Examples

### Score Calculation Examples

```typescript
computeScore({ name: 'Paris', population: 2161000 })
// = log10(2161000) + 5 = 6.33 + 5 = 11.33

computeScore({ name: 'Paris' })
// = 0 + 5 = 5 (even without population!)

computeScore({ name: 'Marseille', population: 869815 })
// = log10(869815) + 4 = 5.94 + 4 = 9.94

computeScore({ name: 'Alfortville', population: 43000 })
// = log10(43000) + 0 = 4.63 (no bonus, not major city)

computeScore({ name: 'UnknownSmallTown', population: 500 })
// = log10(500) + 0 = 2.70
```

**Result:** Paris (11.33) > Marseille (9.94) > Alfortville (4.63) ✓

### Zoom Behavior

**Zoom 5 (T0):**

- Shows ~50 major cities
- Large spacing (220px grid)
- **2 cities per cell** (reduced eviction)
- Paris + nearby medium city visible

**Zoom 7 (T1):**

- Shows ~200 cities
- Medium spacing (180px)
- 1 city per cell
- More major cities, regional centers visible

**Zoom 9 (T2):**

- Shows ~800 cities
- Smaller spacing (140px)
- 1 city per cell
- Most significant communes visible

**Zoom 12 (T3):**

- Shows ~3000 cities
- Tight spacing (110px)
- 2 cities per cell allowed
- All small towns visible

### Priority Examples (deprecated)

```typescript
// Old computePriority - no longer used
computePriority({ population: 2161000 })  // 6.33 (log10)
computePriority({ population: 100000 })   // 5.00
computePriority({ population: 1000 })     // 3.00
computePriority({ population: undefined }) // 1.00

// Use computeScore instead - includes major city bonus
computeScore({ name: 'Paris' })           // 5.0 (no pop, but bonus)
computeScore({ name: 'Alfortville', population: 43000 })  // 4.63
```

## Migration from Clustering

**Before:**

```typescript
private clusterLayer: L.MarkerClusterGroup;
await import("leaflet.markercluster");
this.clusterLayer = L.markerClusterGroup();
```

**After:**

```typescript
private cityLayer: L.LayerGroup;
this.cityLayer = L.layerGroup();
// Visibility handled by CityVisibilityService
```

## Troubleshooting

### Paris not visible / minor cities showing instead

**Issue:** City ranking is wrong, major cities not prioritized.

**Solution:**

1. Check city is in `MAJOR_CITIES_BONUS` map
2. Name matching is case-insensitive but must match exactly (trim first)
3. Use debug helper to check score:

```typescript
service.debugCityVisibility('Paris', allCities, mapZoom, projection);
```

### Paris visible but Alfortville also appears (redundant)

**Issue:** Too many small cities visible, visual clutter.

**Solution:**

1. Reduce `maxCitiesPerCell` for higher tiers
2. Lower `targetMaxVisibleCities` budget
3. Increase `gridCellSizePx` to create larger cells

### Cities disappearing when panning slightly

**Issue:** Viewport changes trigger too much flicker.

**Solution:**

1. Increase `OVERSCAN_FACTOR` (default 1.2)
2. Increase `STICKINESS_DURATION_MS` (default 450ms)
3. Increase `STICKINESS_SCORE_MULTIPLIER` (default 1.15)

### Tier transitions feel abrupt

**Issue:** Cities appear/disappear between zoom 6-8.

**Solution:**

1. Increase `HYSTERESIS_MARGIN` (default 0.3)
2. Review tier boundaries

## Future Enhancements

Potential improvements:

- [ ] Expand major cities list via inseeCode matching
- [ ] Admin level integration (when available)
- [ ] Adaptive grid sizing based on map size
- [ ] Label collision detection
- [ ] Performance profiling dashboard
- [ ] Web Worker for large datasets
- [ ] Importance scoring (prefecture, sous-préfecture, etc.)

## License

Part of the Choisir sa Ville project.
