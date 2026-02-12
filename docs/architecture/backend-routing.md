# Backend Routing — Architecture Technique

**Date** : 12 février 2026  
**Statut** : Phase 1 (Semaines 1-2)  
**Spec fonctionnelle** : [../feature/routing-service/spec.md](../feature/routing-service/spec.md)

---

## Vue d'ensemble

Le backend routing est un **service minimal** qui orchestre les appels à une API de routing externe (TomTom, OSRM, etc.) pour calculer les temps de trajet avec heure de départ spécifique (trafic temps réel). Ce service est **strictement scopé** :

- ✅ Orchestration API externe (routing + géocodage)
- ✅ Cache optionnel (réduction coûts API)
- ✅ Abstraction provider (pattern Adapter)
- ❌ **Aucune logique métier** (scoring, filtrage, agrégations)
- ❌ **Aucun stockage données métier** (communes, transactions, métriques)

**Principe fondamental** : Le backend est un **proxy cache intelligent**, rien d'autre.

---

## Architecture

### Stack technique

- **Runtime** : Node.js 20+ LTS
- **Framework** : Fastify 5.x (performance + typage TypeScript)
- **Langage** : TypeScript strict mode
- **Base de données** : PostgreSQL 16 (optionnel, peut être mocké)
- **Déploiement** : Railway.app (free tier 500h/mois)
- **Monitoring** : Sentry (error tracking) + Railway metrics

### Structure du projet

```
apps/api-routing/
├── src/
│   ├── index.ts                          # Point d'entrée Fastify
│   ├── config/
│   │   ├── env.ts                        # Variables environnement
│   │   └── validateEnv.ts                # Validation env au démarrage
│   ├── routes/
│   │   ├── routing.ts                    # POST /api/routing/matrix
│   │   ├── geocode.ts                    # POST /api/geocode
│   │   └── health.ts                     # GET /api/health
│   ├── services/
│   │   ├── routingProvider/
│   │   │   ├── interface.ts              # RoutingProvider interface
│   │   │   ├── TomTomProvider.ts         # Implémentation TomTom
│   │   │   ├── MockProvider.ts           # Implémentation mock
│   │   │   └── factory.ts                # createRoutingProvider(config)
│   │   ├── cache/
│   │   │   ├── interface.ts              # CacheService interface
│   │   │   ├── PostgresCacheService.ts   # Implémentation PostgreSQL
│   │   │   └── MockCacheService.ts       # Implémentation mémoire
│   │   └── geohash.ts                    # Snapping geohash6
│   └── utils/
│       ├── timeBucket.ts                 # Time bucketing (30min slots)
│       └── errorMargin.ts                # Calcul marge erreur +10%
├── package.json
├── tsconfig.json
└── README.md
```

---

## Pattern Adapter — Abstraction Provider

### Principe

Le code métier (routes, services) **NE DOIT JAMAIS** importer directement `TomTomProvider`. Toute interaction passe par l'interface `RoutingProvider`.

### Interface `RoutingProvider`

```typescript
// src/services/routingProvider/interface.ts

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface MatrixParams {
  origins: Coordinates[];
  destinations: Coordinates[];
  departureTime: string; // ISO 8601
  mode: 'car' | 'transit' | 'walk' | 'bike';
}

export interface MatrixResult {
  durations: number[][]; // Secondes (origins x destinations)
  distances: number[][]; // Mètres (origins x destinations)
}

export interface RoutingProvider {
  calculateMatrix(params: MatrixParams): Promise<MatrixResult>;
  geocode(address: string): Promise<Coordinates>;
}
```

### Factory

```typescript
// src/services/routingProvider/factory.ts

import type { RoutingProvider } from './interface';
import { TomTomProvider } from './TomTomProvider';
import { MockProvider } from './MockProvider';
import { env } from '../config/env';

export function createRoutingProvider(): RoutingProvider {
  switch (env.ROUTING_PROVIDER) {
    case 'tomtom':
      return new TomTomProvider(env.TOMTOM_API_KEY);
    case 'mock':
      return new MockProvider();
    default:
      throw new Error(`Unknown routing provider: ${env.ROUTING_PROVIDER}`);
  }
}
```

### Utilisation dans les routes

```typescript
// src/routes/routing.ts

import { createRoutingProvider } from '../services/routingProvider/factory';

const routingProvider = createRoutingProvider();

fastify.post('/api/routing/matrix', async (request, reply) => {
  const result = await routingProvider.calculateMatrix(request.body);
  return result;
});
```

**Règle** : Aucune référence directe à `TomTomProvider` en dehors de `factory.ts`.

---

## Cache Strategy

### Objectifs

