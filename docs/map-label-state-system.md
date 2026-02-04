# Map Label State System – Technical Reference

## Purpose

This document describes the **label state model** used by the MapLibre layer targeted by
`interactableLabelLayerId` (configured in `apps/web/public/config/map-tiles.json`).

The map interaction layer is UI-agnostic and relies on `feature-state` flags:
`hasData`, `highlight`, `active`.

## Feature-State model

```ts
type LabelFeatureState = {
  hasData?: boolean;
  highlight?: boolean;
  active?: boolean;
};
```

Priority:

```
active > highlight > hasData > default
```

## Runtime responsibilities

- Resolve label → entity via name normalization + “indexLite” datasets
- Maintain at most one highlighted and one active feature at a time
- Apply `feature-state` via `map.setFeatureState(...)`

Code references:
- `apps/web/lib/map/mapInteractionService.ts`
- `apps/web/lib/map/style/stylePipeline.ts`
- `apps/web/lib/map/layers/interactableLabelStyling.ts`

