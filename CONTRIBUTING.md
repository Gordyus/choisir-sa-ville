# Guide de contribution

## Lecture obligatoire

1. `README.md`
2. `AGENTS.md` (règles NON NÉGOCIABLES)
3. `docs/ARCHITECTURE.md`
4. `docs/LOCALITY_MODEL.md`

## Pré-requis

- Node.js ≥ 22
- pnpm ≥ 10

## Setup

```bash
pnpm install
pnpm export:static
pnpm dev
```

## Checks avant PR

```bash
pnpm typecheck
pnpm lint:eslint
```

## Conventions de branches / commits

- Branches : `feat/*`, `fix/*`, `docs/*`, `refactor/*`, `chore/*`
- Messages : `feat: ...`, `fix: ...`, `docs: ...` (format libre mais clair)

## Documentation

Toute modification d’architecture ou de format de données implique une mise à jour de :
- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_PIPELINE.md` (si pipeline/dataset)

