# Backend Routing Service

Minimal backend API for travel time calculations with intelligent caching.

## Overview

This service orchestrates external routing API calls (TomTom, OSRM, etc.) to calculate travel times with departure time specificity. It implements:

- **Pattern Adapter** for routing provider abstraction
- **Geohash6 snapping** (~1km precision) for cache optimization
- **Time bucketing** (30-minute slots) for cache hit rate improvement
- **Error margin** (+10% default) for realistic travel time estimates
- **Rate limiting** (6 req/min per IP)

## Architecture

The project is organized by **domain** (routing, health) with shared cross-domain code:

```
apps/api/
├── src/
│   ├── index.ts                     # Fastify entry point
│   ├── config/                      # Configuration globale
│   │   └── validateEnv.ts
│   ├── shared/                      # Code partagé cross-domain
│   │   ├── errors/
│   │   │   └── index.ts             # QuotaExceededError, TimeoutError
│   │   └── types/
│   │       └── ngeohash.d.ts        # Type declarations
│   ├── routing/                     # Domaine: Routing externe
│   │   ├── routes.ts                # POST /api/routing/matrix, /geocode
│   │   ├── service.ts               # RoutingService (orchestration)
│   │   ├── providers/
│   │   │   ├── interface.ts
│   │   │   ├── TomTomProvider.ts
│   │   │   ├── MockProvider.ts
│   │   │   └── factory.ts
│   │   ├── cache/
│   │   │   ├── interface.ts
│   │   │   └── MockCacheService.ts
│   │   └── utils/
│   │       ├── geohash.ts
│   │       ├── timeBucket.ts
│   │       └── errorMargin.ts
│   └── health/                      # Domaine: Monitoring
│       └── routes.ts                # GET /api/health
└── __tests__/
    ├── routing/
    │   ├── unit/
    │   └── integration/
    └── health/
        └── integration/
```

### Design Principles

- **Domain-Driven Structure**: Code organized by business domain (routing, health) rather than technical layers
- **Shared Resources**: Common code (errors, types) lives in `shared/` to avoid duplication
- **Provider Abstraction**: Business logic never imports `TomTomProvider` directly. All interactions go through `RoutingProvider` interface created by `factory.ts`

### Request Flow

```
POST /api/routing/matrix → RoutingService → RoutingProvider (TomTom/Mock)
                              ↓
                          CacheService (Memory/PostgreSQL)
```

## Quick Start

### Installation

```bash
cd apps/api
pnpm install
```

### Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

For development with **MockProvider** (no API key needed):
```bash
ROUTING_PROVIDER=mock
ENABLE_CACHE=false
PORT=3001
CORS_ORIGIN=http://localhost:3000
NODE_ENV=development
```

For production with **TomTom**:
```bash
ROUTING_PROVIDER=tomtom
TOMTOM_API_KEY=your_api_key_here
ENABLE_CACHE=true
DATABASE_URL=postgresql://...
```

### Development

```bash
pnpm dev  # Starts server with watch mode on port 3001
```

### Build

```bash
pnpm build  # Compiles TypeScript to dist/
```

### Production

```bash
pnpm start  # Runs compiled dist/index.js
```

## Testing

### Run all tests

```bash
pnpm test
```

### Unit tests only

```bash
pnpm test:unit
```

### Integration tests only

```bash
pnpm test:integration
```

### Type checking

```bash
pnpm typecheck
```

## API Endpoints

### POST /api/routing/matrix

Calculate travel time matrix between origins and destinations.

**Request:**
```json
{
  "origins": [{ "lat": 43.6108, "lng": 3.8767 }],
  "destinations": [{ "lat": 48.8566, "lng": 2.3522 }],
  "departureTime": "2026-03-15T08:30:00Z",
  "mode": "car"
}
```

**Response:**
```json
{
  "durations": [[25200]],
  "distances": [[750000]],
  "fromCache": false
}
```

### POST /api/geocode

Convert address to GPS coordinates.

**Request:**
```json
{
  "address": "1 Rue de Rivoli, 75001 Paris, France"
}
```

**Response:**
```json
{
  "lat": 48.8606,
  "lng": 2.3376
}
```

### GET /api/health

Health check for monitoring.

**Response:**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptime": 3600,
  "provider": "mock",
  "cache": {
    "enabled": false
  },
  "environment": "development"
}
```

## Manual Testing with curl

### Health check
```bash
curl http://localhost:3001/api/health
```

### Routing matrix
```bash
curl -X POST http://localhost:3001/api/routing/matrix \
  -H "Content-Type: application/json" \
  -d '{
    "origins": [{"lat": 43.6108, "lng": 3.8767}],
    "destinations": [{"lat": 48.8566, "lng": 2.3522}],
    "departureTime": "2026-03-15T08:30:00Z",
    "mode": "car"
  }'
```

### Geocoding
```bash
curl -X POST http://localhost:3001/api/geocode \
  -H "Content-Type: application/json" \
  -d '{"address": "1 Rue de Rivoli, Paris"}'
```

## Cache Strategy

### Geohash6 Snapping

Coordinates are snapped to geohash6 grid (~1km precision):
- Montpellier: `43.6108, 3.8767` → `spey2b`
- Reduces 35k communes to ~5k unique geohashes

### Time Bucketing

Departure times rounded to 30-minute slots:
- `08:17` → `08:00`
- `08:43` → `08:30`

### Cache Key Format

```
{geohashOrigin}_{geohashDest}_{timeBucket}_{mode}
Example: spey2b_spfn48_2026-03-15T08:30:00Z_car
```

### TTL

Default: 30 days (configurable via `CACHE_TTL_DAYS`)

## Error Handling

- **Quota exceeded** (403) → 503 Service Unavailable
- **Timeout** (10s) → 504 Gateway Timeout
- **Rate limit** (6 req/min) → 429 Too Many Requests

## Deployment

### Railway.app (Recommended MVP)

1. Create new project on Railway.app
2. Connect GitHub repository
3. Set environment variables
4. Deploy automatically on push

**Free tier**: 500h/month execution (sufficient for MVP)

### Environment Variables (Production)

```bash
ROUTING_PROVIDER=tomtom
TOMTOM_API_KEY=***
ENABLE_CACHE=false  # true if PostgreSQL added
DATABASE_URL=postgresql://...
PORT=3001
CORS_ORIGIN=https://choisir-sa-ville.fr
NODE_ENV=production
SENTRY_DSN=***  # Optional
```

## Monitoring

Key metrics to track:
- **Cache hit rate**: Target >70%
- **Latency P95**: Target <5s
- **Error rate**: Target <1%
- **TomTom quota**: 2500 req/day free tier

## Provider Migration

Thanks to the Adapter pattern, switching providers requires:

1. Create new provider class (e.g., `OSRMProvider.ts`)
2. Implement `RoutingProvider` interface
3. Add case to `factory.ts`
4. Change `ROUTING_PROVIDER` env variable

**Zero business logic changes required.**

## License

MIT
