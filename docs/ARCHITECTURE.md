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
| **Insécurité (SSMSI)** | `communes/metrics/insecurity/` | **Actif** | Percentile simple [0..100], levels baked, viewport-only rendering |
| Core (INSEE) | `communes/metrics/core.json` | Actif | |
| Housing | `communes/metrics/housing.json` | Actif | |

**Insécurité (SSMSI)** :
- Source: Bases SSMSI (ministère de l'intérieur)
- Calcul: Score pondéré (40% violences, 35% biens, 25% tranquillité)
- Classification par taille de population (3 catégories)
- Double indexGlobal: [0..100] national + [0..100] catégorie
- Niveaux [0..4] basés sur percentiles catégorie
- Unité: Faits pour 100,000 habitants
- **Rendu carto** : Feature-state viewport-only (moveend + zoomend), pas de match géant
- **Performance** : Batching RAF (200 features/frame), adaptive opacity mobile
- **Documentation** : Voir `docs/METRICS_INSECURITY.md`
- **Configuration partagée** : `INSECURITY_CATEGORIES` et `INSECURITY_LEVELS` dupliqués dans `packages/importer/src/exports/shared/insecurityMetrics.ts` et `apps/web/lib/config/insecurityMetrics.ts` (acceptable car packages Node/React isolés; centraliser si 3e package dépend)

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
  - supprime les labels OSM `place_label*` (remplacs par nos labels custom)
  - applique un styling feature-state sur la couche de labels interactive
  - injecte les couches polygones (communes/arr_municipal) avant les labels
  - injecte les labels custom communes (`commune_labels` depuis `commune-labels.mbtiles`)
  - injecte les labels arrondissements (`arr_municipal_labels` depuis `arr_municipal.mbtiles`)

Labels custom (tuiles vecteur) :
- `apps/web/lib/map/layers/communeLabelsVector.ts`
  - Source : `commune-labels.mbtiles` (34 870 communes, z0-z14)
  - Densit progressive par population (megacities z0, villages z12+)
  - Feature-state : `hasData`, `highlight`, `active`
- `apps/web/lib/map/layers/arrMunicipalLabelsVector.ts`
  - Source : `arr_municipal.mbtiles` (arrondissements Paris/Lyon/Marseille, z11+)
  - Feature-state : `hasData`, `highlight`, `active`

Interactions :
- `apps/web/lib/map/mapInteractionService.ts`
  - label-first : hit-test sur les couches `commune_labels` + `arr_municipal_labels`
  - rsolution d’entit par code INSEE (sources propres) ou nom normalis (sources OSM)
  - `moveend`/`zoomend` dclenchent l’valuation `hasData` sur les labels visibles
  - labels issus de nos sources propres  `hasData` toujours `true` (pas de rsolution par nom)
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

