# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Commandes essentielles

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

Il n'y a pas de framework de test configuré en ce moment (vitest est prévu). `pnpm test` ne fait rien d'utile.

---

## Architecture — points critiques

**C'est un monorepo pnpm avec deux packages :**
- `apps/web` — Application Next.js 15 (App Router). Tout le frontend.
- `packages/importer` — Script Node.js batch uniquement. Génère les données statiques dans `apps/web/public/data/`. **Jamais appelé au runtime.**

**Il n'y a aucun backend API et aucune base de données.** Le `docker-compose.yml` à la racine et les références PostgreSQL dans `.env` sont des restes de l'architecture v0.1.x — les ignorer. De même, `apps/api` n'existe plus.

**Les données sont versionées** dans `apps/web/public/data/v{YYYY}-{MM}-{DD}/`. Un symlink `current` pointe vers la dernière version. Le frontend récupère les données via des requêtes HTTP vers ces fichiers statiques.

---

## Séparation des responsabilités dans `apps/web/lib/`

Cette séparation est **non négociable**. Les quatre couches ne se mélangent pas :

| Couche | Dossier | Rôle | Dépendances autorisées |
|--------|---------|------|------------------------|
| **Selection** | `lib/selection/` | État de sélection (highlighted / active). Pattern observable avec listeners. | TypeScript pur — **aucune** dépendance React ni MapLibre |
| **Data** | `lib/data/` | Accès aux données via `EntityDataProvider` (interface). Implémentations : `StaticFilesEntityDataProvider` (fetch HTTP) + décorateur `CachedEntityDataProvider` (IndexedDB, TTL 7 jours). Hooks React : `useEntity`, `useCommune`, `useInfraZone`. | Peut importer de `lib/selection/` pour lire l'état |
| **Map** | `lib/map/` | Adaptateur MapLibre. Consomme `SelectionService`, produit des événements highlight/active, applique les feature-states sur les labels. | Dépend de `lib/selection/`. **Ne fetch pas les données directement.** |
| **Components** | `components/` | UI React uniquement. Consomme les hooks de selection et data. | Hooks uniquement — pas d'accès direct à la carte ni à la logique métier |

---

## Règles carte MapLibre (anti-patterns fréquents)

- Utiliser **uniquement** les événements `moveend` et `zoomend`. **Jamais `move`** — trop fréquent, cause du spam.
- Les interactions pointer commencent toujours par `queryRenderedFeatures` sur les **labels**, pas sur les polygones. Les polygones servent uniquement à la désambiguïsation.
- Feature-state : vocabulaire strict — `hasData`, `highlight`, `active`.
- Chaque requête réseau déclenché par la carte doit utiliser `AbortController` pour l'annulation et le debounce.

---

## Modèle territorial

La **commune** est l'unité pivot de tout le système de données. Les types INSEE se découpent ainsi :

- `COM` → Commune (niveau pivot, toujours présent)
- `ARM` / `COMD` / `COMA` → Zones infra-communales, toujours rattachées à une commune parente via `parentId`

**Ne jamais aplatir ces niveaux.** Une infra-zone n'est jamais traitée comme une commune. Le type central pour référencer une entité est `EntityRef` avec un champ `kind` (`"commune"` | `"infraZone"`).

---

## Conventions de code

- **camelCase partout** : code TypeScript, clés JSON de données, noms de fichiers. Jamais de snake_case.
- **TypeScript strict** : `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`. Pas de `any` sans justification documentée.
- **Alias d'import** : Le préfixe `@/` résout vers `apps/web/` (configuré dans tsconfig via `paths`).
- **shadcn/ui** pour tous les composants UI. Pas de composants custom ad-hoc.
- **Tailwind CSS** pour tout le styling. Couleur de marque : `brand` (`#1b4d3e`).

---

## Fichiers de référence à lire avant de modifier le code

- `AGENTS.md` — Règles techniques exhaustives du projet (source de vérité).
- `docs/architecture/overview.md` — Diagrammes et patterns d'architecture détaillés.
- `docs/architecture/locality-model.md` — Modèle territorial et décisions produit.
- `docs/feature/` — Spécifications fonctionnelles par feature (avant d'implémenter une feature).

---

## Pièges à éviter

- Ne pas ajouter de logique métier dans les composants React — ça va dans `lib/selection/` ou `lib/data/`.
- Ne pas mutiger les données — patterns immutables partout.
- Ne pas créer d'état global React pour ce que `SelectionService` gère déjà.
- Ne pas oublier le cleanup des event listeners et des AbortControllers.
- Ne pas toucher à `packages/importer` si la tâche concerne le frontend — ces deux packages sont indépendants.
- Le pipeline importer est idempotent : si vous modifiez le schéma de sortie, `export:static` doit pouvoir être rejouée sans effet de bord.
