# Annexe — Layer Menu : Q&A + Roadmap

> Document de travail associé à `map-display-modes-layer-menu.md`.
> Produit par analyse architecturale (po-architect-gatekeeper) + lecture du code existant sur la branche `aggregat-insecurity`.
> Mis à jour après réponses du Product Owner sur Q1–Q7.

---

## Résumé des décisions du gatekeeper

| Décision | Statut |
|---|---|
| `MapDisplayModeService` comme service headless observable | VALIDE — même pattern que `EntityStateService` |
| Placement du service dans `lib/map/state/` | RÉSOLU — voir Q1 |
| Réutilisation de `insecurityMetrics.ts` sans modification | VALIDE — loader + cache + AbortSignal déjà en place |
| Coloration via `setPaintProperty` + expression `match` (pas via `setFeatureState`) | VALIDE — voir Q2 pour le détail |
| `MapLayerMenu` dans `components/` avec shadcn/ui | VALIDE |
| Interdiction d'ajouter un état `insecurityLevel` au vocabulaire feature-state | VALIDE — vocabulaire strict (`hasData`, `highlight`, `active` uniquement) |
| Palette dans `lib/config/insecurityPalette.ts` (agnostique couche cible) | RÉSOLU — voir Q4 |

---

## Q&A — Décisions du Product Owner

### Q1 — Où placer `MapDisplayModeService` ?

**Décision :** Le service est placé dans `lib/map/state/`. Ce sous-dossier est préféré à `lib/map/displayMode/` pour permettre la mise à l'échelle si plusieurs services cartographiques headless sont ajoutés à court terme. Le dossier `lib/map/state/` n'existe pas encore et sera créé.

