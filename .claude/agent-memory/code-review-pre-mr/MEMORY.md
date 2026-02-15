# Code Review Agent Memory

## Project Context

**Project**: Choisir sa Ville (greenfield Next.js + Fastify app)
**Architecture**: Jamstack extended (static data + Next.js + minimal backend routing API)
**Branch Reviewed**: feature/mvp-phase1-backend-routing

## Key Standards (From CLAUDE.md)

### Non-Negotiable Rules
1. **TypeScript Strict Mode**: All files must have `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`
2. **camelCase Everywhere**: Code, JSON keys, filenames (no snake_case)
3. **Four-Layer Architecture** (apps/web only): Selection / Data / Map / Components - must never mix
4. **Backend Scope**: STRICTLY limited to routing orchestration - NO business logic, NO data aggregation
5. **Adapter Pattern**: Required for provider abstraction (RoutingProvider interface)
6. **No Legacy Code**: Greenfield project - zero tolerance for backward compatibility shims

### Backend API Specific Rules (apps/api)
- Domain-driven structure: routing/, health/, shared/
- Provider abstraction via factory pattern
- No direct TomTom imports outside factory.ts
- Fastify framework (not Express, not Hono despite what AGENTS.md says)
- Geohash6 snapping + time bucketing for cache optimization
- Error margin +10% on travel times

## Common Anti-Patterns Found in This Codebase

### ✅ GOOD PATTERNS (Found in feature/mvp-phase1-backend-routing)
1. **Proper TypeScript strictness**: All files use strict mode, proper typing
2. **Clean adapter pattern**: RoutingProvider interface with factory
3. **Separation of concerns**: Cache, providers, utils cleanly separated
4. **Comprehensive testing**: Unit + integration tests with good coverage
5. **Proper error handling**: Custom error classes, HTTP status mapping
6. **Environment validation**: validateEnv() at startup with clear messages

### ❌ ANTI-PATTERNS TO WATCH FOR
1. **Framework mismatch**: AGENTS.md says "Fastify" but could drift to Hono - stay vigilant
2. **Scope creep**: Backend must NEVER add business logic (scoring, filtering, aggregations)
3. **Provider coupling**: Code must NEVER import TomTomProvider directly (only via interface)

## Review Insights

### Branch: feature/mvp-phase1-backend-routing

**Status**: APPROVED FOR MERGE (with minor documentation note)

**Highlights**:
- Excellent architecture alignment with specs
- Clean TypeScript, proper error handling
- Comprehensive test coverage (unit + integration)
- Follows adapter pattern correctly
- No code smells, TODOs, or technical debt

**Minor Issues**:
- AGENTS.md mentions "Hono" backend but implementation uses Fastify (doc inconsistency, not code issue)
- This is acceptable as it matches the original spec.md which specified Fastify

**Key Learnings**:
1. This branch demonstrates EXCELLENT greenfield architecture - use as reference
2. Adapter pattern implementation is textbook quality
3. Test structure (unit/ and integration/ separation) should be standard
4. Environment validation pattern (validateEnv.ts) should be reused

## Checklist Template for Future Reviews

### Architecture Compliance
- [ ] Backend scope limited to routing/geocoding (no business logic)
- [ ] Provider abstraction via interface (no direct imports)
- [ ] Domain-driven structure (routing/, health/, shared/)
- [ ] TypeScript strict mode enabled

### Code Quality
- [ ] No TODO/FIXME/HACK comments
- [ ] No `any` types (unless documented)
- [ ] No dead code or unused imports
- [ ] Proper error handling with custom error classes
- [ ] camelCase naming throughout

### Testing
- [ ] Unit tests for utils and providers
- [ ] Integration tests for API endpoints
- [ ] Test coverage >80% for critical paths

### Documentation
- [ ] README.md up to date
- [ ] API endpoints documented
- [ ] Environment variables documented
- [ ] Architecture decisions recorded

## Notes

- The routing backend is a rare case where backend code is allowed (strict exception due to departure time requirement)
- Future features should remain client-side unless similarly justified
- This implementation is reference quality - can be used as template for future backend needs
