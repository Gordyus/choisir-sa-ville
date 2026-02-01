# INSEE Mapping for OSM City Labels

The frontend resolves commune highlights by converting the `osm_id` (or `wikidata`) carried in
MapLibre vector tiles into the official INSEE code. This avoids flickering identifiers between zoom
levels and enables consistent lookups in the local JSON datasets (e.g. `communes/indexLite`).

## File location & format

- **Path**: `apps/web/public/data/city-osm-insee.json`
- **Format**: JSON array, each entry shaped as:

  ```json
  {
    "osmId": 59720,
    "insee": "34172",
    "wikidata": "Q132894"
  }
  ```

- `osmId` can be a number or string (we store it as-is in the map).
- `insee` must be a 5-character INSEE code (letters allowed for overseas departments).
- `wikidata` is optional but enables a second lookup path when `osm_id` switches between
  relation/node IDs.

The file ships in `public/` so it is fetched at runtime (cached by the browser) and can be updated
without recompiling the app.

## Loading lifecycle

1. `VectorMap` calls `initCityInseeIndex()` as soon as the MapLibre style finishes loading.
2. The index fetches `city-osm-insee.json`, validates a few sample entries, and builds two in-memory
   maps (`osmId → insee`, `wikidata → insee`).
3. The map interaction service resolves every click/hover identity via:
   - direct INSEE present in the tile feature;
   - otherwise `osm_id` lookup;
   - then `wikidata` lookup.
   A warning is logged if no INSEE can be determined.

## Regenerating the mapping

> ⚠️ Generator tooling is not part of this commit.

To refresh the mapping:

1. Export the latest `osm_id ↔ INSEE` table from your chosen source (e.g. PG dump, importer output).
2. Keep only the columns `osm_id`, `insee`, `wikidata` (if available).
3. Emit the JSON array file following the format above.
4. Replace `apps/web/public/data/city-osm-insee.json` and redeploy the web app.

At runtime the loader warns (once per minute) if the sample communes (Montpellier, Castelnau-le-Lez,
Lattes) are missing—use this as a smoke test after updating the file.
