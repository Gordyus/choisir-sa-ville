# Entity Graphics Binding (Labels + Polygons)

Cette note documente le binding entre les **entités du domaine** (`EntityRef`) et leurs **représentations graphiques** MapLibre (labels, polygones), ainsi que la répartition des responsabilités entre les services concernés.

Contexte : le projet suit une architecture stricte `selection / data / map / ui` (voir `CLAUDE.md`).

---

## Objectif

Une même entité (commune ou arrondissement municipal) peut être représentée sur la carte par plusieurs éléments :

- un **label** (texte "place" dans le style de base)
- un **polygone** (fill + line) issu d'un tile server (sources `communes` et `arr_municipal`)

Ces éléments doivent réagir de façon cohérente aux changements d'état de l'entité : aujourd'hui `highlight` (hover) et `active` (click). Demain : couleurs par zone, labels supplémentaires, etc.

Le binding est la brique fondamentale qui permet ces évolutions sans changer la logique d'interaction.

---

## Vocabulaire et états

### Entités (domaine)

Le type canonique est `EntityRef` :

- `commune` : `{ kind: "commune", inseeCode: string }`
- `infraZone` : `{ kind: "infraZone", id: string }` (inclut notamment les `ARM`)

### États visuels (MapLibre feature-state)

Le vocabulaire est strict (voir `CLAUDE.md`) :

- `hasData` : l'entité a des données (cliquable / "utile")
- `highlight` : hover ou focus
- `active` : entité sélectionnée

Ces flags sont appliqués via `map.setFeatureState(...)` et consommés dans le style par `["feature-state", "..."]`.

---

## Architecture : trois modules, trois responsabilités

```
mapInteractionService          — événements utilisateur uniquement
  mousemove → résoudre label → EntityStateService.setHighlighted()
  click     → résoudre label → EntityStateService.setActive()
  LabelHasDataEvaluator (viewport, hasData sur labels — voir note ci-dessous)
  expose getLabelTargetForEntity() pour le binder

EntityStateService             — source de vérité des états (renommage de SelectionService)
  highlighted / active
  subscribe / notify

EntityGraphicsBinder           — nouveau module (lib/map/entityGraphicsBinder.ts)
  subscribe EntityStateService
  résoudre tous les targets pour une entité (label + polygone)
  appliquer setFeatureState sur tous les targets
  gérer le "unset" des anciens targets (éviter le state stale)
```

### Principe fondamental du binder

Le binder est la **seule** place qui appelle `map.setFeatureState` pour `highlight` et `active`. Il ne dépend pas de React.

Il résout les targets d'une entité en deux étapes :

1. **Label target** — dynamique, dépend de ce qui est rendu à l'écran. Fourni par `LabelHasDataEvaluator` via `getLabelTargetForEntity()`. Peut être `null` si le label n'est pas visible.
2. **Polygon target** — déterministe, construit à partir du type d'entité. Pas besoin que le polygone soit rendu : si la feature n'est pas dans le tile pyramid, le `try/catch` autour de `setFeatureState` absorbe silencieusement.

```
EntityRef(commune, "75056")
  → label target  : { source: "france", sourceLayer: "place", id: <featureId> } | null
  → polygon target: { source: "communes", sourceLayer: "communes", id: "75056" }

EntityRef(infraZone, "paris-11e")
  → label target  : { source: "france", sourceLayer: "place", id: <featureId> } | null
  → polygon target: { source: "arr_municipal", sourceLayer: "arr_municipal", id: <armInseeCode> }
```

### Note sur `hasData`

`hasData` reste dans `mapInteractionService` via `LabelHasDataEvaluator`. C'est un cycle de vie différent : déclenché par le **viewport** (`moveend`/`zoomend`), pas par un changement d'état entité. Le binder ne gère pas `hasData`. Si demain on veut aussi appliquer `hasData` sur les polygones, c'est une extension de l'évaluateur.

---

## Ce qui bouge depuis `mapInteractionService`

