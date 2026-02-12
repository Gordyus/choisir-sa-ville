# Spécification — Service Backend Routing (Temps de Trajet)

**Statut** : Draft  
**Date** : 12 février 2026  
**Implémentation** : Non commencée  
**Architecture** : Backend API minimal (Fastify + PostgreSQL) + Routing API externe

---

## 1) Contexte & intention produit

Le calcul de **temps de trajet avec heure de départ spécifique** est un critère différenciant fondamental pour la recherche de logement. Les utilisateurs doivent pouvoir saisir "je veux arriver au travail le **lundi matin à 8h30**" et obtenir des résultats tenant compte du **trafic réel à cette plage horaire**.

**Proposition de valeur unique** :
- Temps de trajet **avec jour de la semaine + heure** (pas juste distance)
- Calcul pour **toutes les communes** (ou rayon configurable)
- Cache intelligent pour optimiser coûts API externes

---

## 2) Objectifs

### Objectif utilisateur
Définir des destinations (travail, école) avec contrainte horaire et obtenir le temps de trajet pour chaque commune candidate.

### Objectif produit
**MVP** : Valider l'hypothèse "le temps de trajet avec heure spécifique est un critère décisif de recherche immobilière".

**Post-MVP** : Service routing utilisable par d'autres features (calcul trajets, isochrones, etc.).

### Objectif technique
- Backend **minimal** (3-4 endpoints max)
- Abstraction provider (pas de dépendance forte TomTom)
- Cache PostgreSQL optionnel (mocker en MVP si besoin)
- Coûts infrastructure **< 15€/mois**

---

## 3) Hors périmètre (MVP)

- ❌ Transport en commun (voiture uniquement)
- ❌ Multi-modal (vélo, marche)
- ❌ Isochrones visuelles sur carte
- ❌ Calcul route détaillée (étapes, instructions)
- ❌ Optimisation multi-destinations (TSP)
- ❌ Alertes trafic temps réel
- ❌ Authentification / rate limiting par utilisateur (rate limit par IP suffit)

---

## 4) Décisions & hypothèses

### Architecture backend

**Framework** : Fastify (Node.js + TypeScript)
- Léger, rapide, TypeScript first
- Écosystème plugins mature (CORS, rate-limit, etc.)

**Base de données** : PostgreSQL (optionnel MVP, peut être mocké)
- Cache routing (temps trajet calculés)
- Cache géocodage (adresses → lat/lng)

**Déploiement** : Railway.app (free tier 500h/mois)
- 1-click deploy
- PostgreSQL inclus (500MB gratuit)
- Coût : 0€ pour MVP, 5-10€/mois si dépassement

### Routing provider

**MVP** : **TomTom Routing API**
- 2500 requêtes/jour gratuit
- Transit disponible (future)
- Qualité données trafic élevée
- API mature, bien documentée

**Abstraction provider** : Pattern **Adapter**
- Interface `RoutingProvider` (méthode `calculateMatrix()`)
- Implémentations : `TomTomProvider`, `OpenRouteServiceProvider`, `MockProvider`
- Configuration par variable d'environnement (`ROUTING_PROVIDER=tomtom`)
- **Pas de code métier dépendant de TomTom directement**

**Provider alternatifs (post-MVP)** :
- OpenRouteService (2000 req/jour gratuit, self-hosted possible)
- Google Maps (payant, très cher)
- OSRM self-hosted (gratuit, maintenance complexe)

### Cache strategy

**Snapping communes** : geohash6 (~1km précision)
- Chaque commune représentée par son **centroid**
- Snapping centroid → geohash6 pour mutualiser cache
- Configuration : `GEOHASH_PRECISION=6` (modifiable)

**Time bucketing** : arrondi à 30min
- 8h15-8h44 → 8h30
- Mutualise cache pour plages horaires proches
- Configuration : `TIME_BUCKET_MINUTES=30` (modifiable)

**TTL cache** : 30 jours
- Données trafic relativement stables par plage horaire/jour semaine
- Configuration : `CACHE_TTL_DAYS=30`

**Clé cache** :
```
hash(origin_geohash6, dest_geohash6, mode, day_of_week, time_bucket)
```

**Exemple** :
```
origin: u0e84q (Montpellier centroid geohash6)
dest: spey61 (Paris centroid geohash6)
mode: driving
day: monday
time: 08:30
→ clé: sha256("u0e84q:spey61:driving:monday:08:30")
```

### Marge d'erreur temps trajet

**Configuration** : `TRAVEL_TIME_MARGIN_PERCENT=10` (par défaut +10%)

**Raison** :
- Snapping geohash6 (~1km) introduit approximation
- Trafic variable même dans bucket 30min
- Meilleur UX : annoncer temps max raisonnable que temps min optimiste

