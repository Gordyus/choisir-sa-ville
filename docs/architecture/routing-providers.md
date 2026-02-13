# Routing Providers Strategy

## Overview

The routing backend uses an **Adapter pattern** to abstract external routing APIs. This allows switching providers without changing business logic or frontend code.

## Current Architecture

```
apps/api/src/routing/providers/
├── interface.ts           # Common interface (RoutingProvider)
├── factory.ts             # Provider selection via env var
├── TomTomProvider.ts      # TomTom Calculate Route API v1
├── NavitiaProvider.ts     # Navitia (SNCF) API
├── MockProvider.ts        # Development/testing (Haversine)
└── (future) ValhallProvider.ts  # Self-hosted OSM-based
```

## Provider Comparison

### Quick Reference

| Provider | Type | Free Tier | Matrix | Geometry | Transit | France Focus |
|----------|------|-----------|--------|----------|---------|--------------|
| **Navitia** | SaaS | 150k req/month | ✅ Native | ✅ GeoJSON | ⭐⭐⭐ | ✅ SNCF official |
| **TomTom** | SaaS | 2.5k req/day (~75k/month) | ❌ Calculate Route only | ✅ Polyline | ❌ | Global |
| **Valhalla** | Self-hosted | Unlimited (server cost) | ✅ Very fast | ✅ Polyline | ⭐⭐ (with GTFS) | Via OSM+GTFS |
| **IGN Géoplateforme** | SaaS | Free (5 req/sec) | ⚠️ Limited | ✅ GeoJSON | ⭐ | ✅ French gov |

### Detailed Analysis

#### 1. Navitia (Recommended for MVP)

**Strengths:**
- **150k requests/month free** via [SNCF API Portal](https://numerique.sncf.com/startup/api/)
- Native support for French public transit (Train, Bus, Métro, Tram)
- Matrix endpoint: `/journeys` with multiple origins/destinations
- Polylines included in journey responses (GeoJSON format)
- `datetime_represents` param: `arrival` or `departure`
- Open-source (can self-host if needed later)

**Limitations:**
- Road routing less optimized than dedicated car routing APIs
- API rate limits: 10 requests/second

**Use case:** **Primary provider for MVP phase**. Doubles quota vs TomTom, excellent for French cities.

**API Example:**
```bash
GET https://api.navitia.io/v1/coverage/fr-idf/journeys
  ?from=2.37715;48.84552
  &to=2.33629;48.86699
  &datetime=20260315T083000
  &datetime_represents=departure
```

#### 2. TomTom Calculate Route (Current)

**Strengths:**
- Global coverage with real-time traffic
- Clean API, good documentation
- Polyline geometry included
- Supports `departAt` and `arriveAt`

**Limitations:**
- **2,500 requests/day** on free tier (~75k/month)
- No native matrix endpoint (must loop Calculate Route)
- More expensive at scale

**Use case:** **Fallback provider** when Navitia quota exceeded or for non-French regions.

**API Example:**
```bash
GET https://api.tomtom.com/routing/1/calculateRoute/43.6108,3.8767:48.8566,2.3522/json
  ?key={key}
  &travelMode=car
  &traffic=true
  &departAt=2026-03-15T08:30:00Z
```

#### 3. Valhalla (Future: Self-hosted)

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

All providers implement `RoutingProvider`:

```typescript
interface RoutingProvider {
  calculateMatrix(params: MatrixParams): Promise<MatrixResult>;
  geocode(address: string): Promise<Coordinates>;
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
  durations: number[][];        // seconds
  distances: number[][];        // meters
  routes: RouteGeometry[][];    // polylines for map
}
```

**Guarantees:**
- Frontend never knows which provider is used
- Switching provider = change 1 env var
- All providers return consistent data shapes

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