| Aujourd'hui dans mapInteractionService | Destination |
|---|---|
| `selectionService.subscribe()` + sync highlight/active | EntityGraphicsBinder |
| `updateFeatureState` / `applyFeatureState` | EntityGraphicsBinder |
| `featureStateHandle` (tracking des anciens targets) | EntityGraphicsBinder |

| Reste dans mapInteractionService | Pourquoi |
|---|---|
| `mousemove` / `click` / `mouseleave` handlers | Événements utilisateur |
| `pickLabelFeature` + résolution label → EntityRef | Logique de détection interaction |
| `LabelHasDataEvaluator` | Cycle de vie viewport, pas état entité |

---

## Renommage SelectionService → EntityStateService

Le service `SelectionService` est renommé en `EntityStateService` pour refléter sa rôle : source de vérité de l'état des entités, pas uniquement de la "sélection" utilisateur.

Fichiers concernés par le renommage :

- `lib/selection/selectionService.ts` — le service + export `getSelectionService` → `getEntityStateService`
- `lib/selection/hooks.ts` — `useSelection()` reste (c'est le hook de consommation UI, le nom reste pertinent)
- `lib/selection/index.ts` — barrel exports
- `mapInteractionService.ts` — importe et utilise le service
- `components/` — consomment via hooks (pas de changement si `useSelection` reste)

Le dossier `lib/selection/` reste pour l'instant. Le renommage du dossier est cosmétique et peut être fait séparément.

---

## Index nécessaires (données)

### Communes

Les polygones communes sont identifiés par leur INSEE (`promoteId` configuré sur le champ `insee` dans `adminPolygons.ts`).

Mapping direct, pas d'index nécessaire :

- `EntityRef(kind=commune, inseeCode)` → `polygonId = inseeCode`

### Arrondissements municipaux (ARM)

Les polygones `arr_municipal` sont aussi promus avec le champ `insee`. Côté domaine, un ARM est adressé comme `infraZone` par `id`.

Index nécessaire : `armInseeCode ↔ infraZone.id`

- **Confirmé** : le champ `code` dans `InfraZoneIndexLiteEntry` correspond au champ `insee` promu sur les tuiles `arr_municipal`.
- **Source** : `infraZonesIndexLite.ts` — index déjà chargé côté client.
- **Règle** : filtrer sur `type === "ARM"`, construire un `Map<inseeCode, infraZoneId>` et un `Map<infraZoneId, inseeCode>` (bi-directionnel).
- **Cycle de vie** : construit une fois, en mémoire, pas de coût récurrent.

---

## Politique d'interaction (aujourd'hui)

Les polygones sont **passifs** aujourd'hui : ils réagissent aux changements d'état mais ne déclenchent pas d'interaction. L'interaction reste **label-first**.

- `mousemove` sur un label → highlight sur le label ET le polygone associé
- `click` sur un label → active sur le label ET le polygone associé
- `mousemove` sur un polygone seul (pas de label) → rien (pour l'instant)

Le fallback polygone (interaction déclenchée depuis un polygone) est hors scope de cette phase.

---

## Checklist d'implémentation

- `SelectionService` est renommé en `EntityStateService` (`getEntityStateService`).
- `useSelection()` reste (hook UI, nom pertinent).
- `EntityGraphicsBinder` vit dans `lib/map/`, ne dépend pas de React.
- Le binder est la **seule** place qui appelle `setFeatureState` pour `highlight`/`active`.
- `mapInteractionService` ne garde que les handlers d'événements et la résolution label → EntityRef.
- Les polygon targets sont construits de façon déterministe à partir de l'EntityRef + config des sources.
- L'index ARM (`code ↔ id`) vit dans `lib/data/` (extension de `infraZonesIndexLite.ts`).
- `hasData` reste dans `LabelHasDataEvaluator`, pas touché par ce changement.
- Pas d'événements `move` sur la carte (seulement `moveend`/`zoomend`).
- `try/catch` autour de tout `setFeatureState` (features peuvent sortir du tile pyramid).
