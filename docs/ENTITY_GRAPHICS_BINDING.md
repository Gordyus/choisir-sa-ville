# Entity Graphics Binding (Labels + Polygons)

Cette note documente la logique d'interaction et de synchronisation visuelle entre les **entités** du domaine (`EntityRef`) et leurs **représentations graphiques** MapLibre (labels, polygones).

Contexte: le projet suit une architecture stricte `selection / data / map / ui` (voir `AGENTS.md`).

---

## Objectif

Une même entité (commune ou arrondissement municipal) peut être représentée sur la carte par plusieurs éléments:

- un **label** (texte "place" dans le style de base)
- un **polygone** (fill + line) issu d'un tile server (sources `communes` et `arr_municipal`)

Ces éléments doivent:

- réagir de façon cohérente aux interactions utilisateur (hover/click)
- refléter le même état visuel centralisé (via `SelectionService`)

---

## Vocabulaire et états

### Entités (domaine)

Le type canonique est `EntityRef`:

- `commune`: `{ kind: "commune", inseeCode: string }`
- `infraZone`: `{ kind: "infraZone", id: string }` (inclut notamment les `ARM`)

### États visuels (MapLibre feature-state)

Le vocabulaire est strict (voir `AGENTS.md`):

- `hasData`: l'entité a des données (cliquable / "utile")
- `highlight`: hover ou focus
- `active`: entité sélectionnée

Ces flags sont appliqués via `map.setFeatureState(...)` et consommés dans le style par `["feature-state", "..."]`.

---

## Pourquoi "labels OK, polygones KO" (état actuel)

### 1) Interaction "label-only"

Le service `mapInteractionService` ne fait du hit-test que sur **un seul layer de labels** (config `interactableLabelLayerId`), via `queryRenderedFeatures(point, { layers: [labelLayerId] })`.

Conséquence:

- si le curseur est sur un polygone mais pas sur un label, aucune feature n'est détectée
- le highlight ne se déclenche pas sur les polygones
- le clic sur un polygone ne produit pas de sélection

### 2) Feature-state appliqué uniquement aux labels

La synchronisation `SelectionService -> map.setFeatureState` cible uniquement les features de labels, car le mapping interne construit est `EntityRef -> label FeatureStateTarget`.

Conséquence:

- même si les layers de polygones sont stylés avec `feature-state` (`highlight`/`active`), ils ne changent jamais, car on ne set jamais le state sur leurs IDs.

### 3) Arrondissements: mismatch d'identifiants

Les polygones `arr_municipal` sont promus/identifiés côté tuiles avec un champ de type **INSEE** (ex: propriété `insee`).

Mais côté domaine, un arrondissement est adressé comme une `infraZone` par `id`.

Sans index de mapping `insee <-> infraZone.id`, on ne peut pas:

- convertir un hit sur polygone `arr_municipal` en `EntityRef`
- appliquer `highlight/active` sur le bon polygone lorsqu'une `infraZone` est sélectionnée

---

## Architecture cible: binder "Entity ↔ Graphics"

### Principe

Centraliser dans `lib/map/` la traduction entre:

- une **entité** (`EntityRef`)
- les **targets MapLibre** à mettre à jour (labels + polygones)
- la **résolution** d'une interaction à un point (label-first, puis polygone fallback)

Cette brique ne doit pas dépendre de React, et ne doit pas charger de données métier lourde directement: elle s'appuie sur `SelectionService` et sur des index légers dans `lib/data/`.

### Module proposé

Créer un module (nom indicatif) `lib/map/entityGraphicsBinder.ts` avec 2 responsabilités:

1. Résolution d'interaction:

- `resolveEntityAtPoint(map, point) -> EntityRef | null`

Règle:

- étape 1: essayer les labels (chemin actuel)
- étape 2 (fallback): essayer les polygones (fill/line) pour la même réaction hover/click

2. Mapping entité -> feature-state targets:

- `getTargetsForEntity(map, entityRef) -> FeatureStateTarget[]`

Exemples:

- pour une commune: label target (si présent) + polygon fill/line target (si présent)
- pour un ARM: label target (si présent) + polygon target sur la source `arr_municipal` (nécessite mapping INSEE)

---

## Politique de hit-test (non négociable)

On conserve la règle produit/technique:

- **label-first**: chaque interaction commence par le hit-test sur les layers de labels

Mais on ajoute:

- **fallback polygone**: si aucun label n'est trouvé au point, on teste les layers de polygones

But:

- garder une interaction stable (labels sont la "surface primaire")
- rendre les polygones interactifs sans casser les règles de performance

---

## Synchronisation SelectionService -> MapLibre

Règle:

- `SelectionService` reste la source de vérité pour `highlighted` et `active`
- MapLibre doit être une projection de cet état sur plusieurs graphismes

Stratégie:

- sur chaque changement (subscribe), calculer les targets pour `highlighted` et pour `active`
- appliquer `setFeatureState` sur toutes les targets (labels + polygones)
- conserver un handle interne pour "unset" proprement les anciens targets (éviter le state stale)

Note:

- le module doit tolérer que des features sortent du tile pyramid (try/catch autour de `setFeatureState`).

---

## Index nécessaires (données)

### Communes

Les polygones communes peuvent être identifiés avec leur INSEE (champ `insee` promu en feature id).

Mapping:

- `EntityRef(kind=commune, inseeCode)` -> polygonId = `inseeCode`

### Arrondissements municipaux (ARM)

Nécessaire: un index `armInseeCode <-> infraZone.id`.

Source recommandée:

- `infraZones/indexLite.json` (déjà chargé côté client via `lib/data/infraZonesIndexLite.ts`)

Règle:

- limiter l'index aux entrées `type === "ARM"`
- stocker en mémoire (cache) pour éviter tout coût récurrent

---

## Recommandations de style pour l'interaction polygone

Le style actuel rend souvent les polygones "invisibles" en base (`opacity.base = 0`).

Si on veut une surface d'interaction fiable sans changer le rendu:

- ajouter un layer "hit" (fill) au-dessus des fills/lines admin
- `fill-opacity` très faible (ex: `0.001`) pour être hittable
- ce layer ne sert qu'au hit-test (pas au rendu visuel)

---

## Checklist d'implémentation (à respecter)

- Le hit-test reste `label-first`, fallback polygone uniquement si aucun label.
- Les states MapLibre restent: `hasData`, `highlight`, `active`.
- `SelectionService` reste la source de vérité.
- Le binder vit dans `lib/map/` et ne dépend pas de React.
- Les mappings nécessaires (ARM) vivent dans `lib/data/`.
- Pas d'événements `move` sur la carte (seulement `moveend`/`zoomend`).
- Dédup + annulation sur toute logique de fetch (si ajout futur).

