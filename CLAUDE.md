# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
**Source de vérité** pour l'architecture, les conventions et les règles non négociables.

**Dernière mise à jour** : 15 février 2026

---

## 1. Commandes essentielles

```bash
# Développement
pnpm install                                                  # Installer les dépendances
pnpm --filter @choisir-sa-ville/importer export:static        # Générer les données statiques (obligatoire avant le premier dev)
pnpm --filter @choisir-sa-ville/web dev                       # Serveur de développement (localhost:3000)
pnpm dev                                                      # Raccourci root pour le même serveur

# Vérifications (obligatoires avant tout commit)
pnpm typecheck                                                # TypeScript strict — 0 erreur requis
pnpm lint:eslint                                              # ESLint — 0 warning requis (--max-warnings=0)

# Build & production
pnpm --filter @choisir-sa-ville/web build                     # Build Next.js
pnpm --filter @choisir-sa-ville/web start                     # Serveur production
pnpm build                                                    # Raccourci root pour le build web
```

**Note** : Il n'y a pas de framework de test configuré en ce moment (vitest est prévu). `pnpm test` ne fait rien d'utile.

---

## 2. Architecture — Principes fondamentaux

### Principe directeur

Le projet utilise une **architecture Jamstack étendue** :

- **Build time** : génération de datasets JSON depuis des sources ouvertes (INSEE, DVF, etc.)
- **Runtime frontend** : Next.js sert des fichiers statiques (données + config)
- **Runtime backend** : Service routing minimal **uniquement** (calcul temps de trajet)
  - Scope strict : orchestration API routage externe (TomTom), cache optionnel
  - **Interdit** : logique métier, agrégation données, authentification utilisateur
  - **Exception unique** motivée par impossibilité technique : temps de trajet avec heure de départ = API externe obligatoire

### Monorepo (4 packages)

```
choisir-sa-ville/
├── packages/
│   ├── shared/             # Configuration & constantes partagées (build-time + runtime)
│   │   └── src/config/     # Configs métier (insecurityMetrics, etc.)
│   └── importer/           # Pipeline de génération (batch, build-time)
├── apps/
│   ├── web/                # Next.js (frontend)
│   │   └── public/
│   │       ├── config/     # Config runtime (JSON)
│   │       └── data/       # Datasets statiques versionnés
│   └── api/                # Backend API (Fastify, structuré par domaine)
│       ├── src/
│       │   ├── routing/    # Domaine routing (providers, cache, utils)
│       │   ├── health/     # Domaine monitoring
│       │   ├── shared/     # Code partagé cross-domain (errors, types)
│       │   └── config/     # Variables env
│       └── package.json
├── docs/
│   ├── architecture/       # Architecture & patterns techniques
│   ├── metrics/            # Documentation métriques (insécurité, etc.)
│   └── feature/            # Spécifications features (1 dossier = 1 feature)
```

**Règles** :

- Configuration métier partagée : **obligatoirement** dans `packages/shared/` (aucune duplication)
- Backend routing : **scope strict** limité au calcul temps de trajet (voir spec `docs/feature/routing-service/spec.md`)
- Pattern **Adapter** obligatoire pour abstraction provider (interface `RoutingProvider`, implémentations `TomTomProvider`, `OSRMProvider`, etc.)
- **Aucune logique métier** dans le backend (scoring, filtrage, agrégations → client-side uniquement)

**Les données sont versionées** dans `apps/web/public/data/v{YYYY}-{MM}-{DD}/`. Un symlink `current` pointe vers la dernière version. Le frontend récupère les données via des requêtes HTTP vers ces fichiers statiques.

### Séparation des responsabilités (apps/web/lib/)

Cette séparation est **non négociable**. Les quatre couches ne se mélangent pas :

