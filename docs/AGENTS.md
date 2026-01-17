# AGENTS – Décisions structurantes (MVP / POC)

Ce document est l’autorité technique et produit du projet.
Il définit les règles NON NÉGOCIABLES pour le MVP.
Tout agent (humain ou IA) doit s’y conformer strictement.

---

## 1. Architecture générale

- Monorepo PNPM obligatoire
- Séparation stricte des responsabilités :

apps/
  api/        # Adaptateur HTTP uniquement (Fastify)
  web/        # Front (stack libre, agnostique hébergement)

packages/
  core/       # Logique métier pure, types, Zod (aucune infra)
  db/         # Accès DB, Kysely, migrations, scripts CLI
  importer/  # Pipelines d’import hors runtime API

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

## 3. Modèle territorial (décision produit)

Le modèle territorial est fondé sur la hiérarchie suivante :

Pays
 └── Région
     └── Département
         └── Commune (niveau garanti partout)
             └── Zone infra-communale (optionnelle)
                 └── Adresse / Point

### Correspondance INSEE

- `COM` → Commune
- `ARM` → Zone infra-communale (arrondissements municipaux)
- `COMD` → Zone infra-communale (communes déléguées)
- `COMA` → Zone infra-communale (communes associées)

### Décisions clés

- La **commune (COM)** est le niveau pivot garanti.
- Les **zones infra-communales** :
  - ne sont jamais traitées comme des communes
  - sont toujours rattachées à une commune parente
- Les arrondissements (`ARM`) sont des zones de **premier ordre** pour :
  - logement
  - sécurité
  - qualité de vie urbaine

Voir `docs/LOCALITY_MODEL.md` pour le détail complet.

---

## 4. Base de données

- PostgreSQL uniquement
- En local : PostgreSQL via Docker Compose
- Accès DB via Kysely
- Migrations obligatoires, versionnées

### Naming conventions (NON NEGOTIABLE)

Database, TypeScript, and API JSON fields MUST use the same naming.

- Column names: camelCase (e.g. inseeCode, parentCommuneCode)
- TypeScript fields: camelCase
- API JSON fields: camelCase

Do NOT use snake_case in database columns.
Do NOT auto-lowercase identifiers.
PostgreSQL is case-sensitive only when quoted; Kysely uses quoted identifiers.

This rule exists to:

- avoid mapping layers
- reduce IA and human errors
- keep DB <-> code alignment

### Règles SQL

- ❌ aucune requête SQL dans `packages/core`
- ❌ aucune requête SQL directe dans `apps/api`
- ✅ tout accès DB passe par `packages/db`

### Migrations (Windows / ESM)

- Compatibles Windows + ESM
- Imports dynamiques via `file://` URLs (`pathToFileURL`)
- Defaults DB via `sql`now()``

---

## 5. Import de données

- Tous les imports (INSEE, autres sources) :
  - sont faits via `packages/importer`
  - jamais depuis l’API runtime
- Les imports doivent être :
  - idempotents
  - batchés
  - rejouables

---

## 6. Configuration & Environnement

- Configuration uniquement via variables d’environnement
- `.env.example` toujours à jour
- Aucun secret en dur

Les scripts CLI doivent :

- fonctionner en local (Windows inclus)
- charger correctement les variables d’env
- être exécutables indépendamment de l’API

---

## 7. Validation & Typage

- TypeScript strict
- Validation Zod obligatoire (entrées API, DTOs)
- Erreurs standardisées selon `API_CONTRACT.md`

---

## 8. Portabilité / Hébergement

Objectif : application totalement agnostique de l’environnement.

- API déployable sur :
  - OVH
  - VPS
  - Docker
  - cloud standard
- Front déployable séparément (Cloudflare Pages, autre)

Interdits :

- dépendances Cloudflare (Workers, D1, KV)
- hypothèses infra dans le code métier

---

## 9. Règles de contribution (humain & IA)

Avant toute implémentation :

1. Respecter ce document
2. Respecter `API_CONTRACT.md` et `LOCALITY_MODEL.md`
3. Respecter les frontières de packages
4. Ne pas introduire de nouvelle techno sans validation

Tout code non conforme :

- doit être refusé
- ou corrigé immédiatement

---

## 10. Philosophie MVP

- Lisibilité > abstraction prématurée
- SQL explicite > magie ORM
- Portabilité > confort hébergeur
- Simplicité > sur-architecture

> Une commune est le socle.  
> Les zones infra apportent la précision.  
> Les données ne doivent jamais être aplaties au mauvais niveau.

---