**Affichage** :
- Temps calculé : 42 min
- Temps affiché : 46 min (42 × 1.10)
- UI : "~46 min" avec tooltip "Estimation incluant marge +10%"

---

## 5) API Endpoints

### 5.1. POST /api/routing/matrix

**Rôle** : Calculer temps de trajet de TOUTES les communes vers destination(s).

**Input** :
```typescript
{
  destinations: [
    {
      lat: 43.610769,
      lng: 3.876716,
      label: "Travail maman - Montpellier"
    }
  ],
  mode: "driving",  // "driving" uniquement en MVP
  departureTime: "2026-02-17T08:30:00",  // ISO 8601
  dayOfWeek: "monday"  // lowercase
}
```

**Output** :
```typescript
{
  results: [
    {
      communeInsee: "34172",
      travelTimeMinutes: 46,  // avec marge +10%
      travelTimeMinutesRaw: 42,  // temps brut API
      distance: 8500,  // mètres
      cached: true
    },
    // ... ~35 000 communes
  ],
  metadata: {
    totalCommunes: 35000,
    cached: 28000,
    computed: 7000,
    providerUsed: "tomtom",
    cacheHitRate: 0.80
  }
}
```

**Logique** :
1. Pour chaque commune :
   - Récupérer centroid depuis `communes/centroids.json`
   - Snapper centroid → geohash6
   - Construire clé cache
   - Si cache HIT : retourner valeur
   - Si cache MISS : ajouter à batch API
2. Appeler routing API par batch (100 communes max par requête)
3. Stocker résultats dans cache (si activé)
4. Appliquer marge d'erreur (+10%)
5. Retourner résultats

**Rate limiting** : 1 requête / 10s par IP (anti-spam)

---

### 5.2. POST /api/geocode

**Rôle** : Convertir adresse texte → coordonnées GPS.

**Input** :
```typescript
{
  address: "12 rue de Rivoli, Paris"
}
```

**Output** :
```typescript
{
  lat: 48.857498,
  lng: 2.359274,
  label: "12 Rue de Rivoli, 75001 Paris",
  confidence: 0.95  // 0.00-1.00
}
```

**Logique** :
1. Normaliser adresse (lowercase, trim)
2. Check cache géocodage
3. Si cache MISS : appeler TomTom Geocoding API
4. Stocker dans cache (TTL 90 jours)
5. Retourner résultat

---

### 5.3. GET /api/health

**Rôle** : Health check pour monitoring.

**Output** :
```typescript
{
  status: "ok",
  database: "connected",
  provider: "tomtom",
  uptime: 86400
}
```

---

## 6) Architecture technique

### Stack

```
┌─────────────────────────────────────────┐
│         FRONTEND (apps/web)              │
│  lib/api/routingClient.ts                │
└─────────────────────────────────────────┘
             ▲
             │ HTTP fetch()
             ▼
┌─────────────────────────────────────────┐
│    BACKEND API (apps/api-routing)       │
│  Fastify + TypeScript                   │
│  ├── routes/                             │
│  │   ├── routing.ts                      │
│  │   ├── geocode.ts                      │
│  │   └── health.ts                       │
│  ├── services/                           │
│  │   ├── routingProvider/ (abstraction)  │
│  │   │   ├── interface.ts                │
│  │   │   ├── TomTomProvider.ts           │
│  │   │   ├── MockProvider.ts             │
│  │   │   └── factory.ts                  │
│  │   ├── cacheService.ts (optionnel)     │
│  │   └── geoHasher.ts                    │
│  └── config/                              │
│      └── env.ts                           │
└─────────────────────────────────────────┘
             ▲
             │ SQL (si cache activé)
             ▼
┌─────────────────────────────────────────┐
│      POSTGRESQL (optionnel MVP)          │
│  Railway.app free tier                  │
│  ├── routing_cache                       │
│  └── geocode_cache                       │
└─────────────────────────────────────────┘
             ▲
             │ HTTPS API
             ▼
┌─────────────────────────────────────────┐
│      TOMTOM ROUTING API                  │
│  2500 req/jour gratuit                   │
└─────────────────────────────────────────┘
```

---

## 7) Pattern Adapter — Abstraction Provider

### Interface

```typescript
// services/routingProvider/interface.ts
export interface RoutingProvider {
  calculateMatrix(params: MatrixParams): Promise<MatrixResult>;
  getName(): string;
}

export type MatrixParams = {
  origins: Array<{ lat: number; lng: number }>;
  destinations: Array<{ lat: number; lng: number }>;
  mode: "driving";
  departureTime: Date;
};

export type MatrixResult = {
  results: Array<{
    originIndex: number;
    destinationIndex: number;
    travelTimeSeconds: number;
    distanceMeters: number;
  }>;
};
```