| Couche | Dossier | Rôle | Dépendances autorisées |
|--------|---------|------|------------------------|
| **Selection** | `lib/selection/` | État de sélection (highlighted / active). Pattern observable avec listeners. Type central : `EntityRef` (`commune` \| `infraZone`). | TypeScript pur — **aucune** dépendance React ni MapLibre |
| **Data** | `lib/data/` | Accès aux données via `EntityDataProvider` (interface). Implémentations : `StaticFilesEntityDataProvider` (fetch HTTP) + décorateur `CachedEntityDataProvider` (IndexedDB, TTL 7 jours). Hooks React : `useEntity`, `useCommune`, `useInfraZone`. Accès runtime basé sur `/data/current/manifest.json` → `datasetVersion`. Modules principaux : `communesIndexLite.ts`, `infraZonesIndexLite.ts`. | Peut importer de `lib/selection/` pour lire l'état |
| **Map** | `lib/map/` | Adaptateur MapLibre. Charge le style via `stylePipeline.ts` (sanitize + injection polygones + styling labels). Gère interactions via `mapInteractionService.ts`. Met à jour `SelectionService` (pas de logique UI). | Dépend de `lib/selection/`. **Ne fetch pas les données directement.** |
| **Components** | `components/` | Composants UI **partagés** : `ui/` (shadcn primitives), `layout/` (header, footer, shell applicatif). | Hooks uniquement — pas d'accès direct à la carte ni à la logique métier |
| **Features** | `features/` | Domaines métier : 1 dossier = 1 feature autonome (`components/`, `hooks/`, `types.ts`). Chaque feature consomme `lib/*` (transversal) et `components/ui/` (primitives). Domaines actuels : `map-viewer`, `entity-details`. Domaines futurs (post-MVP) : `search`, `reports`. | Peut importer de `lib/*` et `components/ui/`. **Jamais d'import cross-feature.** |

**Règle importante** : **Ne créer un dossier feature que lorsque le code est implémenté** (pas de dossiers vides anticipés).

---

## 3. Backend Routing (Scope Limité)

### Stack obligatoire

- **Fastify** (Node.js + TypeScript)
- **PostgreSQL** (optionnel cache, peut être mocké en MVP)
- **Pattern Adapter** : abstraction provider routing (TomTom, OpenRouteService, OSRM)

### Endpoints autorisés

**UNIQUEMENT** :

1. `POST /api/routing/matrix` — Calcul temps de trajet commune → destination(s)
2. `POST /api/geocode` — Géocodage adresse → coordonnées GPS
3. `GET /api/health` — Health check monitoring

**Configuration** : Variables env pour provider, cache, marges d'erreur (voir `docs/feature/routing-service/spec.md`)

### Interdictions strictes

- ❌ Logique métier (scoring, filtrage communes, agrégations)
- ❌ Authentification / gestion utilisateurs
- ❌ Stockage données métier (communes, transactions, métriques)
- ❌ Endpoints non listés ci-dessus
- ❌ Dépendance forte à un provider (code métier doit utiliser interface `RoutingProvider`)

**Principe** : Le backend est un **proxy cache** vers API routing externe, **rien d'autre**.

---

## 4. Frontend — Règles Non Négociables

### Stack obligatoire

- Next.js (App Router)
- Tailwind CSS
- shadcn/ui (components dans `apps/web/components/ui/`)
- MapLibre GL JS

**Interdits** : autre framework UI, autre framework CSS, état global React "gratuit".

### Carte MapLibre — règles

**Init / cleanup**

- Initialisation une seule fois au montage
- Cleanup complet à l'unmount : `map.remove()`

**Événements de viewport**

- Pour tout traitement déclenché par un changement de viewport : **`moveend` + `zoomend` uniquement**
- **Jamais** `move` pour du traitement continu (spam)

**Pointer events**

- Autorisés (ex: `mousemove`, `click`) pour l'interaction label-first

**Interactions (label-first)**

- Chaque interaction commence par `queryRenderedFeatures(point, { layers: [labelLayerId] })`
- Résolution d'entité : nom normalisé → candidates (index lite) → nearest par distance
- Les polygones servent uniquement à la désambiguïsation

**Feature-state**

