# ChoisirSaVille – MVP / POC (Local Dev Skeleton)

This repository is a **portable** (host-agnostic) baseline:
- API: **Node.js 20 + Fastify** (performance-oriented)
- DB: **PostgreSQL** (Docker for local dev)
- Monorepo: **PNPM workspaces**
- Strict boundaries:
  - `packages/core`: domain logic + types (no infra)
  - `packages/db`: database access + migrations
  - `apps/api`: HTTP adapter (no business logic)

## Prerequisites
- Node.js 20+
- pnpm (`corepack enable` recommended)
- Docker + Docker Compose

## Quickstart
```bash
cp .env.example .env
pnpm install
docker compose up -d
pnpm db:migrate
pnpm dev
```

Then:
- API health: http://localhost:8787/health

## Useful commands
```bash
pnpm dev            # run API in watch mode
pnpm db:migrate     # apply migrations
pnpm db:reset       # drop & recreate schema (dev only)
pnpm lint
pnpm typecheck
```

## Project structure
```
apps/
  api/              # Fastify HTTP API
  web/              # (stub) front app placeholder
packages/
  core/             # domain types + validation
  db/               # Kysely + migrations
docs/               # project documentation
```