### Implémentation TomTom

```typescript
// services/routingProvider/TomTomProvider.ts
import axios from 'axios';
import type { RoutingProvider, MatrixParams, MatrixResult } from './interface';

export class TomTomProvider implements RoutingProvider {
  private apiKey: string;
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }
  
  async calculateMatrix(params: MatrixParams): Promise<MatrixResult> {
    // Appel TomTom Matrix Routing API
    // Transformation résultat vers format neutre
    // Gestion erreurs, retry, timeout
  }
  
  getName(): string {
    return "tomtom";
  }
}
```

### Factory

```typescript
// services/routingProvider/factory.ts
export function createRoutingProvider(config: EnvConfig): RoutingProvider {
  const providerName = config.ROUTING_PROVIDER || "tomtom";
  
  switch (providerName) {
    case "tomtom":
      return new TomTomProvider(config.TOMTOM_API_KEY);
    case "mock":
      return new MockProvider();
    default:
      throw new Error(`Unknown routing provider: ${providerName}`);
  }
}
```

**Avantage** : Changer de provider = 1 variable env, 0 changement code métier.

---

## 8) Schéma base de données (optionnel MVP)

```sql
-- Table cache routing
CREATE TABLE routing_cache (
  id SERIAL PRIMARY KEY,
  cache_key VARCHAR(255) UNIQUE NOT NULL,
  origin_geohash VARCHAR(10) NOT NULL,
  dest_geohash VARCHAR(10) NOT NULL,
  mode VARCHAR(20) NOT NULL,
  day_of_week VARCHAR(10) NOT NULL,
  time_bucket TIME NOT NULL,
  travel_time_seconds INT NOT NULL,
  distance_meters INT,
  provider VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_routing_cache_key ON routing_cache(cache_key);
CREATE INDEX idx_routing_expires ON routing_cache(expires_at);

-- Table cache géocodage
CREATE TABLE geocode_cache (
  id SERIAL PRIMARY KEY,
  address_normalized VARCHAR(500) UNIQUE NOT NULL,
  lat DECIMAL(10, 7) NOT NULL,
  lng DECIMAL(10, 7) NOT NULL,
  label VARCHAR(500),
  confidence DECIMAL(3, 2),
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_geocode_expires ON geocode_cache(expires_at);
```

**Alternative MVP** : MockCacheService (in-memory Map, perdu au redémarrage)

---

## 9) Configuration

### Variables d'environnement

```bash
# .env.example

# Routing provider
ROUTING_PROVIDER=tomtom  # "tomtom" | "mock"
TOMTOM_API_KEY=your_api_key_here

# Cache config
ENABLE_CACHE=false  # true pour activer PostgreSQL cache
DATABASE_URL=postgresql://user:pass@host:5432/dbname
GEOHASH_PRECISION=6
TIME_BUCKET_MINUTES=30
CACHE_TTL_DAYS=30

# Marge erreur
TRAVEL_TIME_MARGIN_PERCENT=10

# Rate limiting
RATE_LIMIT_REQUESTS_PER_WINDOW=6  # 6 req / 60s = 1 req / 10s
RATE_LIMIT_WINDOW_MS=60000

# Server
PORT=3001
CORS_ORIGIN=http://localhost:3000
```

---

## 10) Gestion erreurs & fallback

### Quota API dépassé

Si TomTom retourne erreur 429 (quota dépassé) :