- Réduire coûts API (TomTom gratuit 2500 req/jour → limite à ne pas dépasser)
- Améliorer latency (cache hit <50ms vs API call 2-5s)
- Garantir cohérence résultats (TTL 30 jours)

### Optimisations

**1. Geohash6 snapping** (~1km précision)

```typescript
// src/services/geohash.ts

import geohash from 'ngeohash';

export function snapToGeohash6(coords: Coordinates): string {
  return geohash.encode(coords.lat, coords.lng, 6);
}
```

**Exemple** :
- Montpellier centre : `43.6108, 3.8767` → geohash6 `spey2b`
- Point 500m plus loin : `43.6153, 3.8802` → geohash6 `spey2b` (même case !)

**Impact** : Réduit 35k communes à ~5k geohashes uniques → combinatoire divisée par 7.

**2. Time bucketing** (slots 30min)

```typescript
// src/utils/timeBucket.ts

export function roundToTimeBucket(isoTime: string, bucketMinutes = 30): string {
  const date = new Date(isoTime);
  const minutes = date.getMinutes();
  const roundedMinutes = Math.floor(minutes / bucketMinutes) * bucketMinutes;
  date.setMinutes(roundedMinutes, 0, 0);
  return date.toISOString();
}
```

**Exemple** :
- `2026-03-15T08:17:00Z` → `2026-03-15T08:00:00Z`
- `2026-03-15T08:43:00Z` → `2026-03-15T08:30:00Z`

**Impact** : Réduit granularité temporelle 48 slots/jour → meilleur hit rate cache.

**3. Cache key generation**

```typescript
// Cache key format
const cacheKey = `${geohashOrigin}_${geohashDest}_${timeBucket}_${mode}`;
// Exemple: "spey2b_spfn48_2026-03-15T08:30:00Z_car"
```

### Cache Interface

```typescript
// src/services/cache/interface.ts

export interface CacheService {
  get(key: string): Promise<number | null>; // Durée en secondes
  set(key: string, durationSeconds: number, ttlDays: number): Promise<void>;
}
```

### Implémentations

**PostgresCacheService** (production)

```sql
CREATE TABLE routing_cache (
  cache_key TEXT PRIMARY KEY,
  duration_seconds INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_routing_cache_expires ON routing_cache (expires_at);
```

**MockCacheService** (MVP, tests)

```typescript
// src/services/cache/MockCacheService.ts

export class MockCacheService implements CacheService {
  private store = new Map<string, { duration: number; expiresAt: number }>();

  async get(key: string): Promise<number | null> {
    const entry = this.store.get(key);
    if (!entry || Date.now() > entry.expiresAt) return null;
    return entry.duration;
  }

  async set(key: string, durationSeconds: number, ttlDays: number): Promise<void> {
    const expiresAt = Date.now() + ttlDays * 86400 * 1000;
    this.store.set(key, { duration: durationSeconds, expiresAt });
  }
}
```

**Règle MVP** : Utiliser `MockCacheService` en mémoire. Migration PostgreSQL uniquement si quota TomTom dépassé.

---

## Configuration

### Variables d'environnement

```bash
# Provider configuration
ROUTING_PROVIDER=tomtom          # 'tomtom' | 'mock'
TOMTOM_API_KEY=your_api_key      # Clé TomTom (si provider=tomtom)

# Cache configuration
ENABLE_CACHE=false               # true si PostgreSQL activé
DATABASE_URL=postgresql://...    # Connection string (si ENABLE_CACHE=true)

# Optimizations
GEOHASH_PRECISION=6              # Précision geohash (1-9)
TIME_BUCKET_MINUTES=30           # Slots temporels (min)
CACHE_TTL_DAYS=30                # Durée validité cache
TRAVEL_TIME_MARGIN_PERCENT=10    # Marge erreur affichée

# Rate limiting
RATE_LIMIT_REQUESTS_PER_WINDOW=6  # Max requêtes par fenêtre
RATE_LIMIT_WINDOW_MS=60000        # Fenêtre (ms) = 1 min

# Server
PORT=3001
CORS_ORIGIN=http://localhost:3000  # URL frontend (développement)
NODE_ENV=development
```

### Validation au démarrage

```typescript
// src/config/validateEnv.ts

export function validateEnv() {
  const required = ['ROUTING_PROVIDER', 'PORT', 'CORS_ORIGIN'];
  
  if (env.ROUTING_PROVIDER === 'tomtom' && !env.TOMTOM_API_KEY) {
    throw new Error('TOMTOM_API_KEY required when ROUTING_PROVIDER=tomtom');
  }
  
  if (env.ENABLE_CACHE && !env.DATABASE_URL) {
    throw new Error('DATABASE_URL required when ENABLE_CACHE=true');
  }
  
  // Validation types
  if (env.GEOHASH_PRECISION < 1 || env.GEOHASH_PRECISION > 9) {
    throw new Error('GEOHASH_PRECISION must be 1-9');
  }
  
  console.log('✅ Environment validated');
}
```

