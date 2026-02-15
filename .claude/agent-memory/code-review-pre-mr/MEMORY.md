# Code Review Agent Memory

## Project Context

**Project**: Choisir sa Ville (greenfield Next.js + Fastify app)
**Architecture**: Jamstack extended (static data + Next.js + minimal backend routing API)

## Key Standards (From CLAUDE.md)

### Non-Negotiable Rules
1. **TypeScript Strict Mode**: `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`
2. **camelCase Everywhere**: Code, JSON keys, filenames (exception: external API interface fields match provider contract)
3. **Four-Layer Architecture** (apps/web only): Selection / Data / Map / Components
4. **Backend Scope**: STRICTLY limited to routing orchestration - NO business logic
5. **Adapter Pattern**: Required - RoutingProvider interface, factory.ts is only instantiation point
6. **No Legacy Code**: Greenfield project - zero tolerance

### Backend API Specific Rules (apps/api)
- Domain-driven structure: routing/, health/, shared/
- Fastify framework (NOT Express, NOT Hono)
- TypeScript strict config verified in `apps/api/tsconfig.json`
- Custom error classes: `shared/errors/index.ts` (QuotaExceededError, TimeoutError)
- Geohash6 snapping + time bucketing for cache (post-MVP)

## Provider Implementation Patterns

All providers follow this established pattern:
- `p-retry` for retries (2 retries, 1s min timeout, warn on failure)
- Types from `./interface.js`, errors from `../../shared/errors/index.js`
- AbortController + setTimeout for timeouts, cleanup in `finally` block
- External API interfaces may use snake_case (matching provider API) - acceptable
- Mode mapping via private method (`mapModeTo*`)

### Provider Inventory
| Provider | File | Notes |
|----------|------|-------|
| TomTom | TomTomProvider.ts | Cloud API, O(N*M) loop for matrix, QuotaExceededError on 403 |
| Navitia | NavitiaProvider.ts | SNCF API, coverage detection, Basic auth, QuotaExceededError on 429 |
| Valhalla | ValhallaProvider.ts | Self-hosted, native batch matrix, 6-digit polyline decoder |
| Mock | MockProvider.ts | Haversine, no external calls |
| Smart | SmartRoutingProvider.ts | Delegates by mode via ProviderMap |

## Common Issues Found

### DateTime Formatting Regex Bug
- Regex stripping "last :XX" from ISO strings can eat minutes if input lacks seconds
- Safe pattern: `isoString.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/)`
- Valhalla expects LOCAL time - never use `new Date()` parsing (converts to UTC)

### Stale Comments After Provider Wiring Changes
- When factory.ts changes provider assignments, SmartRoutingProvider.ts JSDoc must be updated
- README.md provider comparison table must also be updated

### Breaking Schema Changes
- Schema maxItems reductions (e.g., destinations 100->3) are breaking - note in PR

## Checklist for Backend Routing PRs

- [ ] `pnpm typecheck` passes (0 errors)
- [ ] Provider implements full RoutingProvider interface
- [ ] Factory.ts is the only place provider is instantiated
- [ ] No business logic (scoring, filtering, aggregation)
- [ ] AbortController cleanup in finally blocks
- [ ] Retry logic with p-retry (consistent pattern)
- [ ] Error handling matches existing providers
- [ ] camelCase in code, snake_case only in external API interfaces
- [ ] JSDoc comments accurate (especially SmartRoutingProvider)
- [ ] ENV validation in validateEnv.ts for new env vars
- [ ] No `any` types without justification
- [ ] docker-compose.yml: no deprecated `version` field

## Notes

- Backend routing is a rare exception where backend code is allowed (departure time requirement)
- This implementation is reference quality - use existing providers as template
- `mapModeTo*` methods accept `string` instead of union type across all providers (pre-existing pattern, minor)
