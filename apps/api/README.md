# Backend Routing Service

Minimal Fastify backend for travel time calculations with intelligent caching and routing provider abstraction.

## Quick Start

```bash
# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# Edit .env and add your API key (see Routing Providers below)

# Start development server
pnpm dev

# Server runs on http://localhost:3005
# Swagger UI at http://localhost:3005/docs
```

## Routing Providers

The API supports multiple routing providers via environment configuration:

| Provider | Free Tier | Best For | Get API Key |
|----------|-----------|----------|-------------|
| **Navitia** ⭐ | 150k req/month | French cities, public transit | [SNCF API Portal](https://numerique.sncf.com/startup/api/) |
| **TomTom** | 75k req/month | Global coverage, real-time traffic | [TomTom Developer](https://developer.tomtom.com/) |
| **Mock** | Unlimited | Development/testing | No setup needed |

**Recommended for MVP:** Use **Navitia** (doubles quota vs TomTom, excellent French coverage).

### Switching Providers

No code changes needed — just update `.env` and restart:

```bash
# .env
ROUTING_PROVIDER=navitia  # navitia | tomtom | mock
NAVITIA_API_KEY=your_token_here
```

See [docs/architecture/routing-providers.md](../../docs/architecture/routing-providers.md) for detailed comparison.

## API Endpoints

### POST /api/routing/matrix

Calculate travel times, distances, and route geometries.

**Request:**
```json
{
  "origins": [{ "lat": 43.6108, "lng": 3.8767 }],
  "destinations": [{ "lat": 48.8566, "lng": 2.3522 }],
  "departureTime": "2026-03-15T08:30:00Z",  // OR arrivalTime (mutually exclusive)
  "mode": "car"  // car | truck | pedestrian
}
```

**Response:**
```json
{
  "durations": [[26945]],     // seconds
  "distances": [[749247]],    // meters  
  "routes": [[{
    "points": [              // ~9k points for Montpellier→Paris
      { "lat": 43.6108, "lng": 3.8767 },
      { "lat": 43.6125, "lng": 3.8801 },
      ...
    ]
  }]],
  "fromCache": false
}
```

### GET /api/health

Health check endpoint.

```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptime": 3600,
  "provider": "navitia",
  "cache": { "enabled": false },
  "environment": "development"
}
```

## Features

- ✅ **arriveAt** or **departAt** support (mutually exclusive)
- ✅ **Route geometry** for map display (~9k points per route)
- ✅ **Provider abstraction** (switch in 1 env var)
- ✅ **Rate limiting** (configurable, excludes /docs and /health)
- ✅ **CORS** (permissive in dev, strict in prod)
- ✅ **Swagger/OpenAPI** documentation at `/docs`
- ✅ **TypeScript** strict mode
- ⏸️  **Caching** (temporarily disabled while route geometry support is finalized)

## Architecture

The project is organized by **domain** (routing, health) with shared cross-domain code:

```
apps/api/
├── src/
│   ├── index.ts                     # Fastify entry point
│   ├── config/                      # Global configuration
│   │   ├── validateEnv.ts
│   │   └── swagger.ts
│   ├── shared/                      # Shared cross-domain code
│   │   └── errors/
│   │       └── index.ts             # QuotaExceededError, TimeoutError
│   ├── routing/                     # Domain: External routing APIs
│   │   ├── routes.ts                # POST /api/routing/matrix
│   │   ├── service.ts               # RoutingService (orchestration)
│   │   ├── providers/
│   │   │   ├── interface.ts         # RoutingProvider contract
│   │   │   ├── NavitiaProvider.ts   # SNCF API (150k req/month)
│   │   │   ├── TomTomProvider.ts    # TomTom Calculate Route v1
│   │   │   ├── MockProvider.ts      # Haversine + straight line
│   │   │   └── factory.ts           # Provider selection
│   │   ├── cache/
│   │   │   ├── interface.ts
│   │   │   └── MockCacheService.ts
│   │   └── utils/
│   │       ├── geohash.ts           # Coordinate snapping
│   │       ├── timeBucket.ts        # Time rounding
│   │       └── errorMargin.ts       # Travel time margin
│   └── health/                      # Domain: Monitoring
│       └── routes.ts                # GET /api/health
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

## Testing

```bash
# Type check
pnpm typecheck

# Lint
pnpm lint

# Test with curl
curl -X POST http://localhost:3005/api/routing/matrix \
  -H "Content-Type: application/json" \
  -d '{
    "origins":[{"lat":43.6108,"lng":3.8767}],
    "destinations":[{"lat":48.8566,"lng":2.3522}],
    "departureTime":"2026-03-15T08:30:00Z",
    "mode":"car"
  }'

# Or use Swagger UI
open http://localhost:3005/docs
```

## Environment Variables

```bash
# Provider (choose one: navitia | tomtom | mock)
ROUTING_PROVIDER=navitia
NAVITIA_API_KEY=xxx              # Required if provider=navitia
TOMTOM_API_KEY=xxx               # Required if provider=tomtom

# Server
PORT=3005
CORS_ORIGIN=http://localhost:3000
NODE_ENV=development             # development | production | test

# Optimization (for future caching re-enablement)
GEOHASH_PRECISION=6              # 1-9 (6 = ~1.2km cell)
TIME_BUCKET_MINUTES=30           # Round times to nearest N minutes
TRAVEL_TIME_MARGIN_PERCENT=10    # Add +N% safety margin

# Rate limiting
RATE_LIMIT_REQUESTS_PER_WINDOW=1000
RATE_LIMIT_WINDOW_MS=60000       # 1 minute

# Monitoring (optional)
SENTRY_DSN=
```

## Provider Migration Guide

Thanks to the Adapter pattern, switching providers requires **zero code changes**:

1. Update `.env`: `ROUTING_PROVIDER=navitia`
2. Add API key: `NAVITIA_API_KEY=your_token`
3. Restart server

All providers implement the same `RoutingProvider` interface, guaranteeing consistent behavior.

## Cost Analysis

| Monthly Requests | Strategy | Cost |
|------------------|----------|------|
| <150k | Navitia free tier | 0€ |
| 150k-225k | Navitia + TomTom fallback | 0€ |
| >225k | Self-host Valhalla | ~20€ (VPS) |

Break-even point for self-hosting: ~200k requests/month.

## Deployment

**Railway.app (recommended for MVP):**

```bash
# Set environment variables in dashboard
ROUTING_PROVIDER=navitia
NAVITIA_API_KEY=xxx
PORT=3005
NODE_ENV=production
CORS_ORIGIN=https://your-domain.com

# Deploy
railway up
```

**Monitoring Targets:**
- Latency P95: <5s
- Error rate: <1%  
- Provider quota: Track daily usage vs limits

## Roadmap

- [ ] Re-enable caching (duration/distance only, on-demand geometry)
- [ ] Add `ValhallProvider.ts` for self-hosted option
- [ ] Implement smart provider fallback chain
- [ ] Add Sentry monitoring integration
- [ ] Support batch matrix calculations
- [ ] Per-provider cost tracking

## License

MIT
