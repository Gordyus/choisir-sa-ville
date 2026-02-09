# Task — SSMSI : performance rendu carto “insécurité” (choroplèthe communes)

## Problème observé

Le mode “insécurité” ralentit fortement l’application :
- (a) au moment d’activer le toggle (freeze / gros spike),
- (b) pendant la navigation carte (pan/zoom) en mode choroplèthe.

Signal de diagnostic confirmé : un rendu “couleur fixe” (sans coloration par commune) améliore largement les performances.

## Root cause (identifiée)

### 1) Expression MapLibre trop volumineuse (cause principale)

L’implémentation actuelle de la coloration “insécurité” construit une expression MapLibre de type :
- `["match", ["get","insee"], "01001", "#…", "01002", "#…", ..., defaultColor]`

Elle contient une entrée par commune (≈ **35k**), ce qui provoque :
- un coût important au toggle : construction JS + compilation de l’expression côté MapLibre,
- un coût récurrent au pan/zoom : évaluation de l’expression lors du rendu (tuiles qui entrent/sortent du viewport).

### 2) Coût GPU du fill semi-transparent (facteur aggravant)

Le choroplèthe repose sur un `fill-opacity` non nul (ex: ~0.25). Un fill semi-transparent augmente le coût GPU (blending/composition alpha) quand une grande surface de pixels est couverte (notamment à faible zoom).

## Solutions envisagées

### 1) (Retenue MVP) Choroplèthe via `feature-state` (viewport-only)

Remplacer le “match géant INSEE→couleur” par :
- une expression **très courte** basée sur `feature-state.insecurityLevelCode` (0..3) → palette,
- une mise à jour **uniquement pour les features rendues** à l’écran.

Mécanique :
- Lors de l’activation du mode :
  - charger les métriques (Map `insee -> level` / `insee -> code`),
  - appliquer les expressions “feature-state” sur `fill-color` et `line-color` (ligne conservant la priorité `active > highlight`).
- Sur événements viewport **strictement** `moveend` + `zoomend` (règle projet) :
  - `queryRenderedFeatures({ layers: [communesFill] })` pour obtenir les features visibles,
  - lookup par `insee`,
  - `setFeatureState` pour fixer `insecurityLevelCode` sur les features visibles.

Optimisations requises (mobile-friendly) :
- **Batch** des `setFeatureState` (ex: 200–500 / frame) via `requestAnimationFrame` pour éviter de bloquer le main-thread.
- **Cache** `insee -> dernierCodeAppliqué` pour éviter les writes inutiles.
- Ne jamais tenter d’appliquer le state pour les ~35k communes (viewport-only).

Avantages :
- supprime le coût “expression géante” (toggle + pan/zoom),
- coût proportionnel au nombre de features visibles,
- compatible avec l’architecture statique (pas de backend).

### 2) Bake de la classe dans un tileset (solution perf maximale, plus lourde)

Produire un tileset communes contenant directement `insecurityLevelCode` en propriété, puis styler via `["get","insecurityLevelCode"]`.

Avantages :
- perf maximale : pas de boucle `setFeatureState`, style trivial.

Inconvénients :
- nécessite un pipeline tiles (MBTiles/PMTiles/tileserver) + versioning/année,
- plus de travail infra/pipeline que le MVP.

### 3) Réduction du niveau de détail / généralisation géométrique

Réduire le niveau de détail des polygones peut améliorer :
- CPU/mémoire (moins de sommets),
- GPU (moins de géométrie à rasterizer).

Mais cela ne supprime pas la cause principale si le style reste un “match” géant.
À considérer en complément, surtout pour mobile (coarse pointer).

### 4) Rendu conditionné par zoom (complément UX/perf)

En mode insécurité :
- augmenter `minzoom` du fill (ex: n’afficher le choroplèthe communes qu’à partir de z≥10/11),
- ou afficher une agrégation coarse (département/région) à faible zoom.

## Décision (MVP)

On retient :
1) **Solution 1** : choroplèthe “insécurité” via `feature-state` (viewport-only) avec batching + cache.
2) **Mobile** : suppression de la transparence en rendant le fill **opaque** (`fill-opacity = 1`) pour réduire le coût de blending.

Notes :
- Desktop peut conserver une opacité plus faible si le rendu le nécessite, mais mobile doit prioriser la fluidité.

## Portée (implémentation attendue)

- `apps/web/lib/map/state/displayBinder.ts`
  - remplacer l’expression `match` par une expression compacte “feature-state code → palette”,
  - ajouter un handler viewport sur `moveend` + `zoomend` pour appliquer les states aux features visibles,
  - batching + cache.
- Détection “mobile”
  - recommandé : `matchMedia("(pointer: coarse)")` (fallback éventuel largeur écran) pour choisir `fill-opacity`.

## Critères d’acceptation

- Toggle “insécurité” :
  - pas de freeze notable (ressenti fluide, pas de long task visible),
  - pas de pic mémoire disproportionné.
- Pan/zoom en mode insécurité :
  - navigation fluide, sans stutter lors du chargement de nouvelles tuiles.
- Mobile (`pointer: coarse`) :
  - amélioration visible (moins de drops de frames),
  - fill opaque appliqué.
- Pas de régression sur `highlight/active` (priorité `active > highlight > ...`).

## Plan de validation

- Desktop :
  - activer/désactiver le mode à différents zooms (autour de la plage communes),
  - pan/zoom + arrêts (vérifier que les updates n’arrivent que sur `moveend/zoomend`).
- Mobile (device ou emulateur) :
  - mêmes scénarios + vérification de `fill-opacity = 1`.
- Mesures :
  - Chrome DevTools Performance (toggle + navigation) : scripting, rendering, long tasks.

