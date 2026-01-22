# Copilot Instructions – Choisir sa ville

## Project Authority
**CRITICAL**: Read `docs/AGENTS.md` before any work. It contains NON-NEGOTIABLE architectural rules for this MVP.

---

## Source of Truth Hierarchy

In case of conflict, the following order applies (highest priority first):

1. `docs/AGENTS.md`
2. `specs/*`
3. `packages/core` (types + schemas)
4. `docs/*`
5. `copilot-instructions.md`

If two documents contradict each other, ALWAYS follow the highest priority source.

---

## Architecture Overview

This is a PNPM monorepo with strict separation of concerns:

```
packages/
  core/       # Pure business logic, Zod schemas, NO infrastructure
  db/         # Kysely DB access, migrations (Postgres only)
  importer/   # Batch data imports (NEVER called from API)

apps/
  api/        # Fastify HTTP adapter ONLY (no business logic)
  web/        # Angular 20.x LTS frontend (NON-NEGOTIABLE)
```

### Critical Package Boundaries

- `packages/core`: ❌ NO DB access, NO HTTP code, NO platform-specific code
- `apps/api`: ❌ NO business logic, NO raw SQL, ✅ validation + HTTP orchestration only
- `packages/db`: ✅ Kysely ONLY, migrations mandatory
- `packages/importer`: ❌ NEVER called from API, ✅ batch pipelines only

Importer code is NEVER bundled, imported, or referenced by:
- `apps/api`
- `apps/web`
- `packages/core`

Importer is a standalone execution context (CLI only).

---

## Spec-Driven Development (MANDATORY)

Code MUST follow specs, not the other way around.

- `specs/*` define expected behavior
- code adapts to specs
- specs are not retrofitted to match existing code

---

## Data Model – Territorial Hierarchy

**Commune (city) is the pivot unit**. Infra zones are NEVER communes:

```
Pays → Région → Département → Commune (pivot)
                                 └─ Zone infra-communale (ARM/COMD/COMA)
```

- **COM** → `commune` table (primary)
- **ARM/COMD/COMA** → `infra_zone` table (linked via `parentCommuneCode`)
- ARM (arrondissements) are first-class for UX (Paris 11e vs Paris 16e)

See `docs/LOCALITY_MODEL.md` for details.

---

## Naming Conventions (NON-NEGOTIABLE)

**camelCase everywhere**: DB columns, TypeScript, JSON API responses.

```ts
// ✅ Correct
inseeCode, parentCommuneCode, departmentCode

// ❌ FORBIDDEN
insee_code, parent_commune_code, department_code
```

Zero friction between DB ↔ code ↔ API is mandatory.

---

## Tech Stack Constraints

### Backend
- Node.js 20+
- Fastify (stateless API)
- Kysely for DB
- PostgreSQL only

### Frontend
- **Angular 20.x (LTS)** – FIXED, NON-NEGOTIABLE
- ❌ NO React / Vue / Svelte / Next
- Classic Angular patterns: components + services + DI + RxJS
- Map: Leaflet, initialized once (`ngOnInit`), destroyed properly (`ngOnDestroy`)
- Map events: only `moveend` / `zoomend` (NEVER `move`)
- API calls must be debounced and use `switchMap`

### Validation
- Zod schemas in `packages/core`
- Strict TypeScript everywhere
- All API errors follow `docs/API_CONTRACT.md`

---

## Development Workflows

### Database
```bash
docker compose up -d
pnpm -C packages/db migrate
pnpm -C packages/db reset   # dev only
```

### Data Import
```bash
pnpm -C packages/importer import:insee
pnpm -C packages/importer import:insee --dry-run --limit 100
```

### Running Services
```bash
pnpm --filter api dev
pnpm --filter web dev
pnpm -C packages/core test
```

---

## Key Patterns

### Schema Definition
```ts
export const CitySearchQuery = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  offset: z.coerce.number().int().min(0).default(0)
});
```

### Migration Pattern
```ts
export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("commune")
    .addColumn("inseeCode", "varchar(5)", (c) => c.notNull().primaryKey())
    .execute();
}
```

### API Error Format (MANDATORY)
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human readable",
    "details": {}
  }
}
```

---

## What NOT to Do

1. ❌ Express (use Fastify)
2. ❌ React patterns in Angular
3. ❌ snake_case in DB/code/API
4. ❌ Business logic in `apps/api`
5. ❌ Direct DB access from `packages/core`
6. ❌ Platform-specific runtimes (Cloudflare Workers, D1, KV)
7. ❌ Calling importer from API runtime
8. ❌ Map listeners on `move` (use `moveend` only)

---

## Intentionally Missing (for now)

The following are expected to be absent or incomplete at this stage:

- API route implementations
- Frontend UI components
- Scoring engine
- Map city visibility logic

Do NOT stub, guess, or invent implementations without an explicit spec.

---

## Documentation Map

- `docs/AGENTS.md` – Authority document
- `docs/LOCALITY_MODEL.md` – Territorial model
- `docs/API_CONTRACT.md` – HTTP contract
- `docs/DB_MODEL.md` – Database schema
- `docs/INDEX.md` – Full documentation index

---

## MVP Philosophy

> Commune is the foundation.  
> Infra zones provide precision.  
> Portability > infrastructure convenience.  
> Readability > premature abstraction.
