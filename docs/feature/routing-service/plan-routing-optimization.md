# Plan: Performance-optimized routing architecture (Matrix + Geometry split)

## Problem Statement
L'API routing actuelle retourne matrix + geometry en une seule requête. Pour afficher les temps de trajet de 100+ communes, ça génère des réponses énormes (~6.8MB) avec des polylines inutilisées. L'utilisateur veut voir les résultats rapidement, puis charger la geometry uniquement au clic sur une commune.

## Proposed Approach

**Architecture en 2 temps:**

1. **Phase recherche** (Matrix API - bulk)
   - Endpoint: `POST /api/routing/matrix`
   - Retourne: `{durations[][], distances[][]}` uniquement (pas de geometry)
   - Use case: Calculer temps de trajet pour 100 communes d'un coup
   - Réponse: ~1KB (vs 6.8MB actuellement)

2. **Phase détail** (Route API - on-demand)  
   - Endpoint: `POST /api/routing/route` (nouveau)
   - Retourne: `{duration, distance, geometry: GeoJSON}`
   - Use case: Afficher polyline quand user clique sur une commune
   - Réponse: ~68KB par trajet

**Providers spécialisés:**
- **IGN** (voiture): Gratuit, GeoJSON natif, optimisé France
- **Navitia** (transports): Gratuit 150k/mois, seule API avec tracés détaillés TC France
- **TomTom** (fallback): 75k/mois, sécurité si IGN/Navitia tombent

## Workplan

### Phase 1: Recherche & validation IGN (étude doc technique)
- [ ] Étudier doc IGN Géoplateforme (https://geoservices.ign.fr/documentation/services/api-et-services-ogc/itineraires)
  - [ ] Identifier endpoints: matrix vs route
  - [ ] Format authentification (clé API)
  - [ ] Quotas gratuits & rate limits
  - [ ] Format coordonnées (lat,lng ou lng,lat?)
  - [ ] Support departureTime/arrivalTime
- [ ] Tester IGN Matrix API avec curl (Montpellier → 5 communes, mode voiture)
  - [ ] Vérifier format réponse (durations, distances)
  - [ ] Mesurer temps de réponse
- [ ] Tester IGN Route API avec curl (Montpellier → Paris)
  - [ ] Vérifier format geometry (GeoJSON LineString?)
  - [ ] Compter nombre de points
  - [ ] Vérifier compatibilité MapLibre (ordre coords)
- [ ] Documenter IGN dans session notes (auth, limites, formats)
- [ ] Vérifier si Navitia supporte mode matrix pur (sans geometry) via doc API

### Phase 2: Implémentation IGN Provider
- [ ] Créer `apps/api/src/routing/providers/IGNProvider.ts`
- [ ] Implémenter `calculateMatrix()` (IGN Matrix API, pas de geometry)
- [ ] Implémenter `calculateRoute()` (IGN Route API avec geometry GeoJSON)
- [ ] Ajouter `IGN_API_KEY` dans validateEnv.ts
- [ ] Ajouter IGN dans factory.ts
- [ ] Tester IGN provider end-to-end

### Phase 3: Refactoring interface providers
- [ ] Modifier `RoutingProvider` interface:
  - `calculateMatrix()`: retourne `{durations, distances}` (pas de routes)
  - `calculateRoute()`: nouveau, retourne `{duration, distance, geometry}`
- [ ] Adapter tous les providers (IGN, Navitia, TomTom, Mock) à la nouvelle interface
- [ ] Supprimer le champ `routes` de `MatrixResult`

### Phase 4: Nouveau endpoint /api/routing/route
- [ ] Créer `POST /api/routing/route` dans routes.ts
- [ ] Schema: `{origin, destination, mode, departureTime?, arrivalTime?}`
- [ ] Logique de sélection provider par mode:
  - `car` → IGN (primary) → TomTom (fallback)
  - `transit` → Navitia uniquement
- [ ] Validation: 1 seul origin + 1 seul destination
- [ ] Retourner GeoJSON LineString prêt pour MapLibre

### Phase 5: Refactoring /api/routing/matrix
- [ ] Supprimer toute logique de geometry de RoutingService
- [ ] Retourner uniquement `{durations, distances}` (supprimer `routes`)
- [ ] Optimiser pour bulk: accepter N origins × M destinations
- [ ] Re-activer le cache (plus de problème de taille maintenant)
- [ ] Mettre à jour schema Swagger

### Phase 6: Provider fallback & health
- [ ] Implémenter fallback chain:
  - Car: IGN → TomTom → error
  - Transit: Navitia → error (pas de fallback)
- [ ] Logger les décisions de provider (observability)
- [ ] Ajouter timeout différencié par provider (IGN 10s, Navitia 15s, TomTom 10s)

### Phase 7: Tests & validation
- [ ] Tester Matrix endpoint: 100 communes → réponse <5KB, <3s
- [ ] Tester Route endpoint: 1 trajet → geometry GeoJSON valide
- [ ] Tester fallback: désactiver IGN → TomTom prend le relais
- [ ] Tester Navitia avec vraie coverage France (pas sandbox)
- [ ] Typecheck + lint

### Phase 8: Documentation
- [ ] Mettre à jour `docs/architecture/routing-providers.md`:
  - Expliquer split matrix/route
  - Tableau comparatif providers par use case
  - Stratégie de cache par endpoint
- [ ] Mettre à jour `apps/api/README.md`:
  - Exemples d'utilisation des 2 endpoints
  - Flow recommandé: matrix → affichage → route au clic
- [ ] Créer `TESTING_IGN.md` avec exemples curl IGN
- [ ] Mettre à jour `.env.example` avec IGN_API_KEY

### Phase 9: Cleanup
- [ ] Supprimer code mort (geometry dans matrix)
- [ ] Supprimer endpoint `/api/geocode` (orphelin, jamais utilisé)
- [ ] Vérifier que tous les providers implémentent matrix + route
- [ ] Commit + push sur feature/mvp-phase1-backend-routing

## Notes & Considerations

**Gains de performance attendus:**
- Matrix (100 communes): 6.8MB → 1KB (~6800x plus léger)
- Temps de réponse: 15s → <3s (pas de génération geometry)
- Cache hit rate: x10 (geometry change rarement, matrix jamais pour même coords)

**Format de réponse recommandé:**

```json
// Matrix endpoint
POST /api/routing/matrix
{
  "durations": [[0, 2749]], // secondes
  "distances": [[0, 748912]] // mètres
}

// Route endpoint  
POST /api/routing/route
{
  "duration": 2749,
  "distance": 748912,
  "geometry": {
    "type": "LineString",
    "coordinates": [[3.8767, 43.6108], [2.3522, 48.8566], ...]
  }
}
```

**Stratégie de cache révisée:**
- **Matrix**: Geohash6 snapping + mode + time bucket → TTL 7 jours (stable)
- **Route**: Coords exactes + mode → TTL 24h (geometry change rarement)

**Breaking change pour le frontend:**
- L'app web devra appeler 2 endpoints au lieu d'1
- Mais gain UX énorme: affichage quasi-instantané des résultats

## Success Criteria
- [ ] IGN provider fonctionnel (car, France)
- [ ] Navitia provider fonctionnel (transit, France)  
- [ ] TomTom fallback testé (car, global)
- [ ] Matrix endpoint: <5KB pour 100 communes, <3s response time
- [ ] Route endpoint: GeoJSON valide pour MapLibre
- [ ] Typecheck + lint ✅
- [ ] Documentation à jour
