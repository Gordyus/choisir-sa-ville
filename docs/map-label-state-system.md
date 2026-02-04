# Map Label State System – Technical Reference

## Purpose
This document describes the **agnostic label state system** used for map interactions.
It replaces UI-driven notions such as *hover* and *selected* with **product-level states**:
`default`, `highlight`, and `active`.

The system is designed for MapLibre GL JS and relies exclusively on:
- Native OSM label layers
- `feature-state` for runtime state
- Application indexes for data knowledge (`hasData`)

---

## Core Principles

1. **OSM labels are the single source of truth for rendering**
   - Layers:
     - `place_label_city`
     - `place_label_other`
   - No custom label layers
   - No label duplication
   - OSM handles priority, collision, and zoom behavior

2. **All interaction state is runtime-only**
   - Stored in MapLibre `feature-state`
   - No mutation of vector tile data
   - No style branching based on application logic

3. **UI-agnostic state model**
   - The map does not know about mouse, hover, or click
   - It only reacts to abstract states:
     - `default`
     - `highlight`
     - `active`

---

## Feature-State Model

Each label feature may have the following `feature-state` flags:

```ts
type LabelFeatureState = {
  hasData?: boolean;
  highlight?: boolean;
  active?: boolean;
};
```

### Semantic Meaning

| State Flag | Meaning |
|-----------|--------|
| `hasData` | The label corresponds to an entity known by the product |
| `highlight` | The label is emphasized (focus, hover, search result, etc.) |
| `active` | The label represents the currently active entity |

---

## State Priority

Rendering priority is strictly defined as:

```
active > highlight > hasData > default
```

This priority is enforced **only in the style**, not in the application code.

---

## Style Logic (Conceptual)

All label styling is expressed via MapLibre expressions:

```json
[
  "case",
  ["boolean", ["feature-state", "active"], false],
  "<active-style>",

  ["boolean", ["feature-state", "highlight"], false],
  "<highlight-style>",

  ["boolean", ["feature-state", "hasData"], false],
  "<hasData-style>",

  "<default-style>"
]
```

This pattern applies consistently to:
- `text-color`
- `text-halo-color`
- `text-halo-width`
- (optionally) `text-opacity`

---

## Determining `hasData`

### Problem
OSM place labels do **not** expose INSEE codes or product identifiers.

### Solution
`hasData` is computed **at runtime** using application indexes:

- Communes index
- InfraZones / arrondissements index

Resolution is based on:
- `feature.properties.name`
- `feature.properties.class` (`city`, `town`, `village`, `suburb`)
- Name normalization (case, accents, suffixes)

This lookup is:
- Best-effort
- Product-oriented
- Not used for routing or canonical identity

---

## Runtime Responsibilities

### State Manager (Single Authority)

A single map interaction service is responsible for:

- Tracking the currently highlighted label
- Tracking the currently active label
- Clearing previous states before setting new ones
- Applying `feature-state` changes via `map.setFeatureState(...)`

Invariants:
- At most **one** feature has `highlight=true`
- At most **one** feature has `active=true`

---

## Separation of Concerns

### Label vs Entity

- **Label**: a rendered OSM feature (MapLibre concern)
- **Entity**: a product concept (commune, arrondissement, etc.)

A label may:
- Exist without a product entity (`hasData=false`)
- Represent an entity not currently visible

The system never conflates these two notions.

---

## Role of Polygons

Administrative polygons (`communes`, `arr_municipal`) are used for:
- Click resolution
- Entity disambiguation
- Optional visual highlighting of areas

They are **never** used to render labels.

---

## Benefits of This Architecture

- No label duplication
- No manual priority management
- UI-agnostic interaction model
- Compatible with mouse, keyboard, search, routing
- Minimal runtime state
- Clear separation between rendering and product logic

---

## Non-Goals

This system does NOT attempt to:
- Rebuild a labeling engine
- Provide perfect administrative matching from OSM labels
- Encode business logic in the map style

---

## Summary

This label state system turns the map into a **pure rendering surface** driven by:
- Native OSM labels
- A small, explicit set of runtime states
- Product knowledge injected via `feature-state`

It is intentionally minimal, robust, and scalable.
