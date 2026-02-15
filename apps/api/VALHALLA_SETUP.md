# Valhalla Setup Guide

Ce guide explique comment configurer Valhalla localement pour le développement.

## Prérequis

- Docker et Docker Compose installés
- ~10GB d'espace disque libre (données OSM France + tiles)
- ~4GB RAM disponible

## Setup Initial (Première fois uniquement)

### 1. Télécharger les données OSM France

```bash
cd apps/api
mkdir -p valhalla_tiles
cd valhalla_tiles

# Télécharger France (~2GB, peut prendre 10-30 min)
wget http://download.geofabrik.de/europe/france-latest.osm.pbf
```

### 2. Créer le fichier de configuration Valhalla

Créer `valhalla_tiles/valhalla.json` :

```json
{
  "mjolnir": {
    "tile_dir": "/custom_files/valhalla_tiles",
    "admin": "/custom_files/valhalla_tiles/admin.sqlite",
    "timezone": "/custom_files/valhalla_tiles/tz_world.sqlite",
    "transit_dir": "/custom_files/valhalla_tiles/transit"
  },
  "additional_data": {
    "elevation": "/custom_files/valhalla_tiles/elevation"
  },
  "loki": {
    "actions": ["locate", "route", "height", "sources_to_targets", "optimized_route", "isochrone", "trace_route", "trace_attributes"],
    "logging": {
      "long_request": 100.0
    },
    "service_defaults": {
      "minimum_reachability": 50,
      "radius": 0,
      "search_cutoff": 35000,
      "node_snap_tolerance": 5,
      "street_side_tolerance": 5,
      "street_side_max_distance": 1000,
      "heading_tolerance": 60
    }
  },
  "thor": {
    "logging": {
      "long_request": 110.0
    },
    "source_to_target_algorithm": "select_optimal"
  },
  "odin": {
    "logging": {
      "long_request": 110.0
    }
  },
  "meili": {
    "mode": "auto",
    "customizable": ["mode", "search_radius", "turn_penalty_factor", "gps_accuracy", "interpolation_distance", "sigma_z", "beta", "max_route_distance_factor", "max_route_time_factor"],
    "verbose": false,
    "default": {
      "sigma_z": 4.07,
      "gps_accuracy": 5.0,
      "beta": 3,
      "max_route_distance_factor": 3,
      "max_route_time_factor": 3,
      "breakage_distance": 2000,
      "interpolation_distance": 10,
      "search_radius": 50,
      "max_search_radius": 100,
      "turn_penalty_factor": 0
    }
  },
  "service_limits": {
    "auto": {
      "max_distance": 5000000.0,
      "max_locations": 20,
      "max_matrix_distance": 400000.0,
      "max_matrix_locations": 50
    },
    "truck": {
      "max_distance": 5000000.0,
      "max_locations": 20,
      "max_matrix_distance": 400000.0,
      "max_matrix_locations": 50
    },
    "pedestrian": {
      "max_distance": 250000.0,
      "max_locations": 50,
      "max_matrix_distance": 200000.0,
      "max_matrix_locations": 50,
      "min_transit_walking_distance": 1,
      "max_transit_walking_distance": 10000
    },
    "sources_to_targets": {
      "max_distance": 200000.0,
      "max_locations": 50,
      "max_matrix_distance": 200000.0,
      "max_matrix_locations": 50
    },
    "isochrone": {
      "max_contours": 4,
      "max_time": 120,
      "max_distance": 25000.0,
      "max_locations": 1
    }
  }
}
```

### 3. Build les tiles Valhalla

**Important** : Cette étape peut prendre 1-3 heures selon votre machine.

```bash
cd apps/api/valhalla_tiles

# Build tiles depuis OSM data
docker run -v $(pwd):/custom_files ghcr.io/valhalla/valhalla \
  valhalla_build_tiles \
  -c /custom_files/valhalla.json \
  /custom_files/france-latest.osm.pbf

# Vérifier que les tiles ont été créées
ls -lh valhalla_tiles/
# Vous devriez voir des fichiers .gph
```

### 4. Démarrer Valhalla

