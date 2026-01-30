# AGENTS – Décisions structurantes (MVP / POC)

Ce document est l’autorité technique et produit du projet.
Il définit les règles NON NÉGOCIABLES pour le MVP.
Tout agent (humain ou IA) doit s’y conformer strictement.

---

In case of conflict, specs/*override docs/*

## 1. Architecture générale

- Monorepo PNPM obligatoire
- Séparation stricte des responsabilités :

apps/
  api/                        # Adaptateur HTTP uniquement (Fastify)
    CODEX_API_GUIDELINES.md   # Contient les règles de développement à appliquer
  web/                        # Frontend Next.js + Tailwind + shadcn/ui
    CODEX_WEB_GUIDELINES.md   # Contient les règles de développement à appliquer

packages/
  core/       # Logique métier pure, types, Zod (aucune infra)
  db/         # Accès DB, Kysely, migrations, scripts CLI
  importer/   # Pipelines d’import hors runtime API

### Règles fondamentales

- `packages/core` :
  - ❌ aucun accès DB
  - ❌ aucun code HTTP
  - ❌ aucun code dépendant de l’hébergeur
- `apps/api` :
  - ❌ aucune logique métier
  - ❌ aucun SQL direct
  - ✅ orchestration + validation + mapping HTTP
- `packages/db` :
  - ✅ Kysely uniquement
  - ✅ migrations obligatoires
- `packages/importer` :
  - ❌ jamais appelé depuis l’API
  - ✅ pipelines batch uniquement
- `specs/` : documents normatifs (doivent être respectés par le code)
- `docs/` : documents explicatifs ou contextuels

---

## 2. Backend / Runtime

- Node.js 20+ obligatoire
- Fastify obligatoire
- API stateless

Interdits :

- Express
- Cloudflare Workers runtime (pour le MVP)
- Framework backend imposé par un hébergeur

---

## 3. Frontend (NON NÉGOCIABLE)

### Framework

- `apps/web` est une application **Next.js** (React) avec **Tailwind CSS** + **shadcn/ui**

Interdits :

- Vue
- Svelte
- Nuxt (le frontend est Next.js)

### Règles frontend (générales)

- Pas de logique métier lourde dans les composants UI
- Éviter le coupling UI ↔ infra : typage explicite, séparation components / services (fetchers) / mapping
- Requêtes réseau :
  - debounced côté UI quand nécessaire
  - requêtes annulées si obsolètes (AbortController)
  - aucun spam réseau autorisé

### Carte & Leaflet / OSM (NON NÉGOCIABLE)

- Initialisation de la carte : une seule fois (montage)
- Destruction propre : remove/unsubscribe à l’unmount
- Événements carte :
  - uniquement `moveend` et `zoomend`
  - jamais `move`
- Chargements basés viewport :
  - debounce + annulation
  - déduplication des requêtes identiques

Objectif : stabilité, performance, comportement prévisible.

---

## 4. Modèle territorial (décision produit)

Hiérarchie officielle :

Pays
 └── Région
     └── Département
         └── Commune (pivot garanti)
             └── Zone infra-communale (optionnelle)
                 └── Adresse / Point

### Correspondance INSEE

- COM → Commune
- ARM → Arrondissement municipal
- COMD → Commune déléguée
- COMA → Commune associée

### Décisions clés

- La commune est l’unité pivot.
- Les zones infra :
  - ne sont jamais des communes
  - sont toujours rattachées à une commune parente
- Les ARM sont prioritaires pour logement / sécurité / qualité de vie.

Voir `docs/LOCALITY_MODEL.md`.

---

## 5. Base de données

- PostgreSQL uniquement
- Accès via Kysely
- Migrations obligatoires

### Naming conventions (NON NÉGOCIABLE)

- camelCase partout :
  - DB
  - TypeScript
  - API JSON

Exemples :

- inseeCode
- parentCommuneCode

Interdits :

- snake_case
- mapping implicite DB ↔ code

Objectif : zéro friction DB / code / API.

---

## 6. Import de données

- Tous les imports passent par `packages/importer`
- Jamais depuis l’API
- Imports :
  - idempotents
  - batchés
  - rejouables

---

## 7. Configuration & environnement

- Variables d’environnement uniquement
- `.env.example` à jour
- Aucun secret en dur

Scripts CLI :

- compatibles Windows
- indépendants de l’API

---

## 8. Validation & typage

- TypeScript strict
- Zod obligatoire
- Erreurs conformes à `API_CONTRACT.md`

---

## 9. Portabilité

- API déployable sur VPS / Docker / cloud standard
- Front déployable indépendamment

Interdits :

- dépendances Cloudflare (Workers, D1, KV)
- hypothèses infra dans le code métier

---

## 10. Règles de contribution (humain & IA)

Avant toute implémentation :

1. Respecter ce document
2. Respecter `API_CONTRACT.md`
3. Respecter `LOCALITY_MODEL.md`
4. Respecter les frontières de packages

Tout code non conforme doit être corrigé ou refusé.

---

## 11. Philosophie MVP

- Lisibilité > abstraction prématurée
- Portabilité > confort infra
- Simplicité > sur-architecture

> La commune est le socle.  
> Les zones infra apportent la précision.  
> Ne jamais aplatir les données au mauvais niveau.
