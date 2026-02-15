# Backend Routing Service

Minimal Fastify backend for travel time calculations with **performance-optimized split architecture**: bulk calculations (matrix) vs on-demand geometry (route).

## Quick Start

```bash
# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# Edit .env and add your API key (see Routing Providers below)

# Start development server
pnpm dev

# Server runs on http://localhost:3001
# Swagger UI at http://localhost:3001/docs
```

## Routing Providers

The API supports multiple routing providers via environment configuration:

| Provider | Free Tier | Best For | Get API Key |
|----------|-----------|----------|-------------|
| **Smart** ⭐ | Unlimited + 150k | MVP recommended (Valhalla + Navitia) | See below |
| **Valhalla** | Unlimited (self-hosted) | Historical traffic, no quota limits | Self-hosted (Docker) |
| **Navitia** | 150k req/month | French cities, public transit | [SNCF API Portal](https://numerique.sncf.com/startup/api/) |
| **TomTom** | 75k req/month | Global coverage, real-time traffic | [TomTom Developer](https://developer.tomtom.com/) |
| **Mock** | Unlimited | Development/testing | No setup needed |

**Recommended for MVP:** Use **Smart** mode (Valhalla for matrix calculations + Navitia fallback for route geometry). Valhalla is self-hosted with unlimited requests and historical traffic data.

### Switching Providers

No code changes needed — just update `.env` and restart:

```bash
# .env — Smart mode (recommended for MVP)
ROUTING_PROVIDER=smart           # smart | valhalla | navitia | tomtom | mock
VALHALLA_BASE_URL=http://localhost:8002
NAVITIA_API_KEY=your_token_here  # Used as fallback in smart mode

# .env — Valhalla only
ROUTING_PROVIDER=valhalla
VALHALLA_BASE_URL=http://localhost:8002
```

See [docs/architecture/routing-providers.md](../../docs/architecture/routing-providers.md) for detailed comparison.

## API Endpoints

### POST /api/routing/matrix — Bulk Calculations (No Geometry)

**Use case:** Calculate travel times for 100+ communes at once. Fast, lightweight, cacheable.

**Request:**
```json
{
  "origins": [{ "lat": 43.6108, "lng": 3.8767 }],
  "destinations": [
    { "lat": 48.8566, "lng": 2.3522 },
    { "lat": 45.764, "lng": 4.8357 }
  ],
  "departureTime": "2026-03-15T08:30:00Z",  // OR arrivalTime (mutually exclusive)
  "mode": "car"  // car | truck | pedestrian
}
```

**Response (~200 bytes):**
```json
{
  "durations": [[26945, 11231]],  // seconds (origins × destinations)
  "distances": [[749247, 285401]], // meters
  "fromCache": false
}
```

**Performance:**
- Response size: ~200 bytes (vs 6.8MB with geometry)
- Response time: <3s for 100 communes
- Cacheable: Yes (small payload)

---

### POST /api/routing/route — Single Route with Geometry

**Use case:** Display route polyline on map when user clicks a commune. On-demand only.

**Request:**
```json
{
  "origin": { "lat": 43.6108, "lng": 3.8767 },
  "destination": { "lat": 48.8566, "lng": 2.3522 },
  "departureTime": "2026-03-15T08:30:00Z",
  "mode": "car"
}
```

**Response (~68KB):**
```json
{
  "duration": 26945,
  "distance": 749247,
  "geometry": {
    "type": "LineString",
    "coordinates": [           // [lng, lat] GeoJSON format (MapLibre-ready)
      [3.8767, 43.6108],
      [3.8801, 43.6125],
      ...                      // ~9000 points for Montpellier→Paris
    ]
  }
}
```

**Performance:**
- Response size: ~68KB (geometry only fetched when needed)
- Response time: ~2-5s depending on provider
- Cacheable: Yes (24h TTL recommended)

---

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

## Recommended Usage Flow

**Efficient pattern for displaying 100+ communes:**

1. **Search Phase** (user enters work address):
   ```
   POST /api/routing/matrix
   → Input: 1 origin, 100 destinations
   → Output: durations/distances only (~200 bytes)
   → Display: Color-coded commune markers (green <20min, orange <40min)
   → Time: <3s
   ```

2. **Detail Phase** (user clicks a commune):
   ```
   POST /api/routing/route
   → Input: 1 origin, 1 destination
   → Output: duration + distance + GeoJSON geometry (~68KB)
   → Display: Route polyline on MapLibre map
   → Time: 2-5s
   ```

**Result:** 34x faster initial load (6.8MB → 200 bytes), geometry only when needed.

## Features

- ✅ **Split architecture** (matrix bulk vs route on-demand)
- ✅ **arriveAt** or **departAt** support (mutually exclusive)
- ✅ **GeoJSON geometry** for MapLibre (route endpoint only)
- ✅ **Provider abstraction** (switch in 1 env var)
- ✅ **Rate limiting** (configurable, excludes /docs and /health)
- ✅ **CORS** (permissive in dev, strict in prod)
- ✅ **Swagger/OpenAPI** documentation at `/docs`
- ✅ **TypeScript** strict mode
- ⏸️  **Caching** (re-enabling now that matrix has no geometry)

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
│   │   ├── routes.ts                # 2 endpoints: /matrix + /route
│   │   ├── service.ts               # RoutingService (orchestration)
│   │   ├── providers/
│   │   │   ├── interface.ts             # RoutingProvider contract
│   │   │   ├── ValhallaProvider.ts      # Valhalla self-hosted (unlimited)
│   │   │   ├── NavitiaProvider.ts       # SNCF API (150k req/month)
│   │   │   ├── TomTomProvider.ts        # TomTom Calculate Route v1
│   │   │   ├── SmartRoutingProvider.ts  # Mode-based provider selection
│   │   │   ├── MockProvider.ts          # Haversine + straight line
│   │   │   └── factory.ts              # Provider selection
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
- **Performance-First**: Split matrix (bulk) vs route (on-demand) to minimize payload and response time

### Request Flow

```
POST /api/routing/matrix  → RoutingService.calculateMatrix()  → Provider.calculateMatrix()
                                ↓                                  (no geometry, fast)
                           CacheService

POST /api/routing/route   → RoutingService.calculateRoute()   → Provider.calculateRoute()
                                                                  (GeoJSON geometry)
```

## Testing

```bash
# Type check
pnpm typecheck

# Lint
pnpm lint

# Test matrix endpoint (bulk, no geometry)
curl -X POST http://localhost:3001/api/routing/matrix \
  -H "Content-Type: application/json" \
  -d '{
    "origins":[{"lat":43.6108,"lng":3.8767}],
    "destinations":[{"lat":48.8566,"lng":2.3522},{"lat":45.764,"lng":4.8357}],
    "departureTime":"2026-03-15T08:30:00Z",
    "mode":"car"
  }'
# Response: ~200 bytes (durations + distances only)

# Test route endpoint (single route with geometry)
curl -X POST http://localhost:3001/api/routing/route \
  -H "Content-Type: application/json" \
  -d '{
    "origin":{"lat":43.6108,"lng":3.8767},
    "destination":{"lat":48.8566,"lng":2.3522},
    "departureTime":"2026-03-15T08:30:00Z",
    "mode":"car"
  }'
# Response: ~68KB (duration + distance + GeoJSON geometry)

# Or use Swagger UI
open http://localhost:3001/docs
```

## Environment Variables

```bash
# Provider (choose one: smart | valhalla | navitia | tomtom | mock)
ROUTING_PROVIDER=smart
VALHALLA_BASE_URL=http://localhost:8002  # Required if provider=smart|valhalla
NAVITIA_API_KEY=xxx              # Required if provider=smart|navitia
TOMTOM_API_KEY=xxx               # Required if provider=tomtom

# Server
PORT=3001
CORS_ORIGIN=http://localhost:3000
NODE_ENV=development             # development | production | test

# Optimization
GEOHASH_PRECISION=6              # 1-9 (6 = ~1.2km cell)
TIME_BUCKET_MINUTES=30           # Round times to nearest N minutes
TRAVEL_TIME_MARGIN_PERCENT=10    # Add +N% safety margin
CACHE_TTL_DAYS=7                 # Cache duration

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
| MVP | Valhalla self-hosted (Smart mode) | ~15-20€/month (VPS) |
| MVP + fallback | Smart (Valhalla + Navitia free tier) | ~15-20€/month |
| High volume | Valhalla only (no external API limits) | ~15-20€/month |

**MVP strategy:** Valhalla self-hosted handles all matrix calculations (unlimited, historical traffic). Navitia serves as fallback for route geometry via Smart mode. Total cost: ~15-20€/month for a VPS regardless of request volume.

## Deployment

**Railway.app (recommended for MVP):**

```bash
# Set environment variables in dashboard
ROUTING_PROVIDER=smart
VALHALLA_BASE_URL=http://valhalla-service:8002
NAVITIA_API_KEY=xxx
PORT=3001
NODE_ENV=production
CORS_ORIGIN=https://your-domain.com

# Deploy
railway up
```

**Monitoring Targets:**
- Latency P95: <5s (matrix), <10s (route)
- Error rate: <1%  
- Provider quota: Track daily usage vs limits

## Performance Benchmarks

| Endpoint | Input | Response Size | Response Time | Use Case |
|----------|-------|---------------|---------------|----------|
| `/matrix` | 1→100 communes | ~1KB | <3s | Initial search results |
| `/route` | 1→1 route | ~68KB | 2-5s | On-demand geometry |

**Before refactoring (matrix with geometry):**
- Response size: 6.8MB for 100 communes
- Response time: 15s+
- Result: Unusable for MVP

**After refactoring:**
- Initial load: 34x faster (6.8MB → 200 bytes)
- Geometry on-demand: Only when user clicks
- Result: Smooth UX

## Roadmap

- [x] Split matrix/route endpoints
- [x] Add `ValhallaProvider.ts` for self-hosted option
- [x] Implement `SmartRoutingProvider.ts` (Valhalla + Navitia)
- [ ] Re-enable caching (matrix: 7 days, route: 24h)
- [ ] Add `IGNProvider.ts` (abandoned - no Matrix API)
- [ ] Docker setup for Valhalla (France extract)
- [ ] Integration tests for Valhalla provider
- [ ] Deploy Valhalla on Railway
- [ ] Add Sentry monitoring integration
- [ ] Per-provider cost tracking

## License

MIT