**Option 1** : Calcul distance euclidienne approximatif
- Formule Haversine (distance à vol d'oiseau)
- Conversion distance → temps (heuristique : 50 km/h moyen)
- Warning utilisateur : "Temps estimé (API indisponible)"

**Option 2** : Retour erreur 503 Service Unavailable
- Message : "Service temporairement indisponible, réessayez dans 1h"

**Recommandation MVP** : Option 2 (plus honnête).

**Post-MVP** : Passage provider payant ou self-hosted.

### Timeout API externe

- Timeout requête TomTom : 10s max
- Retry automatique : 1 tentative (2 appels total max)
- Si échec : retour erreur 504 Gateway Timeout

### Base de données indisponible

Si `ENABLE_CACHE=true` mais PostgreSQL down :
- Log warning
- Continuer sans cache (appels directs API)
- Pas de blocage utilisateur

---

## 11) Monitoring & observabilité

### Métriques à tracker

- **Taux cache hit** : % requêtes servies par cache
- **Latency P95** : temps réponse API 95e percentile
- **Quota API usage** : nb requêtes TomTom / jour
- **Error rate** : % erreurs 5xx
- **Rate limit hits** : nb requêtes bloquées par rate limiter

### Logs

Format JSON (Pino) :
```json
{
  "level": "info",
  "msg": "Matrix calculation",
  "destinations": 1,
  "communes": 35000,
  "cached": 28000,
  "computed": 7000,
  "cacheHitRate": 0.80,
  "duration": 4200,
  "provider": "tomtom"
}
```

---

## 12) Tests

### Tests unitaires

- ✅ GeoHasher : snapping coords → geohash6
- ✅ Time bucketing : arrondi à 30min
- ✅ Marge erreur : application +10%
- ✅ Cache key generation : hash stable

### Tests intégration

- ✅ TomTomProvider : appel API réel (avec clé test)
- ✅ MockProvider : calcul distance euclidienne
- ✅ CacheService : read/write PostgreSQL (si activé)

### Tests E2E

- ✅ POST /api/routing/matrix → 200 OK avec résultats
- ✅ Rate limiting : 7e requête en 60s → 429 Too Many Requests
- ✅ Cache hit : 2e appel identique → instant, cached=true

---

## 13) Déploiement

### Railway.app (recommandé MVP)

**Setup** :
1. Créer compte Railway.app
2. "New Project" → "Deploy from GitHub repo"
3. Sélectionner `apps/api-routing/`
4. Ajouter PostgreSQL (optionnel) : "New" → "Database" → "PostgreSQL"
5. Variables env : Settings → Variables
6. Deploy automatique sur push `main`

**Coûts** :
- Free tier : 500h/mois + 500MB PostgreSQL
- Si dépassement : ~5€/mois backend + 5€/mois DB = 10€/mois

### Alternative : Render

Similaire, gratuit 750h/mois, PostgreSQL 90 jours gratuit puis 7$/mois.

---

## 14) Roadmap post-MVP

### Phase 2 : Transit (transport en commun)

- Ajout mode `transit` dans TomTomProvider
- Calcul plages horaires départ (8h-9h → meilleur horaire)
- Affichage détails trajet (correspondances)

### Phase 3 : OSRM self-hosted

- Réduction coûts (0€ API)
- Instance Docker OSRM (données OSM France)
- Implémentation `OsrmProvider`

### Phase 4 : Isochrones visuelles

- Calcul polygones isochrones (15min, 30min, 45min)
- Affichage carte MapLibre
- Export GeoJSON

---

## 15) Métriques de succès MVP

**Technique** :
- ✅ Latency P95 < 5s (calcul 35k communes)
- ✅ Cache hit rate > 70% après 2 semaines usage
- ✅ Error rate < 1%
- ✅ Coûts < 15€/mois

**Produit** : (voir spec feature/multi-criteria-search)
- ✅ > 80% recherches utilisent critère temps trajet
- ✅ Temps trajet = critère #1 en importance (pondération utilisateur)

---

## 16) Risques & mitigations

| Risque | Impact | Probabilité | Mitigation |
|--------|--------|-------------|------------|
| Quota TomTom dépassé | Élevé | Moyenne | Cache agressif (hit rate >70%), fallback erreur 503, passage payant si succès MVP |
| Latency API TomTom élevée | Moyen | Faible | Timeout 10s, batch 100 communes, cache |
| PostgreSQL indisponible | Faible | Faible | Fallback mode sans cache (appels directs) |
| Coûts explosent | Élevé | Faible | Monitoring quota quotidien, alertes, passage freemium rapide |

---

## Annexes

### A. Comparaison providers routing

| Provider | Gratuit | Payant | Transit | Self-hosted | Qualité trafic |
|----------|---------|--------|---------|-------------|----------------|
| TomTom | 2500/j | 5€/1000 | ✅ | ❌ | ⭐⭐⭐ |
| OpenRouteService | 2000/j | — | ❌ | ✅ | ⭐⭐ |
| Google Maps | ❌ | 5€/1000 | ✅ | ❌ | ⭐⭐⭐ |
| OSRM | — | — | ❌ | ✅ | ⭐⭐ |

**Recommandation MVP** : TomTom (meilleur compromis gratuit + qualité + transit future).

### B. Estimation taille cache

**Hypothèses** :
- 35 000 communes
- 3 destinations moyennes par recherche
- 10 plages horaires différentes (8h30, 9h, 17h, etc.)
- 5 jours ouvrés

**Calcul** :
```
35k communes × 3 dest × 10 plages × 5 jours = 5.25M entrées cache max
Taille par entrée : ~100 bytes
Total : ~525 MB
```

**Réalité** : Hit rate élevé → beaucoup moins (50-100 MB après 1 mois).

**Conclusion** : Free tier PostgreSQL Railway (500 MB) suffisant.