```bash
cd apps/api
docker-compose up -d valhalla

# Vérifier les logs
docker-compose logs -f valhalla

# Attendre le message "HTTP server running on port 8002"
```

### 5. Tester le service

```bash
# Health check
curl http://localhost:8002/status

# Test route simple
curl -X POST http://localhost:8002/route \
  -H "Content-Type: application/json" \
  -d '{
    "locations": [
      {"lat": 43.6108, "lon": 3.8767},
      {"lat": 48.8566, "lon": 2.3522}
    ],
    "costing": "auto"
  }'

# Test matrix (sources-to-targets)
curl -X POST http://localhost:8002/sources_to_targets \
  -H "Content-Type: application/json" \
  -d '{
    "sources": [{"lat": 43.6108, "lon": 3.8767}],
    "targets": [
      {"lat": 48.8566, "lon": 2.3522},
      {"lat": 45.7640, "lon": 4.8357}
    ],
    "costing": "auto"
  }'
```

## Utilisation Quotidienne

Une fois les tiles buildées (étape 3), vous n'avez plus besoin de les rebuilder :

```bash
# Démarrer Valhalla
docker-compose up -d valhalla

# Arrêter Valhalla
docker-compose down
```

## Mise à Jour des Données OSM

Pour mettre à jour les données routières (recommandé tous les 1-3 mois) :

```bash
cd apps/api/valhalla_tiles

# Télécharger la dernière version OSM France
wget -O france-latest.osm.pbf http://download.geofabrik.de/europe/france-latest.osm.pbf

# Rebuild les tiles
docker run -v $(pwd):/custom_files ghcr.io/valhalla/valhalla \
  valhalla_build_tiles \
  -c /custom_files/valhalla.json \
  /custom_files/france-latest.osm.pbf

# Redémarrer le service
cd ..
docker-compose restart valhalla
```

## Configuration Backend API

Mettre à jour `apps/api/.env` :

```bash
ROUTING_PROVIDER=smart
VALHALLA_BASE_URL=http://localhost:8002
NAVITIA_API_KEY=your-navitia-key
```

## Trafic Historique (Optionnel)

Valhalla supporte les profils de vitesse historiques (2016 valeurs/semaine) mais nécessite des données externes.

**Pour MVP** : Valhalla utilise par défaut un pattern "freeflow/constrained" qui simule :
- Rush hour (7h-19h en semaine) : vitesse réduite (~60% de la vitesse max)
- Heures creuses : vitesse normale

**Pour production** : Intégrer des données de trafic historiques réelles (nécessite source externe).

Documentation : https://valhalla.github.io/valhalla/mjolnir/historical_traffic/

## Dépannage

### Problème : "No route found"

**Cause** : Les coordonnées ne sont peut-être pas dans la bbox France.

**Solution** : Vérifier que vos coordonnées sont bien dans `france-latest.osm.pbf`. Pour d'autres régions, télécharger le fichier OSM correspondant.

### Problème : Container s'arrête immédiatement

**Cause** : Tiles manquantes ou configuration invalide.

**Solution** :
```bash
docker-compose logs valhalla
# Vérifier les erreurs de chargement des tiles
```

### Problème : Build tiles très lent (>3h)

**Cause** : Ressources limitées.

**Solution** : Allouer plus de RAM à Docker (8GB recommandé pour build).

## Limites & Quotas

Contrairement à TomTom/Navitia, Valhalla est **self-hosted donc gratuit illimité**.

Limites configurées (voir `valhalla.json`) :
- Matrix : 50 sources × 50 targets max par requête
- Route : 20 waypoints max
- Distance max : 5000 km (auto/truck), 250 km (pedestrian)

**Pour MVP** : Ces limites sont largement suffisantes (besoin : ~50 communes × 3 destinations).

## Ressources

- [Valhalla Documentation](https://valhalla.github.io/valhalla/)
- [Valhalla API Reference](https://valhalla.github.io/valhalla/api/)
- [OSM France Downloads](http://download.geofabrik.de/europe/france.html)
- [Historical Traffic Guide](https://valhalla.github.io/valhalla/mjolnir/historical_traffic/)
