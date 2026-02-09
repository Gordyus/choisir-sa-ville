# France Vector Tiles – Build README

This document describes exactly how to rebuild the France vector tiles (MBTiles)
used by the application, covering zoom levels **0 → 13**.

The pipeline is intentionally **neutral**:
- no product logic
- no INSEE joins for labels
- no interaction semantics baked into tiles

All interaction (`hasData`, `highlight`, `active`) is handled at runtime via
MapLibre **feature-state**.

---

## 1. Objective

Generate a single `france.mbtiles` file that:
- covers metropolitan France
- supports MapLibre GL JS
- contains OSM labels (`place`) with stable `feature.id`
- contains official administrative geometries (communes, arrondissements)
- is suitable for self-hosted tile servers

---

## 2. Tools Required

### Mandatory
- **Tippecanoe**
- **GDAL / ogr2ogr**
- **Node.js** (only if preprocessing scripts are used)

### Optional
- `jq`
- `mapshaper`

---

## 3. Input Data Sources

### 3.1 OpenStreetMap

Source:
- Geofabrik France extract (`.osm.pbf`)

Used for:
- place labels
- roads
- landuse
- POIs
- generic boundaries

No product enrichment is applied.

---

### 3.2 Administrative Boundaries (Official)

Used for correctness and stability.

#### Communes
- Source: INSEE / IGN
- Properties kept:
  - `insee`
  - `name`

#### Arrondissements municipaux
- Paris, Lyon, Marseille
- Properties kept:
  - `code`
  - `name`
  - `parentCommuneCode`

---

## 4. Data Preparation

### 4.1 Projection

All layers must be in **EPSG:4326**.

```bash
ogr2ogr -t_srs EPSG:4326 communes.geojson communes_raw.shp
```

---

### 4.2 Geometry Validation

```bash
ogr2ogr -makevalid communes_valid.geojson communes.geojson
```

Remove:
- invalid geometries
- duplicated features
- unused properties

---

### 4.3 Layer Separation

Each dataset is exported as a **single logical layer**:
- `place`
- `communes`
- `arr_municipal`

---

## 5. Tippecanoe Tile Generation

### 5.1 Core Command

```bash
tippecanoe \
  -o france.mbtiles \
  -Z0 -z13 \
  --force \
  --read-parallel \
  --drop-densest-as-needed \
  --extend-zooms-if-still-dropping \
  --coalesce-densest-as-needed \
  --no-tile-compression \
  --name="France Vector Tiles" \
  \
  --layer=place:place.geojson \
  --layer=communes:communes.geojson \
  --layer=arr_municipal:arr_municipal.geojson
```

---

## 6. Label Handling (Critical Design Choice)

- OSM `place` labels are kept **unchanged**
- Native `feature.id` is preserved
- Properties kept:
  - `name`
  - `class`
  - `rank` (if present)

Explicitly NOT done:
- no INSEE join
- no product metadata
- no interaction flags

All interaction logic is **runtime-only**.

---

## 7. Output

Resulting file:
```
france.mbtiles
```

Contains:
- vector tiles for zoom 0 → 13
- neutral, reusable cartographic data

---

## 8. Serving the Tiles

Common servers:
- `tileserver-gl`
- `martin`
- custom HTTP tile server

Endpoint example:
```
/tiles/france/{z}/{x}/{y}.pbf
```

Use long HTTP cache headers.

---

## 9. MapLibre Integration

### Vector Source
```json
{
  "type": "vector",
  "url": "/tiles/france.json"
}
```

### Interaction Rules
- All interactivity uses `feature-state`
- States:
  - `hasData`
  - `highlight`
  - `active`
- Priority:
  `active > highlight > hasData > default`

No business logic lives in the style.

---

## 10. Architectural Invariants (Do Not Break)

- Tiles must remain **product-agnostic**
- Labels must remain **OSM-driven**
- No joins or enrichment in tiles
- No interaction baked into tiles
- Runtime owns all product logic

---

## 11. Rebuild Checklist

- [ ] OSM extract downloaded
- [ ] Admin boundaries validated
- [ ] Layers normalized
- [ ] Tippecanoe run (z0–z13)
- [ ] MBTiles tested in tile server
- [ ] MapLibre style unchanged

---

## 12. Summary

The tiles are:
- neutral
- stable
- reproducible
- interaction-ready

All intelligence lives in the **application runtime**, not in the tiles.
