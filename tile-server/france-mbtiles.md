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

### 6.1 OSM Labels (france.mbtiles)

- OSM `place` labels are kept **unchanged** in `france.mbtiles`
- Native `feature.id` is preserved
- Properties kept:
  - `name`
  - `class`
  - `rank` (if present)

**However**, OSM `place_label*` layers are removed at runtime by the style pipeline
(Step 3.5 in `stylePipeline.ts`) because they are replaced by our custom labels.

### 6.2 Custom Commune Labels (commune-labels.mbtiles)

Custom labels are generated from our own `indexLite.json` dataset to guarantee
100% coverage of all 34,870 French communes.

**Source**: `packages/importer` → `export:labels-geojson` → `commune-labels.geojson`

**Generation**:
```bash
# Step 1: Export GeoJSON from indexLite
pnpm --filter @choisir-sa-ville/importer export:labels-geojson

# Step 2: Generate MBTiles with Tippecanoe (Docker)
docker run --rm -v "tile-server:/data" klokantech/tippecanoe tippecanoe \
  -o /data/data/commune-labels.mbtiles \
  -Z0 -z14 -r1 --force \
  --no-feature-limit --no-tile-size-limit \
  --no-tile-compression \
  --layer=commune_labels \
  /data/tmp/commune-labels.geojson
```

**Properties per feature**:
- `insee` — INSEE code (used as feature ID via `promoteId`)
- `name` — commune name
- `population` — for density-based display and `symbol-sort-key`

**Key Tippecanoe flags**:
- `-r1` — drop-rate=1, essential to prevent feature dropping at low zooms
- `-Z0 -z14` — zoom range 0 to 14
- `--no-feature-limit --no-tile-size-limit` — prevents tile caps from removing features
- `--no-tile-compression` — required for tileserver-gl compatibility

**Frontend integration** (`communeLabelsVector.ts`):
- Progressive density: megacities at z0, all communes at z12+
- Population-based text sizing via `step` expressions
- Feature-state: `hasData` (always `true`), `highlight`, `active`

**Runtime optimization**: Since these labels come from our own dataset, entity
resolution uses the `insee` code directly (via `promoteId`) instead of the expensive
name → normalize → index search → distance pipeline. `hasData` is always `true`.

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

- `france.mbtiles` must remain **product-agnostic** (neutral OSM data)
- Commune labels use **custom MBTiles** generated from `indexLite.json` (not OSM)
- No data joins or enrichment baked into tiles
- No interaction flags baked into tiles
- Runtime owns all product logic (feature-state for `hasData`, `highlight`, `active`)

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
