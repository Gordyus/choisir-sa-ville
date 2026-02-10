# Architecture du projet (basée sur le code)

## Vue d’ensemble

Le projet est Jamstack :
- le pipeline `packages/importer` génère des datasets statiques dans `apps/web/public/data/`
- l’app Next.js (`apps/web`) sert ces fichiers et exécute uniquement de la logique frontend (MapLibre + UI)
- il n’existe pas d’API backend applicative ni de base de données au runtime

---

## Runtime (apps/web)

### 1) Données – dataset versionné + pointeur “current”

Le runtime ne “devine” pas la version à charger : il lit un pointeur statique :
- `GET /data/current/manifest.json` (fichier : `apps/web/public/data/current/manifest.json`)
- puis charge les fichiers depuis : `/data/{datasetVersion}/...`

Code : `apps/web/lib/data/communesIndexLite.ts`, `apps/web/lib/data/infraZonesIndexLite.ts`.

Fichiers consommés aujourd'hui :
- `communes/indexLite.json` : index compressé (colonnes + rows)
- `infraZones/indexLite.json` : index compressé
- `communes/postalIndex.json` : mapping postal (usage futur/tech)
- `communes/metrics/*` : métriques au niveau commune (JSON)
- `transactions/addresses.geojson` : points de transactions DVF (GeoJSON, couche carte)
- `transactions/bundles/z15/{x}/{y}.json` : historiques de transactions par tuile
- `manifest.json` : méta + sources (dans chaque version)

### Fichiers par niveau géographique

Les métriques sont organisées par niveau géo sous des sous-dossiers dédiés :

```
communes/metrics/           — métriques au niveau commune
departements/metrics/       — métriques au niveau département (futur)
regions/metrics/            — métriques au niveau région (futur)
```

Chaque agrégat de métriques possède son propre sous-dossier (ex : `communes/metrics/insecurity/`), contenant :
- un fichier `meta.json` qui déclare le niveau géo et la stratégie de fallback
- un fichier `{year}.json` par année de données disponible

### Pattern `meta.json` — `geoLevel` et `fallbackChain`

Chaque `meta.json` d'agrégat décrit :
- `geoLevel` : le niveau géographique des données (ex : `"commune"`)
- `fallbackChain` : liste ordonnée des niveaux parents vers lesquels le runtime peut remonter si la donnée est absente à ce niveau (ex : `["department", "region"]`)

Le runtime résout les données pour une entité en remontant la chaîne de fallback declarée dans `meta.json`. Cette résolution se fait au runtime, pas au build time — les données ne sont jamais dupliquées.

Exemple pour l'agrégat insécurité au niveau commune :
```json
{
  "geoLevel": "commune",
  "fallbackChain": []
}
```
`fallbackChain` vide signifie que si la commune n'a pas de donnée, aucun fallback n'est tenté (la valeur reste `null`). Dans le futur, un agrégat au niveau IRIS pourrait fallback vers la commune puis vers le département.

### Agrégats connus

| Agrégat | Dossier | Status | Notes |
|---|---|---|---|
| **Insécurité (SSMSI)** | `communes/metrics/insecurity/` | **Actif** | Quartiles + level baked, viewport-only rendering |
| Core (INSEE) | `communes/metrics/core.json` | Placeholder | Colonnes area/density (nulls) |
| Housing | `communes/metrics/housing.json` | Placeholder | Colonnes rent (nulls) |

### Transactions DVF

Les données de transactions immobilières proviennent de **DVF géolocalisées** (Etalab, `files.data.gouv.fr/geo-dvf`).
Le pipeline télécharge les fichiers CSV par département et par année (cache incrémental avec TTL).
Les données sont servies sous `transactions/` :
- `addresses.geojson` : points géolocalisés des adresses avec transactions (couche MapLibre)
- `bundles/z15/{x}/{y}.json` : historiques complets partitionnés par tuile WebMercator

Source : `packages/importer/src/exports/transactions/dvfGeoDvfSources.ts`
Spec de référence : `docs/feature/transactions-address-history/spec.md`

**Insécurité (SSMSI)** :
- **Population source** : `insee_pop` du Parquet SSMSI (pas de fallback ZIP INSEE)
- **Niveaux** : 0–4 (Très faible → Plus élevé), quartiles calculés sur `scoreRaw > 0`, baked au build-time
- **Rendu carto** : Feature-state viewport-only (moveend + zoomend), pas de match géant
- **Performance** : Batching RAF (200 features/frame), adaptive opacity mobile
- **Documentation** : Voir `docs/METRICS_INSECURITY.md`

### 2) Config runtime (JSON)

Le frontend charge deux configs statiques :

- `GET /config/map-tiles.json` (`apps/web/public/config/map-tiles.json`)
  - style URL MapLibre
  - TileJSON URLs (sources vector)
  - `interactableLabelLayerId` (ID de la couche “symbol” utilisée pour les interactions)
  - sources polygones `communes` et `arr_municipal` (TileJSON + source-layer)

- `GET /config/app-debug.json` (`apps/web/public/config/app-debug.json`)
  - toggles debug (tile boundaries, collision boxes, logs)

### 3) Sélection (headless)

`apps/web/lib/selection/selectionService.ts` est la source de vérité de l’état :
- `highlighted` (au survol / focus)
- `active` (sélection)

Les composants React consomment cet état via `apps/web/lib/selection/hooks.ts`.

### 4) Carte (MapLibre)

Point d’entrée UI : `apps/web/components/vector-map.tsx`.

Chargement du style :
- `apps/web/lib/map/style/stylePipeline.ts`
  - charge le style de base (`styleUrl`)
  - supprime les couches dont le `source-layer` n’existe pas (TileJSON inspection)
  - applique un styling feature-state sur la couche de labels interactive
  - injecte les couches polygones (communes/arr_municipal) avant les labels

Interactions :
- `apps/web/lib/map/mapInteractionService.ts`
  - “label-first” : hit-test sur la couche `interactableLabelLayerId`
  - résolution d’entité par nom normalisé + index lites
  - `moveend`/`zoomend` déclenchent l’évaluation `hasData` sur les labels visibles
  - synchronisation `feature-state` ↔ `SelectionService` (flags `hasData`, `highlight`, `active`)

---

## Build time (packages/importer)

Commande :
```bash
pnpm --filter @choisir-sa-ville/importer export:static
```

Effets :
- écrit un dataset `apps/web/public/data/vYYYY-MM-DD/`
- écrit/met à jour `apps/web/public/data/current/manifest.json` (pointeur runtime)

Code : `packages/importer/src/exports/exportDataset.ts`.

