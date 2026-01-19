# Codex API Guidelines — SOLID, Patterns, and Maintainability (Fastify + Kysely + Postgres)

> **Purpose:** Keep the API hosting-agnostic, testable, and easy to evolve.  
> These rules are **mandatory** for Codex when changing the API.

---

## 0) Non-negotiables

- **Hosting-agnostic**: no coupling to a specific host/provider (Cloudflare-only, AWS-only, etc.).
- **No fat routes**: routes only validate input and delegate to services.
- **One responsibility per module**: route ≠ business logic ≠ DB access ≠ provider calls.
- **No SQL in routes**: DB logic belongs to repository/query modules.
- **Deterministic contracts**: endpoints return stable DTOs with versionable cache keys.
- **Small PRs**: one feature/concern per PR, tests included.

---

## 1) SOLID applied to API code

### S — Single Responsibility Principle (SRP)
- **Routes**: parse/validate, call service, map errors to HTTP.
- **Services**: business use-cases (orchestration, rules).
- **Repositories**: DB queries only (Kysely).
- **Providers**: external APIs (OSRM, geocoders, etc.).
- **Utils**: pure functions (keys, normalization, ranking).

**Red flags**
- Route building SQL or doing ranking logic.
- Services assembling complex SQL queries inline.
- Repository performing HTTP calls.
- Providers writing to DB directly.

### O — Open/Closed Principle (OCP)
- Add new providers via **adapters**, not by editing business logic.
- Extend via new modules and interfaces, not “mega-switches”.

### L — Liskov Substitution Principle (LSP)
- Provider interfaces must have consistent semantics:
  - same DTO shapes
  - same status meaning (OK/NO_ROUTE/ERROR)
  - predictable error types

### I — Interface Segregation Principle (ISP)
Prefer small interfaces:
- `TravelMatrixProvider` and `TravelRouteProvider` can be separate.
- Geocode suggest vs geocode resolve can be separate interfaces.

### D — Dependency Inversion Principle (DIP)
- Services depend on **interfaces** (`CacheStore`, `TravelProvider`, `GeocodeProvider`).
- Concrete implementations are created in composition root (e.g., `createApp()`).

---

## 2) Layered architecture (recommended)

```
apps/api/src/
  routes/          # Fastify routes only
  schemas/         # Zod / JSON schema validation
  services/        # use-cases
  repositories/    # Kysely queries
  providers/       # external HTTP adapters
  cache/           # CacheStore + implementations
  dto/             # shared DTOs (or imported from shared package)
  utils/           # pure helpers (keys, normalization)
  composition/     # wiring (create services/providers)
```

**Rule:** Cross-layer calls only flow downward:
`routes -> services -> (repositories/providers/cache) -> utils`

---

## 3) Contracts & DTO discipline

### 3.1 DTOs are shared, not duplicated
- Define DTOs once (shared package preferred).
- Avoid “almost same” interfaces in multiple places.

### 3.2 Stable response envelopes
- For errors, use a consistent shape:
  - `ApiError { code: string; message: string; details?: unknown; requestId?: string }`
- Always generate a `requestId` and attach it to logs + errors.

### 3.3 Status model for travel
Use:
- `OK`
- `NO_ROUTE`
- `ERROR`

Optional:
- `NOT_SUPPORTED` (prefer this over overloading ERROR when a mode is intentionally disabled)

---

## 4) Validation & input normalization

### 4.1 Always validate inputs at the route boundary
- Use zod (or existing schema system) in `schemas/`.
- Reject invalid requests with 400, include error code.

### 4.2 Normalize user input in pure utils
Examples:
- queries: lowercase, trim, collapse spaces
- separator equivalence: spaces/hyphens/apostrophes treated consistently
- numeric detection: allow postal/dept code queries with shorter length

---

## 5) Caching policy (mandatory)

### 5.1 Cache via CacheStore interface
```
interface CacheStore {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>
}
```

### 5.2 Canonical cache keys (versioned)
- Travel-time (matrix): `tt:v1:{mode}:{zoneId}:{destGeohash6}:{timeBucket}`
- Route (polyline): `route:v1:{mode}:{zoneId}:{destGeohash6}:{timeBucket}`
- Geocode: `geocode:v1:{normalizedQuery}:{nearHash}:{bboxHash}:{limit}`

### 5.3 TTL caps (max retention)
- Geocode: **90 days max**
- Car travel-time: **30 days**
- Transit travel-time: **7 days**
- Route: **30 days**
- `NO_ROUTE`: **24 hours** recommended

### 5.4 Read-through caching
- Lookup by key
- On miss: compute -> store -> return
- Cache per item (per zone) rather than per batch

---

## 6) Database access rules (Kysely + Postgres)

- Queries live in `repositories/`.
- Repositories return **domain objects / DTO-ready data**, not raw DB rows when possible.
- Avoid N+1 queries:
  - batch where possible
  - prefetch required attributes
- Prefer explicit indexes for search:
  - `slug`, `name`, `code`, and postal code fields
- For fuzzy search, prefer Postgres features (optional):
  - `unaccent`, `pg_trgm`

---

## 7) External providers (HTTP adapters)

### 7.1 Provider adapters only
Providers must:
- build request URLs and headers
- parse responses
- map to internal DTOs and statuses
- throw typed errors on network/invalid payload

Providers must NOT:
- access DB directly
- perform caching directly (services do caching)

### 7.2 Timeouts + retries
- Set strict timeouts (3–5 seconds typical).
- At most **one** retry with backoff on transient failures.

### 7.3 Coordinate conventions
- Internal: `{ lat, lng }`
- Provider boundaries:
  - OSRM expects `lon,lat`
  - GeoJSON uses `[lng, lat]`
All conversion lives **inside** provider adapters.

---

## 8) Logging & observability

- Structured logs in services:
  - requestId
  - endpoint/use-case name
  - cache hit/miss counts
  - provider latency
  - batch sizes
- Do not log full user address queries (privacy):
  - log length + hashed query or a redacted version

---

## 9) Testing requirements (no exceptions)

### 9.1 Unit tests
- cache key builders
- normalization utils (hyphen/space)
- provider response mappers (fixture JSON)
- ranking/scoring pure functions

### 9.2 Contract tests
- routes return expected schemas for success and error
- key endpoints:
  - `/api/search`
  - `/api/areas/suggest`
  - `/api/geocode` (and suggest)
  - `/api/travel/matrix`
  - `/api/route`

### 9.3 No network calls in tests
- mock providers
- use fixtures

---

## 10) Design patterns to apply

- **Adapter**: external providers (OSRM, geocoders)
- **Strategy**: choose provider by mode (`car` vs `transit`)
- **Factory**: `createTravelProvider(config)`, `createGeocodeProvider(config)`
- **Repository**: encapsulate DB access
- **Facade** (optional): consolidate a use-case API for complex flows

---

## 11) PR review checklist (Codex must self-check)

- [ ] Routes contain no business logic and no SQL.
- [ ] Input validation exists for all endpoints changed/added.
- [ ] Services depend on interfaces (providers, cache).
- [ ] Provider code contains all external-specific logic (timeouts, coordinate mapping).
- [ ] Cache keys are versioned and built via pure functions.
- [ ] TTL and max retention policy respected.
- [ ] Errors use consistent envelope and include requestId.
- [ ] Tests added/updated and pass.

---

## 12) Definition of Done (API PR)

A PR is done only if:
- [ ] functionality works
- [ ] guidelines above are respected
- [ ] tests pass and new tests exist for critical changes
- [ ] no hosting-specific assumptions were introduced
- [ ] contracts remain backward compatible unless explicitly versioned

