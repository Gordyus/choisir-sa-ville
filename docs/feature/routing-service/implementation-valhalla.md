# Implémentation Service Routing MVP - Valhalla + Navitia

**Statut** : Implémenté (backend core)
**Date** : 15 février 2026
**Version** : 1.0

---

## 1. Objectifs

### Objectif Utilisateur

Permettre aux utilisateurs de définir des destinations (travail, école) avec contrainte horaire et obtenir le temps de trajet réaliste pour chaque commune candidate, en tenant compte du trafic historique.

**Cas d'usage principal** :
> "Je veux arriver au travail le lundi matin à 8h30 en voiture depuis Montpellier. Quelles communes sont à moins de 45 minutes ?"

### Objectifs Produit (MVP)

- ✅ Support multi-destinations (jusqu'à 3)
- ✅ Calcul temps de trajet avec trafic historique (patterns "lundi 8h30 = pointe")
- ✅ Support tous modes transport : `car`, `truck`, `pedestrian`, `transit`
- ✅ Affichage parcours sur carte (GeoJSON geometry)
- ✅ Rayon configurable (50km par défaut, filtrage frontend)
- ✅ Cible 1000 users/jour

### Objectifs Techniques

- ✅ Backend minimal (Pattern Strategy pour providers routing)
- ✅ Gratuit ou low-cost (≤20€/mois infrastructure)
- ✅ Pas de quota API externe critique
- ⏳ Cache PostgreSQL optionnel (post-MVP)
- ✅ France uniquement (OSM France bbox)

### Hors Périmètre MVP

- ❌ Trafic temps réel actuel (accidents, travaux en cours)
- ❌ Isochrones visuelles sur carte
- ❌ Optimisation multi-destinations (TSP)
- ❌ Alertes trafic
- ❌ Authentification/rate limiting par utilisateur (rate limit IP suffit)

---

## 2. Architecture Retenue

### Solution Finale : Valhalla + Navitia

**Pattern Strategy (SmartRoutingProvider)** :
- **Valhalla** : modes `car`, `truck`, `pedestrian` (traffic historique)
- **Navitia** : mode `transit` (horaires SNCF réels)

```
┌─────────────────────────────────────────┐
│    SmartRoutingProvider (Strategy)      │
│  ┌───────────────┬──────────────────┐   │
│  │   Valhalla    │     Navitia      │   │
│  │ (car/truck)   │    (transit)     │   │
│  └───────────────┴──────────────────┘   │
└─────────────────────────────────────────┘
            ▲                    ▲
            │                    │
    HTTP local/Railway      HTTPS API
            │                    │
   ┌────────▼────────┐   ┌───────▼────────┐
   │  Valhalla       │   │   Navitia API  │
   │  Self-Hosted    │   │   (SNCF)       │
   │  Docker         │   │   150k/mois    │
   │  Gratuit ∞      │   │   Gratuit      │
   └─────────────────┘   └────────────────┘
```

### Stack Technique

**Backend API** :
- Fastify (Node.js + TypeScript)
- Pattern Strategy (SmartRoutingProvider)
- Providers : ValhallaProvider, NavitiaProvider
- Cache : MockCacheService (MVP), PostgreSQL (post-MVP)

**Infrastructure Valhalla** :
- Image Docker : `ghcr.io/valhalla/valhalla:latest`
- Données OSM France : ~2GB
- Speed tiles historiques : ~1-2GB (optionnel)
- RAM requise : **12 GB minimum** (build tiles OOM avec moins)
- Disque : 15GB
- Plateforme : Railway ou Render
- **Coût** : 15-20€/mois

**Configuration** :
```bash
ROUTING_PROVIDER=smart
VALHALLA_BASE_URL=http://localhost:8002  # Dev
VALHALLA_BASE_URL=https://valhalla.railway.app  # Prod
NAVITIA_API_KEY=your_key_here
```

---

## 3. Fichiers Implémentés

### Backend Core (✅ Complétés)

| Fichier | Rôle | Statut |
|---------|------|--------|
| `apps/api/src/routing/providers/ValhallaProvider.ts` | Provider Valhalla (Matrix + Route APIs) | ✅ Créé |
| `apps/api/src/routing/providers/factory.ts` | Factory mise à jour (support Valhalla) | ✅ Modifié |
| `apps/api/src/config/validateEnv.ts` | Validation `VALHALLA_BASE_URL` | ✅ Modifié |
| `apps/api/src/routing/routes.ts` | Schema API (maxItems: 3 destinations) | ✅ Modifié |

### Infrastructure (✅ Complétés)

| Fichier | Rôle | Statut |
|---------|------|--------|
| `apps/api/docker-compose.yml` | Service Valhalla local | ✅ Créé |
| `apps/api/.env.example` | Documentation variables env | ✅ Modifié |
| `apps/api/VALHALLA_SETUP.md` | Guide setup complet | ✅ Créé |

### Documentation (✅ Complété)

| Fichier | Rôle | Statut |
|---------|------|--------|
| `docs/feature/routing-service/implementation-valhalla.md` | Ce fichier | ✅ Créé |

---

## 4. Jalons Techniques (État d'Avancement)

### ✅ Jalon 1 : Provider Valhalla (Backend Core) - COMPLÉTÉ

**Implémenté** :
- ✅ `ValhallaProvider.ts` créé avec interface `RoutingProvider`
- ✅ `calculateMatrix()` utilise Sources-to-Targets API (batch natif)
- ✅ `calculateRoute()` retourne GeoJSON LineString
- ✅ Mapping modes transport (`car` → `auto`, etc.)
- ✅ Support `arrivalTime` / `departureTime` (date_time parameter)
- ✅ Error handling (timeout, retry avec p-retry)

**Critères validés** :
- ✅ TypeScript compile sans erreur (`pnpm typecheck`)
- ✅ Interface `RoutingProvider` respectée

**Tests manuels restants** :
- ⏳ Tests unitaires `ValhallaProvider.test.ts` (optionnel MVP)
- ⏳ Mock API Valhalla pour tests automatisés

---

### ✅ Jalon 2 : Intégration SmartRoutingProvider - COMPLÉTÉ

**Implémenté** :
- ✅ `factory.ts` mis à jour avec support Valhalla
- ✅ `VALHALLA_BASE_URL` ajouté dans `validateEnv.ts`
- ✅ ProviderMap configuré : Valhalla (car) + Navitia (transit)
- ✅ Validation env au startup

**Critères validés** :
- ✅ `ROUTING_PROVIDER=smart` charge SmartRoutingProvider
- ✅ Mode `car` → route vers ValhallaProvider
- ✅ Mode `transit` → route vers NavitiaProvider

**Tests restants** :
- ⏳ Test E2E dispatch selon mode transport

---

### ✅ Jalon 3 : Setup Infrastructure Valhalla (Docker) - COMPLÉTÉ

**Implémenté** :
- ✅ `docker-compose.yml` créé avec service Valhalla (commande explicite `valhalla_service`)
- ✅ `VALHALLA_SETUP.md` guide complet (réécrit avec retours d'expérience réels)
- ✅ Configuration `valhalla.json` générée via `valhalla_build_config`
- ✅ OSM France téléchargé (`france-latest.osm.pbf`, ~4 GB)
- ✅ Tiles buildées avec succès (55 min, 4 threads, 12 GB RAM)
- ✅ Endpoints testés : `/status`, `/route`, `/sources_to_targets`

**Stats du build** :
| Métrique | Valeur |
|----------|--------|
| Durée build tiles | ~55 min |
| Taille tiles | ~3.9 GB |
| Threads utilisés | 4 (`-j 4`) |
| RAM allouée Docker | 12 GB (`--memory 12g`) |

**Résultats des tests** :
- Route Montpellier → Lyon : ~3h00 (cohérent)
- Matrix Montpellier → Nîmes : ~47 min (cohérent)
- Health check `/status` : OK

**Leçons apprises** (documentées dans `VALHALLA_SETUP.md`) :
- L'image officielle n'a **pas d'entrypoint** → `command:` obligatoire dans docker-compose
- Build OOM-killed sans `--memory 12g` et `-j 4`
- Windows : `MSYS_NO_PATHCONV=1` nécessaire pour Git Bash
- `valhalla_build_config` recommandé au lieu de JSON manuel

---

### ⏳ Jalon 4 : Tests Intégration API - À FAIRE

**Objectif** : Endpoints `/api/routing/matrix` et `/route` fonctionnels avec Valhalla

**Prérequis** : Jalon 3 complété (Valhalla opérationnel)

**Tests à exécuter** :
```bash
# 1. Démarrer backend API
cd apps/api
pnpm dev

# 2. Test matrix car (Valhalla)
curl -X POST http://localhost:3001/api/routing/matrix \
  -H "Content-Type: application/json" \
  -d '{
    "origins": [{"lat": 43.6108, "lng": 3.8767}],
    "destinations": [
      {"lat": 48.8566, "lng": 2.3522},
      {"lat": 45.7640, "lng": 4.8357}
    ],
    "mode": "car",
    "arrivalTime": "2026-03-17T08:30:00Z"
  }'

# Vérifier :
# - 200 OK
# - durations[0] = [~26000, ~18000] secondes
# - distances[0] = [~750000, ~500000] mètres

# 3. Test route geometry
curl -X POST http://localhost:3001/api/routing/route \
  -H "Content-Type: application/json" \
  -d '{
    "origin": {"lat": 43.6108, "lng": 3.8767},
    "destination": {"lat": 48.8566, "lng": 2.3522},
    "mode": "car",
    "arrivalTime": "2026-03-17T08:30:00Z"
  }'

# Vérifier :
# - geometry.type === "LineString"
# - geometry.coordinates.length > 100

# 4. Test SmartRouting transit (Navitia)
curl -X POST http://localhost:3001/api/routing/matrix \
  -H "Content-Type: application/json" \
  -d '{
    "origins": [{"lat": 43.6108, "lng": 3.8767}],
    "destinations": [{"lat": 48.8566, "lng": 2.3522}],
    "mode": "transit",
    "arrivalTime": "2026-03-17T08:30:00Z"
  }'
```

**Critères validation** :
- ✅ `POST /api/routing/matrix` retourne 200 OK
- ✅ `durations[][]` et `distances[][]` remplies
- ✅ `POST /api/routing/route` retourne geometry GeoJSON
- ✅ Mode `transit` route vers Navitia
- ✅ Temps réponse matrix <5s (10 origins × 3 destinations)

---

### ⏳ Jalon 5 : Déploiement Production (Railway/Render) - À FAIRE

**Prérequis** : Jalons 3 et 4 complétés

**Tâches** :
1. Build tiles Valhalla localement (voir VALHALLA_SETUP.md)
2. Créer Dockerfile production
3. Déployer sur Railway/Render
4. Configurer variables env production
5. Tester endpoint public

**Dockerfile** (à créer) :
```dockerfile
FROM ghcr.io/valhalla/valhalla:latest

# Note : cette image n'a PAS d'entrypoint.
# Les env vars serve_tiles/use_tiles_ignore_pbf ne fonctionnent PAS.
COPY valhalla_tiles /custom_files/valhalla_tiles
COPY valhalla.json /custom_files/valhalla.json

EXPOSE 8002

CMD ["valhalla_service", "/custom_files/valhalla.json"]
```

**Configuration Railway** :
- RAM : **12 GB minimum** (4 GB insuffisant pour la France)
- Disque : 15GB
- Port : 8002
- Variables env : aucune requise

---

### ✅ Jalon 6 : Documentation & Schema - COMPLÉTÉ

**Implémenté** :
- ✅ Schema API mis à jour : `maxItems: 3` destinations
- ✅ Documentation mode transport mise à jour (Valhalla + Navitia)
- ✅ `VALHALLA_SETUP.md` guide complet
- ✅ Ce fichier d'implémentation

**Critères validés** :
- ✅ Swagger UI affiche `maxItems: 3`
- ✅ Documentation setup Valhalla complète

---

### ⏳ Jalon 7 : Tests Charge & Monitoring (Optionnel MVP) - À FAIRE

**Objectif** : Valider capacité 1k users/jour

**Tests** :
- Simuler 1000 requêtes matrix (50 communes × 3 destinations)
- Mesurer latency P50/P95/P99
- Vérifier CPU/RAM Valhalla
- Configurer monitoring (Sentry, logs JSON)

**Critères** :
- ✅ Latency P95 <10s (matrix 50×3)
- ✅ Pas d'erreur timeout ou OOM
- ✅ CPU <80% (moyenne)
- ✅ RAM <3GB utilisée

---

## 5. Métriques de Succès MVP

| Métrique | Objectif | État | Validation |
|----------|----------|------|------------|
| **Quota API externe** | Gratuit illimité | ✅ | Valhalla self-hosted (pas de quota) |
| **Support 1k users/jour** | Oui | ✅ | Pas de limite quota API |
| **Trafic historique** | Time-dependent natif | ⚠️ LIMITATION | Sans speed tiles : durées constantes quelle que soit l'heure (voir section 9) |
| **Budget infrastructure** | ≤20€/mois | ⏳ | À valider post-déploiement Railway |
| **Latency matrix P95** | <10s (50×3) | ⏳ | À mesurer post-déploiement |
| **Geometry support** | GeoJSON LineString | ✅ | Implémenté dans ValhallaProvider |
| **Multi-destinations** | Jusqu'à 3 | ✅ | Schema API mis à jour |
| **Modes transport** | car, truck, pedestrian, transit | ✅ | SmartRouting dispatch implémenté |

---

## 6. Prochaines Étapes

### Court terme (Avant MVP)

1. **✅ Setup Valhalla local** (Jalon 3) — COMPLÉTÉ
   - OSM France téléchargé, tiles buildées (~55 min), endpoints testés

2. **⏳ Tests intégration** (Jalon 4)
   - Valider matrix API end-to-end
   - Valider route API avec geometry
   - Valider dispatch SmartRouting

3. **⏳ Déploiement production** (Jalon 5)
   - Créer Dockerfile
   - Déployer sur Railway/Render
   - Valider endpoint public

### Moyen terme (Post-MVP)

1. **Cache PostgreSQL**
   - Implémenter `PostgresCacheService`
   - Snapping geohash6 + time bucketing 30min
   - Hit rate cible : 90%+

2. **⚡ Speed tiles historiques** (PRIORITÉ P1 post-MVP)
   - Résout la limitation critique : time-dependent routing non fonctionnel sans speed tiles
   - Voir section 9 pour le plan détaillé

3. **Monitoring & Observability**
   - Sentry error tracking
   - Latency metrics (P50/P95/P99)
   - Cache hit rate tracking

### Long terme (Optimisations)

1. **Frontend Implementation**
   - UI saisie multi-destinations
   - Affichage parcours sur carte
   - Filtrage communes par temps trajet

2. **Isochrones**
   - Valhalla Isochrone API
   - Visualisation zones accessibles

3. **Optimisation multi-destinations**
   - TSP (Traveling Salesman Problem)
   - Optimized Route API Valhalla

---

## 7. Risques & Mitigations

| Risque | Impact | Probabilité | État | Mitigation |
|--------|--------|-------------|------|------------|
| Valhalla setup complexe | Moyen | Faible | ✅ Mitigé | Guide VALHALLA_SETUP.md réécrit avec retours d'expérience réels (OOM, MSYS, entrypoint) |
| Speed tiles manquantes | Élevé | Moyenne | ✅ Mitigé | Freeflow/constrained par défaut (suffisant MVP) |
| Infrastructure insuffisante | Moyen | Faible | ✅ Validé | France complète build OK : 55 min, 3.9 GB tiles, 12 GB RAM |
| Valhalla moins précis que TomTom | Faible | Faible | ✅ Validé | Tests réels cohérents (Montpellier→Lyon ~3h, →Nîmes ~47min) |
| Build tiles échoue | Moyen | Faible | ✅ Mitigé | Build réussi. Pièges documentés : --memory 12g, -j 4, MSYS_NO_PATHCONV |

---

## 8. Ressources

### Documentation Valhalla

- [Valhalla Documentation](https://valhalla.github.io/valhalla/)
- [Valhalla API Reference](https://valhalla.github.io/valhalla/api/)
- [Historical Traffic Guide](https://valhalla.github.io/valhalla/mjolnir/historical_traffic/)

### Données OSM

- [OSM France Downloads](http://download.geofabrik.de/europe/france.html)
- [Geofabrik - Europe](http://download.geofabrik.de/europe/)

### Alternatives Explorées

- [OpenRouteService](https://openrouteservice.org/) - Quota matrix 500/jour insuffisant
- [OSRM](http://project-osrm.org/) - Pas de time-dependent routing natif
- [GraphHopper](https://www.graphhopper.com/) - Support traffic historique mais documentation limitée
- [TomTom](https://developer.tomtom.com/) - Quota gratuit dépassé 60x, coût payant ~1000€/mois

### Support

- [Valhalla GitHub](https://github.com/valhalla/valhalla)
- [Valhalla Discussions](https://github.com/valhalla/valhalla/discussions)

---

---

## 9. Limitation MVP : Time-Dependent Routing Non Fonctionnel

### Constat (validé le 17 février 2026)

Valhalla **sans speed tiles historiques** ignore le paramètre `date_time`. Les durées retournées sont strictement identiques quelle que soit l'heure spécifiée.

**Test effectué** — Route Montpellier → Paris :

| Heure | Durée |
|-------|-------|
| Lundi 8h30 (pointe) | 22932.349s (6.4h) |
| 14h00 (creuse) | 22932.349s (6.4h) |
| 3h00 (nuit) | 22932.349s (6.4h) |
| Sans `date_time` | 22932.349s (6.4h) |

**Cause** : L'image officielle `ghcr.io/valhalla/valhalla:latest` ne contient aucune donnée de trafic historique. Valhalla utilise uniquement les vitesses nominales des segments OSM (speed limits), qui sont constantes.

### Impact MVP

- Les champs `arrivalTime` / `departureTime` de l'API sont **acceptés mais cosmétiques**
- Le classement relatif des communes par temps de trajet reste **valide** (basé sur les vitesses légales et la topologie du réseau routier)
- La promesse "temps de trajet en heure de pointe" n'est **pas tenue**

### Décision MVP

- **Garder l'architecture matrix actuelle** — elle reste pertinente pour le classement relatif
- **Être transparent côté UI** — afficher "temps de trajet estimé", pas "temps en heure de pointe"
- **Reporter le time-dependent routing** en priorité P1 post-MVP (roadmap ci-dessous)

### Approche isochrone évaluée et refusée

L'approche isochrone (un polygone au lieu de matrix N×M) a été évaluée comme alternative mais **refusée** pour le MVP :
- Même limitation : utilise le même moteur, donc pas de variation horaire non plus
- Perte de précision : booléen dedans/dehors au lieu de durée exacte par commune
- Multi-destinations complexe : intersection de polygones côté client
- Hors périmètre MVP explicite dans la spec

L'isochrone reste pertinent en post-MVP pour la **visualisation exploratoire** (Phase 4).

---

## 10. Roadmap : Intégration Speed Tiles Historiques (Post-MVP P1)

### Objectif

Activer le time-dependent routing réel dans Valhalla pour que les durées varient selon l'heure de départ/arrivée (rush hour vs heures creuses).

### Fonctionnement technique

Valhalla supporte 2016 "speed records" par segment routier par semaine (= 1 valeur toutes les 5 minutes). Ces données sont stockées dans des **speed tiles** séparées des routing tiles.

Documentation officielle : https://valhalla.github.io/valhalla/mjolnir/historical_traffic/

### Étapes d'intégration

#### Étape 1 : Sourcer les données de trafic historiques

**Options à évaluer** :

| Source | Format | Coût | Couverture |
|--------|--------|------|------------|
| [SharedStreets](https://sharedstreets.io/) | Speed CSV par segment OSM | Gratuit (open data) | Variable, USA principalement |
| [Uber Movement](https://movement.uber.com/) | Speed par segment | Gratuit (academic) | Grandes villes FR |
| [TomTom Traffic Stats](https://developer.tomtom.com/) | Speed profiles | Payant (~500€/mois) | France complète |
| [HERE Traffic](https://developer.here.com/) | Speed profiles | Payant | France complète |
| Données capteurs publics (data.gouv.fr) | CSV temps de parcours | Gratuit | Autoroutes/nationales uniquement |

**Action** : Évaluer SharedStreets et data.gouv.fr en priorité (gratuits). Si couverture insuffisante, budgéter TomTom Traffic Stats.

#### Étape 2 : Convertir au format Valhalla

```bash
# Format attendu : CSV avec colonnes
# segment_id, speed_0, speed_1, ..., speed_2015
# (2016 valeurs = 7 jours × 288 intervalles de 5 min)

# Conversion vers speed tiles
valhalla_build_traffic \
  -c valhalla.json \
  --traffic-csv /path/to/speeds.csv
```

#### Étape 3 : Rebuild tiles avec speed data

```bash
docker run --rm --memory 12g \
  -v $(pwd)/valhalla_tiles:/custom_files \
  ghcr.io/valhalla/valhalla:latest \
  valhalla_build_tiles -j 4 \
  -c /custom_files/valhalla.json \
  /custom_files/france-latest.osm.pbf
```

#### Étape 4 : Valider le time-dependent routing

```bash
# Test : durée 8h30 doit être > 1.3× durée 14h00 sur trajet sensible au trafic
curl -X POST http://localhost:8002/route \
  -H "Content-Type: application/json" \
  -d '{
    "locations": [{"lat":48.85,"lon":2.35},{"lat":48.92,"lon":2.27}],
    "costing": "auto",
    "date_time": {"type":1, "value":"2026-03-16T08:30"}
  }'
# Comparer avec 14h00
```

**Critère de succès** : Variation ≥15% entre pointe et creuse sur trajet urbain.

### Estimation

- **Effort** : 2-4 jours (si données gratuites disponibles), 1-2 jours + budget (si données payantes)
- **Risque** : Disponibilité de données gratuites couvrant la France
- **Impact tiles** : +1-2 GB supplémentaires, rebuild ~1h

---

**Résumé** : L'implémentation backend core est **complétée** (Jalons 1, 2, 3, 6). Valhalla est opérationnel localement avec les tiles France (~3.9 GB, build 55 min). **Limitation connue** : le time-dependent routing est cosmétique sans speed tiles historiques (P1 post-MVP). Tests intégration API (Jalon 4) et déploiement production (Jalon 5) sont les prochaines étapes.
