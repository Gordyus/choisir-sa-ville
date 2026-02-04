# AGENTS – Règles techniques du projet

Ce document définit les règles **NON NÉGOCIABLES** pour le développement du projet.
Tout agent (humain ou IA) doit s'y conformer strictement.

**Date de dernière mise à jour** : Février 2026  
**Architecture** : Jamstack (données statiques + Next.js)

---

## 1. Architecture générale

### Principe fondamental

Le projet utilise une **architecture statique complète** :
- **Build time** : génération de données JSON optimisées depuis sources ouvertes (INSEE, etc.)
- **Runtime** : Next.js sert les données statiques + cache IndexedDB côté client
- **Aucun backend API, aucune base de données en runtime**

### Structure du monorepo

```
choisir-sa-ville/
├── packages/
│   └── importer/           # Pipeline de génération de données statiques
│
├── apps/
│   └── web/                # Application Next.js (frontend)
│       └── public/data/    # Données JSON statiques versionnées
│
├── docs/                   # Documentation technique
└── specs/                  # Spécifications fonctionnelles
```

### Séparation des responsabilités

**packages/importer**
- ❌ Jamais appelé au runtime
- ✅ Script Node.js batch uniquement
- ✅ Télécharge et parse les sources de données
- ✅ Génère les JSON dans `apps/web/public/data/{version}/`
- ✅ Idempotent, rejouable

