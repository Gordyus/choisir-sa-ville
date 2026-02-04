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

Fichiers consommés aujourd’hui :
- `communes/indexLite.json` : index compressé (colonnes + rows)
- `infraZones/indexLite.json` : index compressé
- `communes/postalIndex.json` : mapping postal (usage futur/tech)
- `communes/metrics/*` : métriques au niveau commune (JSON)
- `manifest.json` : méta + sources (dans chaque version)

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