- Vocabulaire strict (labels) : `hasData`, `highlight`, `active`, `score`, `isSearchResult`
- Le style applique la priorité : `active > highlight > hasData > default`
- Vocabulaire recherche (labels) : `score` (number 0-1), `isSearchResult` (boolean)

**Requêtes réseau déclenchées par la carte**

- Chaque requête réseau déclenché par la carte **doit** utiliser `AbortController` pour l'annulation et le debounce

---

## 5. Modèle Territorial (Données)

Hiérarchie :

**Pays → Région → Département → Commune (pivot) → Zone infra (optionnelle)**

La **commune** est l'unité pivot de tout le système de données. Les types INSEE se découpent ainsi :

- `COM` → Commune (niveau pivot, toujours présent)
- `ARM` / `COMD` / `COMA` → Zones infra-communales, toujours rattachées à une commune parente via `parentId`

**Ne jamais aplatir ces niveaux.** Une infra-zone n'est jamais traitée comme une commune. Le type central pour référencer une entité est `EntityRef` avec un champ `kind` (`"commune"` | `"infraZone"`).

**Règle** : une zone infra n'existe jamais sans commune parente (ARM/COMD/COMA).

Voir `docs/architecture/locality-model.md` pour détails complets.

---

## 6. Pipeline de Données (packages/importer)

- Batch Node.js, jamais appelé au runtime
- Produit un dataset versionné `vYYYY-MM-DD`
- Met à jour le pointeur runtime : `apps/web/public/data/current/manifest.json`
- **Idempotence obligatoire** : si vous modifiez le schéma de sortie, `export:static` doit pouvoir être rejouée sans effet de bord

Commande :

```bash
pnpm --filter @choisir-sa-ville/importer export:static
```

---

## 7. Conventions de Code

- **camelCase partout** : code TypeScript, clés JSON de données, noms de fichiers. Jamais de snake_case.
- **Exception assumée** : Les fichiers "indexLite" sont optimisés (colonnes courtes comme `insee`, `lng`) — c'est une exception technique documentée.
- **TypeScript strict** : `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`. Pas de `any` sans justification documentée.
- **Alias d'import** : Le préfixe `@/` résout vers `apps/web/` (configuré dans tsconfig via `paths`).
- **shadcn/ui** pour tous les composants UI. Pas de composants custom ad-hoc.
- **Tailwind CSS** pour tout le styling. Couleur de marque : `brand` (`#1b4d3e`).
- **Patterns immutables** partout. Ne jamais muter les données en place.

---

## 8. Qualité & Vérification

**Avant tout commit, ces commandes doivent passer :**

- `pnpm typecheck` — 0 erreur requis
- `pnpm lint:eslint` — 0 warning requis (--max-warnings=0)

**Tests** : requis pour la logique critique lorsque présents (selection, indexes, importer). Framework vitest prévu mais non configuré actuellement.

---

## 9. Fichiers de Référence

Lire avant de modifier le code :

- **CLAUDE.md** (ce fichier) — Source de vérité unique pour architecture et conventions
- `docs/architecture/overview.md` — Diagrammes et patterns d'architecture détaillés
- `docs/architecture/locality-model.md` — Modèle territorial et décisions produit
- `docs/feature/` — Spécifications fonctionnelles par feature (avant d'implémenter une feature)

---

## 10. Pièges à Éviter (Anti-Patterns)

- Ne pas ajouter de logique métier dans les composants React — ça va dans `lib/selection/` ou `lib/data/`
- Ne pas muter les données — patterns immutables partout
- Ne pas créer d'état global React pour ce que `SelectionService` gère déjà
- Ne pas oublier le cleanup des event listeners et des AbortControllers
- Ne pas toucher à `packages/importer` si la tâche concerne le frontend — ces deux packages sont indépendants
- Ne pas créer de dossier features/ vide — créer uniquement quand le code est implémenté
- Le pipeline importer est idempotent : si vous modifiez le schéma de sortie, `export:static` doit pouvoir être rejouée sans effet de bord

## 11. Rules

Always use Context7 MCP when I need library/API documentation, code generation, setup or configuration steps without me having to explicitly ask.