**apps/web**
- ✅ Next.js 15+ avec App Router
- ✅ Tailwind CSS + shadcn/ui
- ✅ MapLibre GL JS pour la carte
- ✅ Lit les données depuis `/data/{version}/` (HTTP)
- ✅ Cache dans IndexedDB (TTL 7 jours)
- ❌ Aucune logique métier lourde dans les composants UI
- ❌ Aucun appel API backend (n'existe pas)

---

## 2. Frontend (NON NÉGOCIABLE)

### Framework obligatoire

- **Next.js** (React) avec **Tailwind CSS** + **shadcn/ui**

Interdits :
- Vue, Svelte, Nuxt
- Autre framework CSS que Tailwind
- Composants UI custom (utiliser shadcn/ui)

### Architecture frontend

```
apps/web/
├── app/                    # Next.js App Router
│   ├── layout.tsx
│   └── page.tsx
│
├── components/             # Composants React
│   ├── ui/                 # shadcn/ui components
│   ├── vector-map.tsx      # Composant carte
│   └── right-panel.tsx     # Panneau latéral
│
└── lib/                    # Logique métier
    ├── selection/          # Service de sélection (headless)
    ├── data/               # Providers de données + cache
    ├── map/                # Adaptateur MapLibre
    └── config/             # Configuration
```

### Règles de séparation

**lib/selection/** - Service de sélection
- ✅ TypeScript pur, **AUCUNE** dépendance React ou MapLibre
- ✅ Pattern Observable avec listeners
- ✅ Facilement testable
- Type central : `EntityRef` (commune | infraZone)

**lib/data/** - Accès aux données
- ✅ Interface `EntityDataProvider` abstraite
- ✅ Implémentation `StaticFilesEntityDataProvider` (lit depuis `/data/`)
- ✅ Décorateur `CachedEntityDataProvider` (IndexedDB cache)
- ✅ Hooks React (`useEntity`, `useCommune`, `useInfraZone`)

**lib/map/** - Adaptateur carte
- ✅ Consomme `SelectionService`
- ✅ Produit événements highlight/active
- ✅ Applique feature-state aux labels MapLibre
- ❌ N'accède PAS directement aux données (passe par SelectionService)

**components/** - UI React
- ✅ Consomme `SelectionService` via hooks
- ✅ Consomme `EntityDataProvider` via hooks
- ❌ Aucune logique métier lourde
- ❌ Aucun accès direct à la carte

### Règles carte MapLibre (NON NÉGOCIABLE)

**Initialisation et cleanup**
- Initialisation : **une seule fois** au montage du composant
- Destruction : **cleanup complet** à l'unmount (`map.remove()`)

**Événements carte**
- ✅ Utiliser uniquement `moveend` et `zoomend`
- ❌ **JAMAIS** `move` (trop fréquent, cause de spam)

**Chargement basé viewport**
- ✅ Debounce + annulation (AbortController)
- ✅ Déduplication des requêtes identiques
- ❌ Pas de spam réseau

**Feature state**
- Vocabulaire strict : `hasData`, `highlight`, `active`
- Appliqué uniquement aux labels (jamais aux polygones directement)

**Interactions pointer**
- Label-first : chaque interaction commence par `queryRenderedFeatures(point, { layers: managedLabelLayers })`
- Les polygones servent uniquement à la désambiguïsation, jamais comme source primaire d'interaction

---

## 3. Modèle territorial (décisions produit)

### Hiérarchie officielle

```
Pays
 └── Région
     └── Département
         └── Commune (pivot central)
             └── Zone infra-communale (optionnelle)
```

### Types INSEE

- **COM** → Commune (unité pivot)
- **ARM** → Arrondissement municipal
- **COMD** → Commune déléguée
- **COMA** → Commune associée

### Règles clés

1. **La commune est l'unité pivot** - Toutes les données s'agrègent au niveau commune
2. **Les zones infra ne sont jamais des communes** - Elles sont toujours rattachées à une commune parente
3. **Les ARM sont prioritaires** pour les métriques locales (logement, sécurité, qualité de vie)
4. **Pas d'aplatissement** - Ne jamais perdre la hiérarchie commune → infra-zone

Voir `docs/LOCALITY_MODEL.md` pour plus de détails.

---

## 4. Pipeline de données (packages/importer)

### Principes

- ✅ Idempotent : peut être rejoué sans effet de bord
- ✅ Batché : traite les données par lots
- ✅ Versionné : chaque export a une version (ex: `v2026-02-04`)
- ✅ Incrémental : télécharge uniquement ce qui a changé (cache local `.cache/`)
- ❌ Jamais appelé au runtime de l'application

### Sources de données

- INSEE : communes, départements, régions
- La Poste : codes postaux + coordonnées GPS
- Autres sources Open Data à documenter

### Format de sortie

```
apps/web/public/data/{version}/
├── manifest.json                 # Métadonnées du dataset
├── communes/
│   ├── indexLite.json           # Index allégé (tous les codes INSEE)
│   ├── {dept}/                  # Groupé par département
│   │   └── {inseeCode}.json     # Détails par commune
│   └── ...
├── infra-zones/
│   ├── indexLite.json
│   └── {dept}/
│       └── {id}.json
└── ...
```

### Commande d'export

```bash
pnpm --filter @choisir-sa-ville/importer export:static
```

---

## 5. Naming conventions (NON NÉGOCIABLE)

### camelCase partout

- ✅ Code TypeScript : `inseeCode`, `parentCommuneCode`
- ✅ JSON de données : `{ "inseeCode": "75056", "departmentCode": "75" }`
- ✅ Noms de fichiers TypeScript : `entityDataProvider.ts`

Interdits :
- ❌ snake_case dans le code ou les données
- ❌ Mapping DB ↔ code (pas de DB)

### Cohérence package names

```json
{
  "name": "@choisir-sa-ville/importer",
  "name": "@choisir-sa-ville/web"
}
```

---

## 6. Validation et typage

### TypeScript strict

- `strict: true` dans tous les `tsconfig.json`
- Pas de `any` sauf cas exceptionnels documentés
- Préférer les types explicites aux inférences complexes

### Zod pour validation runtime

- Validation des données sources (CSV, API externes)
- Validation des configurations
- **Pas** de validation des données statiques générées (déjà validées au build)

---

## 7. Configuration et environnement

### Variables d'environnement

Frontend (Next.js) :
```env
NEXT_PUBLIC_DATA_VERSION=v2026-02-04
```

Importer :
```env
# Aucune pour l'instant (URLs hardcodées dans constants.ts)
```

### Fichiers

- `.env.example` toujours à jour
- **Aucun secret en dur** dans le code
- Configuration via `lib/config/` avec types Zod

---

## 8. Tests et qualité

### Tests obligatoires

Pour les prochaines features, tests requis pour :
- `SelectionService` (logique critique)
- `EntityDataProvider` (implémentations)
- Spatial indexes (résolution de sélection)
- Pipeline importer (validation des données)

### Linting

```bash
# Root
pnpm lint:eslint

# Par package
pnpm --filter @choisir-sa-ville/web lint
```

Configuration ESLint stricte :
- `--max-warnings=0` (aucun warning accepté)
- TypeScript ESLint activé

---

## 9. Workflow de développement

### Première installation

```bash
# 1. Installer les dépendances
pnpm install

# 2. Générer les données statiques
pnpm --filter @choisir-sa-ville/importer export:static

# 3. Lancer le dev frontend
pnpm --filter @choisir-sa-ville/web dev
```

### Développement quotidien

```bash
# Frontend uniquement (si données déjà générées)
pnpm --filter @choisir-sa-ville/web dev

# Régénérer les données (si sources ont changé)
pnpm --filter @choisir-sa-ville/importer export:static
```

### Build de production

```bash
# Build du frontend (inclut les données statiques existantes)
pnpm --filter @choisir-sa-ville/web build

# Start en mode production
pnpm --filter @choisir-sa-ville/web start
```

---

## 10. Règles de contribution (humain & IA)

### Avant toute modification

1. ✅ Lire ce document (AGENTS.md)
2. ✅ Lire `docs/ARCHITECTURE.md`
3. ✅ Lire `docs/LOCALITY_MODEL.md`
4. ✅ Lire les specs pertinentes dans `specs/`

### Pendant le développement

1. ✅ Respecter la séparation des responsabilités (selection / data / map / ui)
2. ✅ Typage TypeScript strict
3. ✅ Tests pour la logique critique
4. ✅ Commits atomiques avec messages clairs

### Pull Request

1. ✅ `pnpm typecheck` passe
2. ✅ `pnpm lint:eslint` passe (0 warnings)
3. ✅ Tests passent (quand ils existent)
4. ✅ Documentation mise à jour si nécessaire

---

## 11. Philosophie du projet

### Principes directeurs

1. **Simplicité > Complexité**
   - Éviter l'over-engineering
   - Solutions directes quand elles suffisent

2. **Lisibilité > Abstraction prématurée**
   - Code explicite plutôt que "clever"
   - Abstractions uniquement si réutilisation prouvée

3. **Portabilité > Vendor lock-in**
   - Pas de dépendance à un hébergeur spécifique
   - Code déployable sur tout environnement Node.js standard

4. **Performance > Comfort**
   - Données statiques (pas de RT si pas nécessaire)
   - Cache intelligent (IndexedDB)
   - Chargement progressif

5. **Qualité > Vitesse**
   - Typage strict
   - Tests pour le critique
   - Refactoring continu

### Citation produit

> "La commune est le socle.  
> Les zones infra apportent la précision.  
> Ne jamais aplatir les données au mauvais niveau."

---

## 12. Anti-patterns à éviter

❌ **Ne JAMAIS faire** :
- Logique métier dans les composants React
- Appels réseau non-annulables ou non-debouncés
- État global React sans raison (préférer SelectionService)
- Accès direct à la carte depuis les composants UI
- Mutations directes des données (immutabilité)
- snake_case dans le code ou les JSON
- `any` sans justification
- Événements `move` de la carte
- Dépendances circulaires entre packages

✅ **Toujours faire** :
- Séparer selection / data / map / ui
- Utiliser les hooks fournis (`useEntity`, `useSelection`)
- AbortController pour les requêtes réseau
- Cleanup des event listeners
- Types explicites
- camelCase partout

---

## En cas de doute

1. Consulter `docs/ARCHITECTURE.md`
2. Regarder le code existant similaire
3. Demander une review avant de commiter
4. Privilégier la solution simple et maintenable

---

**Ce document est la source de vérité technique du projet.**  
Toute modification doit être validée par l'équipe et documentée dans le changelog.
