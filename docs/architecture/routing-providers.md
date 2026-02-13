# Routing Providers Strategy

## Overview

The routing backend uses an **Adapter pattern** to abstract external routing APIs, with a **performance-optimized split architecture**:
- **Matrix endpoint** (`calculateMatrix`): Bulk durations/distances (no geometry, cacheable)
- **Route endpoint** (`calculateRoute`): Single route with GeoJSON geometry (on-demand)

This allows switching providers without changing business logic or frontend code.

## Architecture Evolution

### Before (Single Endpoint with Geometry)
```
POST /api/routing/matrix → {durations[][], distances[][], routes[][]} 
Problem: 6.8MB response for 100 communes, 15s+ response time
```

### After (Split Architecture)
```
POST /api/routing/matrix → {durations[][], distances[][]}  // ~200 bytes, <3s
POST /api/routing/route  → {duration, distance, geometry}  // ~68KB, on-demand
Benefit: 34x faster initial load, geometry only when user clicks
```

## Current Architecture

```
apps/api/src/routing/providers/
├── interface.ts           # RoutingProvider contract (2 methods)
├── factory.ts             # Provider selection via env var
├── TomTomProvider.ts      # TomTom Calculate Route API v1
├── NavitiaProvider.ts     # Navitia (SNCF) Journeys API
├── MockProvider.ts        # Development/testing (Haversine)
└── (future) ValhallaProvider.ts  # Self-hosted OSM-based
```

## Provider Comparison

### Quick Reference

| Provider | Type | Free Tier | Matrix Support | Geometry | Transit | France Focus |
|----------|------|-----------|----------------|----------|---------|--------------|
| **Navitia** | SaaS | 150k req/month | ✅ Journeys API | ✅ GeoJSON | ⭐⭐⭐ | ✅ SNCF official |
| **TomTom** | SaaS | 75k req/month | ⚠️ Loop Calculate Route | ✅ Polyline | ❌ | Global |
| **Valhalla** | Self-hosted | Unlimited (server cost) | ✅ Very fast | ✅ Polyline | ⭐⭐ (with GTFS) | Via OSM+GTFS |
| **IGN Géoplateforme** | SaaS | Free (5 req/sec) | ❌ **Not available** | ✅ GeoJSON | ⚠️ Limited | ✅ French gov |

### Detailed Analysis

#### 1. Navitia ⭐ (Recommended for MVP)