**Impact technique :**
- Le fichier sera `apps/web/lib/map/state/displayModeService.ts`.
- Le hook `useDisplayMode` sera dans `apps/web/lib/map/state/useDisplayMode.ts`.
- Le binder reste dans `apps/web/lib/map/state/displayBinder.ts` (même dossier, colocalisé avec le service qu'il consomme directement).
- Les types (`DisplayMode`) peuvent être dans `apps/web/lib/map/state/types.ts` ou dans le même fichier que le service selon la taille. Pour le MVP une seule union type suffit : pas besoin de fichier séparé.

**Statut :** RÉSOLU

---

### Q2 — Comment encoder le niveau insécurité sur les polygones sans toucher feature-state ?

**Décision :** En mode insécurité, les polygones et les bordures des entités sont colorés avec le même code couleur que les badges (vert, jaune, orange, rouge). Les règles de priorité sont :

Sur le **fill** (`communes-fill` / `fill-color`) :
- Toujours la couleur du niveau. `highlight` et `active` n'affectent pas le fill.
- L'expression est un `match` pur sur `insee` — aucune branche feature-state.

Sur la **bordure** (`communes-line` / `line-color`) :
- Base → couleur du niveau (même hex que le fill, via `match` sur `insee`).
- `highlight` → couleur highlight standard (override du niveau).
- `active` → couleur active standard (override du niveau).
- L'expression est un `case` sur feature-state dont la branche `base` est elle-même un `match` sur `insee`.

**Impact technique :**
- `communes-fill` / `fill-color` : expression `match` pure (pas de `case` feature-state). Exemple structurel :
  ```
  ["match", ["get", "insee"],
    [...insee_tres_eleve], PALETTE.tresEleve,
    [...insee_eleve],      PALETTE.eleve,
    [...insee_modere],     PALETTE.modere,
    PALETTE.faible         // fallback : faible ou pas de données
  ]
  ```
- `communes-fill` / `fill-opacity` : valeur constante (pas de branche feature-state). Valeur à déterminer lors de l'implémentation (fourchette 0.18–0.30 par la spec originale).
- `communes-line` / `line-color` : expression composée — `case` sur feature-state (active > highlight) avec comme branche par défaut le même `match` sur `insee` que le fill :
  ```
  ["case",
    ["boolean", ["feature-state", "active"], false],   COMMUNE_COLORS.line.active,
    ["boolean", ["feature-state", "highlight"], false], COMMUNE_COLORS.line.highlight,
    ["match", ["get", "insee"],                         // base = couleur du niveau
      [...insee_tres_eleve], PALETTE.tresEleve,
      [...insee_eleve],      PALETTE.eleve,
      [...insee_modere],     PALETTE.modere,
      PALETTE.faible
    ]
  ]
  ```
- `communes-line` / `line-width` : inchangé. Les branches highlight/active sur la largeur sont déjà gérées par `buildLineWidthExpr` dans `highlightState.ts`.
- Le binder doit sauvegarder les expressions originales de `communes-fill` (`fill-color`, `fill-opacity`) et `communes-line` (`line-color`) à l'init, et les restaurer en mode `default`.
- Les couleurs highlight/active standard pour la bordure sont celles déjà définies dans `COMMUNE_COLORS.line` de `highlightState.ts` (`highlight: "#2d5bff"`, `active: "#f59e0b"`).

**Statut :** RÉSOLU

---

### Q3 — Comment composer les expressions fill vs line en mode insécurité ?

**Décision :** La proposition MVP du Q3 original (garder le contour base en `#0f172a`) est **retirée**. Le PO a précisé dans Q2 que la bordure de base doit correspondre au niveau de la commune (même couleur que le fill). La composition des expressions est donc décrite en détail dans Q2 ci-dessus. Les couleurs doivent être facilement modifiables via un fichier de config centralisé (voir Q4).

**Impact technique :**
- Pas de décision supplémentaire par rapport à Q2. L'expression `line-color` composée (case + match imbriqué) est la solution retenue.
- Le fichier de palette centralisé (Q4) est le point d'entrée unique pour changer les couleurs des niveaux sur carte et badge simultanément.

**Statut :** RÉSOLU

---

### Q4 — Palette partagée entre carte et badge ?

**Décision :** La palette ne doit pas être dans `lib/map/`. Elle doit être dans un fichier de config agnostique du composant cible. Le dossier `lib/config/` existe déjà dans le projet (`appConfig.ts`, `debugConfig.ts`, `mapTilesConfig.ts`) et convient parfaitement. Le fichier sera `apps/web/lib/config/insecurityPalette.ts`.

**Impact technique :**
- `lib/config/insecurityPalette.ts` exporte un singleton `INSECURITY_PALETTE` avec les 4 couleurs hex par niveau (`faible`, `modere`, `eleve`, `tresEleve`). Structure minimale :
  ```typescript
  export const INSECURITY_PALETTE = {
      faible:    "#22c55e",   // vert
      modere:    "#f59e0b",   // jaune/amber
      eleve:     "#f97316",   // orange
      tresEleve: "#ef4444"    // rouge
  } as const;

  export type InsecurityLevel = keyof typeof INSECURITY_PALETTE;
  ```
- La carte (`displayBinder.ts`) importe les hex depuis ce fichier pour construire les expressions `match`.
- Le badge (`insecurity-badge.tsx`) importe les hex depuis ce même fichier et les applique via `style={{ backgroundColor: ... }}` sur chaque niveau, remplaçant les variants shadcn + classes ad-hoc actuelles.
- Le fichier ne contient aucune logique carte ni aucune dépendance React. C'est un objet de données pur.
- Note : le type `InsecurityLevel` est déjà défini dans `lib/data/insecurityMetrics.ts` comme `"faible" | "modere" | "eleve" | "tres-eleve"`. La palette doit utiliser les mêmes clés (en adaptant `tres-eleve` vs `tresEleve` pour être compatible camelCase en objet TypeScript). À réconcilier lors de l'implémentation : soit on garde les clés avec tiret dans un `Record<InsecurityLevel, string>`, soit on redéfinit. Le `Record<InsecurityLevel, string>` est la formule la plus simple et cohérente avec le type existant.

**Statut :** RÉSOLU

---

### Q5 — Année par défaut : dernière disponible ou année fixe ?

**Décision :** Dernière année disponible, mais la même année pour toutes les entités (pas de divergence année entre communes). Le binder charge une seule année via `getLatestInsecurityYear` — elle est utilisée pour construire l'expression `match` globale. Pas de paramètre configurable pour le MVP.

**Impact technique :**
- `getLatestInsecurityYear` est déjà implémentée dans `insecurityMetrics.ts` (ligne 307). Le binder l'appelle une seule fois à l'activation du mode, puis charge le dataset de cette année via `loadInsecurityYear`.
- Aucune modification au loader nécessaire.
- Le composant `MapLayerMenu` n'expose pas de sélection d'année.

**Statut :** RÉSOLU

---

### Q6 — Bug préexistant : `alive = true` dans le cleanup

**Décision :** En cours de correction par un autre agent sur cette branche. Pas de changement de spec nécessaire.

**Impact technique :**
- Fichier concerné : `apps/web/components/right-panel-details-card.tsx`, ligne 143.
- Le bug (`alive = true` au lieu de `alive = false` dans le cleanup de l'effect) doit être corrigé avant tout déploiement.
- Cette correction est une **précondition** pour considérer la branche prête à merger.

**Statut :** RÉSOLU (correction en cours par un autre agent)

---

### Q7 — Code mort : `hoverState.ts` à supprimer ?

**Décision :** En cours de traitement par un autre agent. Pas de changement de spec nécessaire.

**Impact technique :**
- Fichier concerné : `apps/web/lib/map/layers/hoverState.ts`.
- Le fichier est un doublon de `highlightState.ts` avec l'ancienne terminologie. Il n'est importé nulle part.
- Sa suppression est une précondition de propreté avant l'implémentation du binder, pour éviter toute confusion sur la source de vérité des expressions.

**Statut :** RÉSOLU (suppression en cours par un autre agent)

---

## Roadmap d'implémentation

Les étapes sont ordonnées par dépendance. L'agent recommandé est choisi selon la complexité et le périmètre de chaque tâche.

```
┌─────────────────────────────────────────────────────────────────┐
│  PRÉ-CONDITION : corrections branche (avant tout autre travail) │
└─────────────────────────────────────────────────────────────────┘
```

### Étape 0a — Corriger le bug `alive = true`
- **Fichier :** `apps/web/components/right-panel-details-card.tsx:143`
- **Changement :** `alive = true` → `alive = false`
- **Agent :** `dev-code-fixer`
- **Statut :** En cours par un autre agent.
- **Justification :** Bug simple, une ligne, scope contenu. Doit être fait en premier car il crée un risque de régression silencieuse.

### Étape 0b — Supprimer `hoverState.ts`
- **Fichier :** `apps/web/lib/map/layers/hoverState.ts`
- **Changement :** Suppression du fichier. Vérification qu'il n'est pas importé (confirmé : aucune dépendance).
- **Agent :** `dev-minor-change-implementer`
- **Statut :** En cours par un autre agent.
- **Justification :** Suppression de fichier mort, vérification d'imports. Aucune décision architecturale.

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 1 : Fondations — palette + service + hook                │
└─────────────────────────────────────────────────────────────────┘
```

### Étape 1a — Créer la palette centralisée
- **Fichier à créer :** `apps/web/lib/config/insecurityPalette.ts`
- **Contenu :**
  - Un objet `INSECURITY_PALETTE` de type `Record<InsecurityLevel, string>` avec les 4 hex (vert, amber, orange, rouge). Les clés sont celles du type `InsecurityLevel` existant dans `insecurityMetrics.ts` : `"faible"`, `"modere"`, `"eleve"`, `"tres-eleve"`.
  - Pas de logique, pas de dépendance React ni MapLibre. Un objet de données pur.
- **Agent :** `dev-minor-change-implementer`
- **Justification :** Constante pure dans un fichier de config existant (`lib/config/`). Périmètre < 15 lignes.

### Étape 1b — Créer `MapDisplayModeService`
- **Fichier à créer :** `apps/web/lib/map/state/displayModeService.ts`
- **Contenu :** Service singleton headless avec `getState()`, `setMode(mode)`, `subscribe(listener)`. Union type `DisplayMode = "default" | "insecurity"` dans le même fichier. Pattern observable identique à `EntityStateService`.
- **Agent :** `dev-minor-change-implementer`
- **Justification :** Copie structurelle d'un pattern déjà établi dans la base de code. Aucune décision nouvelle. Périmètre < 30 lignes.

### Étape 1c — Créer le hook React `useDisplayMode`
- **Fichier à créer :** `apps/web/lib/map/state/useDisplayMode.ts`
- **Contenu :** Hook qui souscrira au service et expose `{ mode, setMode }`.
- **Agent :** `dev-minor-change-implementer`
- **Justification :** Hook de 15–20 lignes suivant le même pattern que les hooks de sélection existants.

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 2 : Composant menu (UI)                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Étape 2 — Créer `MapLayerMenu`
- **Fichier à créer :** `apps/web/components/map-layer-menu.tsx`
- **Contenu :** Dropdown shadcn/ui dans l'overlay carte. Consomme `useDisplayMode`. Options : Default, Insécurité. Pas de sélection d'année.
- **Intégration :** À placer dans le composant carte existant (overlay).
- **Agent :** `dev-minor-change-implementer`
- **Justification :** Composant UI pur, pas de logique métier. shadcn/ui dropdown + un hook. Périmètre < 50 lignes.

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 3 : Coeur technique — le binder (tâche la plus complexe) │
└─────────────────────────────────────────────────────────────────┘
```

### Étape 3 — Créer `MapDisplayBinder` + implémenter la choroplèthe
- **Fichier à créer :** `apps/web/lib/map/state/displayBinder.ts`
- **Responsabilités :**
  1. Souscrire au `MapDisplayModeService`.
  2. À l'init : sauvegarder les expressions originales via `map.getPaintProperty` sur :
     - `communes-fill` : `fill-color`, `fill-opacity`
     - `communes-line` : `line-color`
  3. En mode `insecurity` :
     - Charger la dernière année via `getLatestInsecurityYear` (AbortController obligatoire).
     - Charger le dataset via `loadInsecurityYear`.
     - Regrouper les INSEE par niveau via `computeInsecurityLevel`.
     - Construire et appliquer via `setPaintProperty` :
       - `communes-fill` / `fill-color` : expression `match` pure sur `insee` (4 niveaux + fallback). Aucune branche feature-state.
       - `communes-fill` / `fill-opacity` : valeur constante (pas de branche feature-state).
       - `communes-line` / `line-color` : expression `case` sur feature-state (active → `COMMUNE_COLORS.line.active`, highlight → `COMMUNE_COLORS.line.highlight`, sinon → même expression `match` sur `insee` que le fill). Les couleurs highlight/active sont celles de `highlightState.ts`.
     - Ne pas toucher `communes-line` / `line-width` : les branches highlight/active sur la largeur sont déjà correctes.
  4. En mode `default` : restaurer les 3 expressions sauvegardées.
  5. Cleanup : restaurer + unsubscribe + abort.
- **Agent :** `dev-feature-implementer`
- **Justification :** Coeur technique de la feature. Implique la composition d'expressions MapLibre imbriquées (`case` contenant un `match`), la gestion du cycle de vie (sauvegarde/restauration), l'intégration avec le loader existant, les contraintes d'AbortController, et la lecture de `COMMUNE_COLORS` depuis `highlightState.ts` pour les couleurs d'interaction. Nécessite une compréhension approfondie de la couche Map.
- **Précondition :** Étapes 0a, 0b, 1a, 1b terminées.

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 4 : Mise à jour du badge                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Étape 4 — Mettre à jour `InsecurityBadge` pour consommer la palette centralisée
- **Fichier à modifier :** `apps/web/components/insecurity-badge.tsx`
- **Changement :**
  - Importer `INSECURITY_PALETTE` depuis `@/lib/config/insecurityPalette`.
  - Remplacer les variants shadcn (`success`, `warning`, `danger`) et les classes ad-hoc (`bg-orange-100 text-orange-800`) par des styles inline utilisant les hex de la palette pour le `backgroundColor`. Le `color` du texte peut rester en classe Tailwind (`text-white` ou `text-gray-900` selon la luminosité du fond).
  - Supprimer les objets `levelVariants` et `levelCustomStyles`.
- **Agent :** `dev-minor-change-implementer`
- **Justification :** Changement localisé dans un seul composant. La logique est pure substitution de source de couleurs. Périmètre < 20 lignes modifiées.

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 5 : Vérification de régression                           │
└─────────────────────────────────────────────────────────────────┘
```

### Étape 5 — Vérifier que highlight/active n'affecte que label + contour
- **Périmètre :** Relire les expressions résultantes sur `communes-fill` et `communes-line` après l'application du mode insécurité. Confirmer que :
  - `fill-color` sur `communes-fill` ne contient aucune branche `highlight`/`active`.
  - `fill-opacity` sur `communes-fill` est une valeur constante (pas de branche feature-state).
  - `line-color` sur `communes-line` contient les branches `highlight`/`active` avec les couleurs standard, et que la branche base est bien le `match` par niveau.
  - `line-width` sur `communes-line` conserve ses branches `highlight`/`active` d'origine (non modifié par le binder).
  - Les labels ne sont pas affectés par le changement de mode.
- **Agent :** `dev-code-fixer`
- **Justification :** Vérification de régression après implémentation. L'agent doit lire le code produit à l'étape 3 et confirmer (ou corriger) la conformité.

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 6 : Validation build                                     │
└─────────────────────────────────────────────────────────────────┘
```

### Étape 6 — `pnpm typecheck` + `pnpm lint:eslint`
- **Agent :** `dev-code-fixer`
- **Justification :** Si des erreurs TypeScript ou ESLint apparaissent après les changements, cet agent les corrige avec un périmètre minimal.

---

## Synthèse graphique des dépendances

```
0a (bug alive)  ──┐
0b (hoverState) ──┤
                  ▼
1a (palette config)  ──┐
1b (service)         ──┤
1c (hook)            ──┤
                       ▼
2  (MapLayerMenu)  ────┤
                       ▼
3  (MapDisplayBinder + choroplèthe)
                       │
                       ▼
4  (badge → palette centralisée)
                       │
                       ▼
5  (vérification régression)
                       │
                       ▼
6  (typecheck + lint)
```

---

## Agents utilisés — résumé

| Agent | Étapes assignées | Raison |
|---|---|---|
| `dev-code-fixer` | 0a, 5, 6 | Corrections de bug + vérifications de régression + erreurs build |
| `dev-minor-change-implementer` | 0b, 1a, 1b, 1c, 2, 4 | Changements localisés, patterns existants, périmètre < 50 lignes |
| `dev-feature-implementer` | 3 | Coeur technique multi-fichiers, expressions MapLibre imbriquées, intégration loader + AbortController |

---

## Prêt à implémenter ?

**OUI** — toutes les préconditions sont satisfaites.

### Préconditions vérifiées

- **Étape 0a (bug `alive = true`)** — Correction déjà appliquée sur la branche. `right-panel-details-card.tsx:143` contient bien `alive = false`.
- **Étape 0b (suppression de `hoverState.ts`)** — Fichier déjà supprimé sur la branche. Plus de source de confusion sur les expressions de style.
- **Tous les Q&A (Q1–Q7) sont résolus.** Aucune ambiguïté architecturale ne reste.
- Le dossier cible de la palette (`lib/config/`) est identifié et compatible avec les conventions existantes.
- Le dossier cible du service (`lib/map/state/`) est décidé.
- La logique de priorité fill/line est spécifiée avec précision (expressions structurées dans Q2).
- Le loader (`insecurityMetrics.ts`) n'a pas besoin de modification.
- Les couleurs highlight/active pour la bordure sont identifiées (`COMMUNE_COLORS.line` dans `highlightState.ts`).

### Ordre de démarrage

La Phase 1 peut démarrer immédiatement. Les étapes 1a, 1b, 1c sont indépendantes entre elles et peuvent être lancées en parallèle. L'étape 2 dépend de 1b+1c. L'étape 3 (binder) dépend de 1a+1b et est le chemin critique.
