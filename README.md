# Choisir sa ville

Monorepo du projet **Choisir sa ville**.

Objectif : aider à comparer et sélectionner des zones géographiques en France
(communes, EPCI, départements…) selon des critères objectifs
(loyers, population, accessibilité, agrégats, etc.).

Ce dépôt est volontairement structuré pour :

- séparer strictement la logique métier, l’accès aux données et les adaptateurs
- permettre une évolution progressive du POC vers un MVP
- éviter toute dérive “spaghetti front / back”

---

## Structure du repo

apps/
  api/        # API HTTP (Fastify) – adaptateur uniquement
  web/        # Frontend web (Next.js App Router)

packages/
  core/       # Logique métier pure, agrégats, règles, schémas
  db/         # Accès base de données, migrations, repositories

docs/         # Documentation technique et produit
specs/        # Spécifications fonctionnelles et techniques
tools/        # Outils batch / import (hors runtime)

---

## Prérequis

- Node.js ≥ 20
- pnpm
- Docker (pour Postgres en local)

---

## Installation

pnpm install

---

## Développement local

### Base de données

docker compose up -d

### API

pnpm --filter api dev

### Frontend web (Next.js)

```
pnpm -C apps/web dev          # serveur de dev avec rechargement
pnpm -C apps/web typecheck    # vérifie le typage strict
pnpm -C apps/web lint         # lint React/TS
pnpm -C apps/web build        # build de prod
pnpm -C apps/web start        # serveur Next.js en mode prod
```

---

## Documentation

Voir docs/INDEX.md

---

## Règles du projet

Les règles techniques et architecturales non négociables sont définies dans :
docs/AGENTS.md