---

## Endpoints

### 1. `POST /api/routing/matrix`

**Description** : Calcule les temps de trajet entre origins et destinations.

**Request body** :
```json
{
  "origins": [{ "lat": 43.6108, "lng": 3.8767 }],
  "destinations": [
    { "lat": 48.8566, "lng": 2.3522 },
    { "lat": 45.7640, "lng": 4.8357 }
  ],
  "departureTime": "2026-03-15T08:30:00Z",
  "mode": "car"
}
```

**Response** :
```json
{
  "durations": [[25200, 18000]], // Secondes (7h, 5h)
  "distances": [[750000, 500000]] // Mètres
}
```

**Optimisations appliquées** :
1. Snapping geohash6 origins + destinations
2. Time bucketing `departureTime` → slots 30min
3. Lookup cache (key = `geohashOrigin_geohashDest_timeBucket_mode`)
4. Si cache miss → appel TomTom API → store cache
5. Ajout marge erreur +10% sur durées retournées

**Rate limiting** : 6 requêtes / minute / IP.

---

### 2. `POST /api/geocode`

**Description** : Géocode une adresse → coordonnées GPS.

**Request body** :
```json
{
  "address": "1 Rue de Rivoli, 75001 Paris, France"
}
```

**Response** :
```json
{
  "lat": 48.8606,
  "lng": 2.3376
}
```

**Cache** : Non (adresses très variées, faible hit rate).

---

### 3. `GET /api/health`

**Description** : Health check monitoring.

**Response** :
```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptime": 3600,
  "provider": "tomtom",
  "cache": {
    "enabled": false,
    "hitRate": 0.72
  }
}
```

---

## Gestion erreurs

### Timeout

```typescript
const TIMEOUT_MS = 10000; // 10s

try {
  const result = await Promise.race([
    routingProvider.calculateMatrix(params),
    timeout(TIMEOUT_MS)
  ]);
} catch (err) {
  if (err instanceof TimeoutError) {
    return reply.code(504).send({ error: 'Routing API timeout' });
  }
}
```

### Quota dépassé

```typescript
// TomTomProvider.ts

async calculateMatrix(params: MatrixParams): Promise<MatrixResult> {
  const response = await fetch(url, options);
  
  if (response.status === 403) {
    throw new QuotaExceededError('TomTom quota exceeded');
  }
  
  // ...
}

// routing.ts

catch (err) {
  if (err instanceof QuotaExceededError) {
    return reply.code(503).send({
      error: 'Routing service quota exceeded. Try again later.'
    });
  }
}
```

### Retry strategy

```typescript
import pRetry from 'p-retry';

const result = await pRetry(
  () => routingProvider.calculateMatrix(params),
  {
    retries: 2,
    minTimeout: 1000,
    onFailedAttempt: (err) => {
      console.warn(`Attempt ${err.attemptNumber} failed. ${err.retriesLeft} retries left.`);
    }
  }
);
```

---

## Monitoring & Observabilité

### Métriques clés

| Métrique | Objectif | Alerte |
|----------|----------|--------|
| **Cache hit rate** | >70% (après 2 semaines) | <50% |
| **Latency P95** | <5s | >10s |
| **Error rate** | <1% | >5% |
| **Quota TomTom** | <2000 req/jour (80%) | >2250 req/jour (90%) |

### Logging

```typescript
// src/routes/routing.ts

fastify.post('/api/routing/matrix', async (request, reply) => {
  const startTime = Date.now();
  
  try {
    const result = await routingService.calculateMatrix(request.body);
    
    fastify.log.info({
      route: '/api/routing/matrix',
      duration: Date.now() - startTime,
      cacheHit: result.fromCache,
      originsCount: request.body.origins.length,
      destinationsCount: request.body.destinations.length
    });
    
    return result;
  } catch (err) {
    fastify.log.error({ route: '/api/routing/matrix', err });
    throw err;
  }
});
```

### Sentry (error tracking)

```typescript
// src/index.ts

import * as Sentry from '@sentry/node';

if (env.NODE_ENV === 'production') {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: 0.1
  });
}
```

---

## Tests

### Tests unitaires

**Pattern Adapter** :
```typescript
// src/services/routingProvider/__tests__/TomTomProvider.test.ts

describe('TomTomProvider', () => {
  it('should call TomTom Matrix API with correct params', async () => {
    // Mock fetch
    // Assert URL, headers, body
  });
  
  it('should throw QuotaExceededError on 403 response', async () => {
    // Mock fetch 403
    // Expect QuotaExceededError
  });
});
```

