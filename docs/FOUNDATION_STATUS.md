# Foundation status – Verification checklist

This document captures the minimal commands to validate the current repository foundation.

---

## Structure check

- `git ls-files`

## Workspace check

- `pnpm -r list --depth -1`

## TypeScript

- `pnpm -r typecheck`

## API run

- `pnpm --filter api build`
- `pnpm --filter api start`

## API test

- `curl http://localhost:3000/api/health`
- `curl http://localhost:3000/api/version`

## Lint

- `npm run lint` (runs `pnpm -r lint` placeholders)
- `pnpm lint:eslint` (root ESLint gate)

## Note

- Root ESLint intentionally excludes `packages/importer` for now.