**Strengths:**
- **150k requests/month free** via [SNCF API Portal](https://numerique.sncf.com/startup/api/)
- Native support for French public transit (Train, Bus, Métro, Tram)
- Journeys endpoint supports matrix-like queries (1 origin → N destinations)
- GeoJSON geometry in journey sections
- `datetime_represents` param: `arrival` or `departure`
- Open-source (can self-host if needed later)
- **Regional coverage** (fr-idf, fr-ne, fr-se, etc.)

**Limitations:**
- Road routing less optimized than dedicated car routing APIs
- API rate limits: 10 requests/second
- Coverage detection needed (no global 'fr' coverage)

**Use case:** **Primary provider for MVP phase**. Doubles quota vs TomTom, excellent for French cities.

**Split Architecture Implementation:**
- `calculateMatrix`: Loop Journeys API without geometry param
- `calculateRoute`: Call Journeys API, extract sections' GeoJSON

**API Example:**
```bash
GET https://api.navitia.io/v1/coverage/fr-se/journeys
  ?from=3.8767;43.6108
  &to=2.3522;48.8566
  &datetime=20260315T083000
  &datetime_represents=departure
  &first_section_mode=car
  &last_section_mode=car
```

#### 2. TomTom Calculate Route (Fallback)

**Strengths:**
- Global coverage with real-time traffic
- Clean API, good documentation
- Polyline geometry included
- Supports `departAt` and `arriveAt`
- Fast response times (<2s per route)

**Limitations:**
- **75k requests/month** on free tier (vs 150k for Navitia)
- No native matrix endpoint (must loop Calculate Route)
- More expensive at scale

**Use case:** **Fallback provider** when Navitia quota exceeded or for non-French regions.

**Split Architecture Implementation:**
- `calculateMatrix`: Loop Calculate Route API without polyline
- `calculateRoute`: Single Calculate Route with `routeRepresentation=polyline`

**API Example:**
```bash
GET https://api.tomtom.com/routing/1/calculateRoute/43.6108,3.8767:48.8566,2.3522/json
  ?key={key}
  &travelMode=car
  &traffic=true
  &departAt=2026-03-15T08:30:00Z
  &routeRepresentation=polyline  // Only for route endpoint
```

#### 3. IGN Géoplateforme ❌ (Not Suitable)

**Research Findings (Feb 2026):**
- **No Matrix API available** - Only point-to-point route calculation
- 100 communes = 100 sequential requests = ~50 seconds response time
- **Rejected for MVP** - Cannot meet <3s requirement

**Use case:** None for this project. Use Navitia or TomTom instead.

See: `files/ign-api-research.md` for full analysis.

#### 4. Valhalla (Future: Self-hosted)

**Strengths:**
- **Unlimited requests** (only server cost)
- Very fast matrix calculations (C++ engine)
- Supports multimodal with GTFS data
- Used by Mapbox, Tesla
- Open-source (MIT license)

**Limitations:**
- Requires server infrastructure (~2GB RAM minimum)
- Initial setup complexity (OSM data + GTFS ingestion)
- Must manage updates (weekly OSM extracts)

**Use case:** **Phase 2 (scale)** when >100k requests/month. Self-host on Hetzner VPS (~20€/month).

**Deployment:**
```bash
docker run -p 8002:8002 \
  -v $PWD/custom_files:/custom_files \
  valhalla/valhalla:latest
```

Data sources:
- OSM: [Geofabrik France extract](https://download.geofabrik.de/europe/france.html)
- Transit: [transport.data.gouv.fr](https://transport.data.gouv.fr/datasets/base-nationale-consolidee-des-horaires-theoriques-du-transport-en-commun)

#### 4. IGN Géoplateforme

**Strengths:**
- Free for public/private use (Open Data license)
- Authoritative French government data
- Good for car/pedestrian/bike routing

**Limitations:**
- **No native matrix endpoint**
- Transit coverage weak (compared to Navitia)
- 5 requests/second limit

**Use case:** **Potential backup** for road-only routing, or data enrichment (elevation, land use).

---

## Implementation Strategy

### Phase 1: MVP (Current)

**Provider stack:**
1. **Navitia (primary)** — 150k req/month, French focus
2. **TomTom (fallback)** — 75k req/month, global coverage
3. **Mock (dev/test)** — No external calls

**Selection logic:**
```typescript
// apps/api/src/routing/providers/factory.ts
switch (env.ROUTING_PROVIDER) {
  case 'navitia': return new NavitiaProvider(env.NAVITIA_API_KEY);
  case 'tomtom': return new TomTomProvider(env.TOMTOM_API_KEY);
  case 'mock': return new MockProvider();
}
```

**Environment variables:**
```bash
# Choose provider
ROUTING_PROVIDER=navitia  # navitia | tomtom | mock

# API keys
NAVITIA_API_KEY=your_key_here
TOMTOM_API_KEY=your_key_here
```

### Phase 2: Scale (>100k req/month)

**Migration to Valhalla:**
- Deploy on Hetzner CPX31 (4 vCPU, 8GB RAM, ~15€/month)
- Load OSM France extract (~2GB PBF)
- Ingest GTFS bundles from transport.data.gouv.fr
- Set `ROUTING_PROVIDER=valhalla`

**Hybrid strategy:**
- Valhalla for matrix calculations (unlimited, fast)
- Navitia for detailed transit instructions (better UX)

### Phase 3: Production Optimization

**Smart provider selection:**
```typescript
// Pseudo-code for future optimization
if (query.mode === 'transit') {
  return navitiaProvider.calculate(params);
} else if (query.origins.length > 50) {
  return valhallaProvider.calculate(params); // Matrix optimized
} else {
  return tomtomProvider.calculate(params); // Real-time traffic
}
```

---

## Interface Contract

All providers implement `RoutingProvider` with **2 distinct methods**:

```typescript
interface RoutingProvider {
  // Bulk calculations (no geometry, fast, cacheable)
  calculateMatrix(params: MatrixParams): Promise<MatrixResult>;
  
  // Single route with geometry (on-demand, for map display)
  calculateRoute(params: RouteParams): Promise<RouteResult>;
  
  getName(): string;
}

interface MatrixParams {
  origins: Coordinates[];
  destinations: Coordinates[];
  departureTime?: string;  // ISO 8601
  arrivalTime?: string;    // ISO 8601 (mutually exclusive)
  mode: 'car' | 'truck' | 'pedestrian';
}

interface MatrixResult {
  durations: number[][];   // seconds (origins × destinations)
  distances: number[][];   // meters (origins × destinations)
  // ❌ routes removed - use calculateRoute() instead
}

interface RouteParams {
  origin: Coordinates;
  destination: Coordinates;
  departureTime?: string;
  arrivalTime?: string;
  mode: 'car' | 'truck' | 'pedestrian';
}

interface RouteResult {
  duration: number;       // seconds
  distance: number;       // meters
  geometry: {
    type: 'LineString';
    coordinates: [number, number][]; // [lng, lat] GeoJSON
  };
}
```

**Guarantees:**
- Frontend never knows which provider is used
- Switching provider = change 1 env var
- All providers return consistent data shapes
- Matrix response: ~200 bytes (vs 6.8MB before)
- Route response: ~68KB (geometry only when needed)

---

## Usage Strategy (Performance-Optimized)

### Recommended Flow for MVP

**Phase 1: Display 100+ communes with travel times**
```typescript
// User enters work address → Search for communes within commute time
const result = await fetch('/api/routing/matrix', {
  body: JSON.stringify({
    origins: [workAddress],
    destinations: allCommuneCentroids, // 100 communes
    departureTime: '2026-03-15T08:30:00Z',
    mode: 'car'
  })
});

// Result: ~200 bytes response in <3s
// Display: Color-coded markers (green <20min, orange <40min)
```

**Phase 2: Show route when user clicks a commune**
```typescript
// User clicks on a commune → Display route on map
const route = await fetch('/api/routing/route', {
  body: JSON.stringify({
    origin: workAddress,
    destination: communeCentroid,
    departureTime: '2026-03-15T08:30:00Z',
    mode: 'car'
  })
});

// Result: ~68KB response with GeoJSON geometry
// Display: MapLibre polyline layer
```

**Performance gains:**
- Initial load: 34x faster (6.8MB → 200 bytes)
- Time to interactive: <3s (vs 15s+ before)
- Geometry: Only fetched for 1-3 clicked communes (not 100)

---

## Cost Analysis

### Monthly Cost at Different Scales

| Scale | Requests/month | Strategy | Cost |
|-------|---------------|----------|------|
| **MVP** | <150k | Navitia free tier | 0€ |
| **Growth** | 150k-225k | Navitia + TomTom fallback | 0€ |
| **Scale** | >225k | Valhalla self-hosted | ~20€ (server) |
| **Enterprise** | >1M | Valhalla cluster | ~100€ (3 servers) |

**Break-even:** Self-hosting Valhalla becomes cheaper than SaaS at ~200k requests/month.

**Request estimation for MVP:**
- Matrix calls: 10 searches/day × 100 communes = 1k req/day = 30k/month
- Route calls: 30 route displays/day = 900 req/month
- **Total: ~31k req/month** (well within Navitia free tier)

---

## Testing Strategy

**Provider-agnostic tests:**
```typescript
// Test all providers with same assertions
describe.each(['navitia', 'tomtom', 'mock'])('%s provider', (providerName) => {
  it('calculates Montpellier → Paris', async () => {
    const result = await provider.calculateMatrix({
      origins: [{ lat: 43.6108, lng: 3.8767 }],
      destinations: [{ lat: 48.8566, lng: 2.3522 }],
      departureTime: '2026-03-15T08:30:00Z',
      mode: 'car'
    });
    
    expect(result.durations[0][0]).toBeGreaterThan(20000); // >5h
    expect(result.distances[0][0]).toBeGreaterThan(700000); // >700km
    expect(result.routes[0][0].points.length).toBeGreaterThan(100);
  });
});
```

---

## Migration Checklist

When switching providers:

- [ ] Update `ROUTING_PROVIDER` in `.env`
- [ ] Add new provider API key
- [ ] Run integration tests (`pnpm test:integration`)
- [ ] Check Swagger docs still accurate
- [ ] Monitor error rates in production logs
- [ ] Verify polyline format matches MapLibre expectations

---

## References

- [Navitia API Docs](https://doc.navitia.io/)
- [TomTom Calculate Route](https://developer.tomtom.com/routing-api/documentation/routing/calculate-route)
- [Valhalla API Reference](https://valhalla.github.io/valhalla/api/)
- [IGN Géoplateforme](https://geoplateforme.github.io/gpf-doc/services/itineraires.html)
- [France GTFS Data](https://transport.data.gouv.fr/)

---

**Last updated:** 2026-02-13  
**Status:** Navitia integration in progress