**Cache** :
```typescript
// src/services/cache/__tests__/MockCacheService.test.ts

describe('MockCacheService', () => {
  it('should return null for expired entries', async () => {
    const cache = new MockCacheService();
    await cache.set('key1', 1800, 0.0001); // TTL 8.64s
    await sleep(10000);
    expect(await cache.get('key1')).toBeNull();
  });
});
```

**Geohash snapping** :
```typescript
// src/services/__tests__/geohash.test.ts

describe('snapToGeohash6', () => {
  it('should snap nearby points to same geohash', () => {
    const coords1 = { lat: 43.6108, lng: 3.8767 };
    const coords2 = { lat: 43.6153, lng: 3.8802 }; // 500m away
    
    expect(snapToGeohash6(coords1)).toBe(snapToGeohash6(coords2));
  });
});
```

### Tests intégration

```typescript
// __tests__/integration/routing.test.ts

describe('POST /api/routing/matrix', () => {
  it('should return durations matrix', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/routing/matrix',
      payload: {
        origins: [{ lat: 43.6108, lng: 3.8767 }],
        destinations: [{ lat: 48.8566, lng: 2.3522 }],
        departureTime: '2026-03-15T08:30:00Z',
        mode: 'car'
      }
    });
    
    expect(response.statusCode).toBe(200);
    expect(response.json().durations).toHaveLength(1);
    expect(response.json().durations[0]).toHaveLength(1);
    expect(typeof response.json().durations[0][0]).toBe('number');
  });
  
  it('should return cached result on second call', async () => {
    // First call
    await fastify.inject({ /* ... */ });
    
    // Second call (should hit cache)
    const start = Date.now();
    await fastify.inject({ /* ... */ });
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(100); // Cache hit <100ms
  });
});
```

---

## Déploiement

### Railway.app (recommandé MVP)

**Free tier** :
- 500h execution/mois (~17j uptime continu)
- 512 MB RAM
- 1 GB storage
- Suffisant pour MVP (<50 users/jour)

**Configuration** :
```yaml
# railway.json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "pnpm install && pnpm build"
  },
  "deploy": {
    "startCommand": "pnpm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

**Variables env Railway** :
- `ROUTING_PROVIDER=tomtom`
- `TOMTOM_API_KEY=***`
- `ENABLE_CACHE=false`
- `PORT=3001` (Railway injecte automatiquement)
- `CORS_ORIGIN=https://choisir-sa-ville.fr`
- `NODE_ENV=production`

**URL générée** : `https://api-routing-production-xxxx.up.railway.app`

### Frontend configuration

```typescript
// apps/web/lib/api/routingClient.ts

const API_BASE_URL = 
  process.env.NODE_ENV === 'production'
    ? 'https://api-routing-production-xxxx.up.railway.app'
    : 'http://localhost:3001';
```

---

## Migration future OSRM

**Scénario** : Coûts TomTom dépassent 50€/mois (>50k req/mois).

**Solution** : Pattern Adapter permet migration sans refonte.

**Étapes** :
1. Créer `src/services/routingProvider/OSRMProvider.ts`
2. Implémenter interface `RoutingProvider`
3. Ajouter `case 'osrm'` dans `factory.ts`
4. Déployer instance OSRM self-hosted (Docker)
5. Changer variable env `ROUTING_PROVIDER=osrm`
6. **Zéro modification code métier** (routes, services)

**Coûts OSRM** :
- Self-hosted : ~5€/mois (VPS Hetzner)
- Setup initial : import données OSM France (~4h), réglage serveur (~2h)
- Limitation : Pas de trafic temps réel (estimations statiques)

---

## Checklist GO/NO-GO Phase 1

### Critères bloquants

- ✅ Latency P95 < 5s (calcul 35k communes)
- ✅ Cache hit rate > 30% (après 100 requêtes test)
- ✅ 0 erreur TomTom API (100 requêtes test)
- ✅ Coûts = 0€ (Railway free tier)
- ✅ Tests unitaires + intégration 100% pass
- ✅ Documentation complète (ce fichier + README.md)

### Critères non bloquants (améliorations post-MVP)

- ⚠️ Cache hit rate > 70% (objectif production)
- ⚠️ Migration PostgreSQL (si quota TomTom dépassé)
- ⚠️ Rate limiting par user authentifié (si scaling)
- ⚠️ Monitoring dashboard (Grafana + Prometheus)

---

## Références

- [Spec fonctionnelle routing-service](../feature/routing-service/spec.md)
- [TomTom Routing API](https://developer.tomtom.com/routing-api/documentation)
- [Geohash Wikipedia](https://en.wikipedia.org/wiki/Geohash)
- [Fastify Documentation](https://fastify.dev/)
- [Railway.app Documentation](https://docs.railway.app/)
