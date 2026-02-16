# Valhalla Setup Guide

Ce guide explique comment configurer Valhalla localement pour le développement.
Basé sur le setup réel effectué le 16 février 2026 (France entière, ~55 min build).

## Prérequis

- **Docker Desktop** avec **>=12 GB de RAM alloués** (Settings → Resources → Memory)
  - Le build tiles consomme beaucoup de mémoire. Avec <12 GB, le container sera OOM-killed (exit code 137).
- **~15 GB d'espace disque** libre (OSM France ~4 GB + tiles ~4 GB + marge)
- **Windows** : Git Bash / MSYS2 transforme automatiquement les paths Unix en paths Windows, ce qui casse les commandes Docker. Préfixer chaque commande `docker run` avec :
  ```bash
  MSYS_NO_PATHCONV=1 docker run ...
  ```

> **Note image Docker** : L'image officielle `ghcr.io/valhalla/valhalla:latest` n'a **PAS d'entrypoint**
> (contrairement à l'image GIS-OPS `ghcr.io/gis-ops/docker-valhalla`).
> Les variables d'environnement `serve_tiles`, `use_tiles_ignore_pbf` ne fonctionnent **PAS** avec cette image.
> Il faut toujours spécifier la commande explicitement (`valhalla_build_tiles`, `valhalla_service`, etc.).

---

## Setup Initial (Première fois uniquement)

### 1. Télécharger les données OSM France

```bash
cd apps/api
mkdir -p valhalla_tiles
cd valhalla_tiles

# Télécharger France (~4GB, peut prendre 10-30 min)
wget http://download.geofabrik.de/europe/france-latest.osm.pbf
```

### 2. Générer la configuration Valhalla

**Ne pas écrire `valhalla.json` manuellement.** Utiliser `valhalla_build_config` pour générer un fichier valide :

```bash
cd apps/api/valhalla_tiles

# Windows : ajouter MSYS_NO_PATHCONV=1 devant la commande
docker run --rm -v "$(pwd):/custom_files" ghcr.io/valhalla/valhalla:latest \
  valhalla_build_config \
  --mjolnir-tile-dir /custom_files/valhalla_tiles \
  --mjolnir-admin /custom_files/valhalla_tiles/admin.sqlite \
  --mjolnir-timezone /custom_files/valhalla_tiles/tz_world.sqlite \
  > valhalla.json
```

Ensuite, **modifier `valhalla.json`** pour augmenter les limites matrix (nécessaire pour le cas d'usage ~50 communes × 3 destinations) :

```json
{
  "service_limits": {
    "auto": {
      "max_distance": 5000000.0,
      "max_locations": 20,
      "max_matrix_distance": 400000.0,
      "max_matrix_locations": 50
    },
    "sources_to_targets": {
      "max_distance": 200000.0,
      "max_locations": 50,
      "max_matrix_distance": 400000.0,
      "max_matrix_locations": 50
    }
  }
}
```

> **Astuce** : `max_matrix_distance` en mètres. 400 000 = 400 km. Si vous obtenez l'erreur "Path distance exceeds limit", augmentez cette valeur.

### 3. Build les tiles Valhalla

**Important** : Cette étape prend environ **55 minutes** sur une machine moderne (4 threads, 12 GB RAM).

```bash
cd apps/api/valhalla_tiles

# Windows : ajouter MSYS_NO_PATHCONV=1 devant la commande
docker run --rm --memory 12g -v "$(pwd):/custom_files" ghcr.io/valhalla/valhalla:latest \
  valhalla_build_tiles -j 4 \
  -c /custom_files/valhalla.json \
  /custom_files/france-latest.osm.pbf
```

**Paramètres critiques** :
- `--memory 12g` : **obligatoire**. Sans cette limite, Docker peut allouer toute la RAM disponible ou, au contraire, ne pas en allouer assez. 12 GB est le minimum testé pour la France entière.
- `-j 4` : nombre de threads. Réduire à `-j 2` si vous manquez de RAM (au prix d'un build plus long).

```bash
# Vérifier que les tiles ont été créées (~3.9 GB)
ls -lh valhalla_tiles/
# Vous devriez voir des dossiers numérotés (0/, 1/, 2/) contenant des fichiers .gph
```

### 4. Démarrer Valhalla

```bash
cd apps/api
docker-compose up -d valhalla

# Vérifier les logs
docker-compose logs -f valhalla

# Attendre le message "Tiles loaded. Listener is ready..."
```

### 5. Tester le service

```bash
# Health check
curl http://localhost:8002/status

# Test route simple (Montpellier → Lyon, attend ~3h00)
curl -X POST http://localhost:8002/route \
  -H "Content-Type: application/json" \
  -d '{
    "locations": [
      {"lat": 43.6108, "lon": 3.8767},
      {"lat": 45.7640, "lon": 4.8357}
    ],
    "costing": "auto"
  }'

# Test matrix (Montpellier → Nîmes, attend ~47 min)
curl -X POST http://localhost:8002/sources_to_targets \
  -H "Content-Type: application/json" \
  -d '{
    "sources": [{"lat": 43.6108, "lon": 3.8767}],
    "targets": [
      {"lat": 43.8367, "lon": 4.3601}
    ],
    "costing": "auto"
  }'
```

---

## Utilisation Quotidienne

Une fois les tiles buildées (étape 3), vous n'avez plus besoin de les rebuilder :

```bash
# Démarrer Valhalla
docker-compose up -d valhalla

# Arrêter Valhalla
docker-compose down
```

---

## Configuration Backend API

Mettre à jour `apps/api/.env` :

```bash
ROUTING_PROVIDER=smart
VALHALLA_BASE_URL=http://localhost:8002
NAVITIA_API_KEY=your-navitia-key
```

---

## Trafic Historique (Non disponible en MVP)

> **Limitation confirmée** : Sans speed tiles historiques, Valhalla ignore le paramètre `date_time`.
> Les durées sont identiques quelle que soit l'heure (8h30, 14h, 3h du matin).
> Le mode "freeflow/constrained" mentionné dans la doc Valhalla nécessite des données de trafic externes — il n'est **pas actif par défaut**.

Les temps de trajet sont basés sur les vitesses nominales OSM (speed limits), ce qui reste réaliste pour un classement relatif des communes.

**Post-MVP** : Intégrer des speed tiles historiques pour activer le time-dependent routing réel. Voir `docs/feature/routing-service/implementation-valhalla.md` section 10 pour la roadmap complète.

Documentation : https://valhalla.github.io/valhalla/mjolnir/historical_traffic/

---

## Maintenance

### Mise à jour des données OSM

Recommandé **tous les 1-3 mois** pour intégrer les nouvelles routes et modifications.

```bash
cd apps/api/valhalla_tiles

# 1. Arrêter le service
cd .. && docker-compose down && cd valhalla_tiles

# 2. Télécharger la dernière version OSM France
wget -O france-latest.osm.pbf http://download.geofabrik.de/europe/france-latest.osm.pbf

# 3. Supprimer les anciennes tiles
rm -rf valhalla_tiles/

# 4. Rebuild les tiles (Windows : ajouter MSYS_NO_PATHCONV=1)
docker run --rm --memory 12g -v "$(pwd):/custom_files" ghcr.io/valhalla/valhalla:latest \
  valhalla_build_tiles -j 4 \
  -c /custom_files/valhalla.json \
  /custom_files/france-latest.osm.pbf

# 5. Redémarrer le service
cd ..
docker-compose up -d valhalla
```

### Monitoring santé container

```bash
# Vérifier que le container tourne
docker-compose ps valhalla

# Health check (configuré dans docker-compose.yml)
curl http://localhost:8002/status

# Vérifier utilisation RAM/CPU
docker stats choisir-sa-ville-valhalla --no-stream
```

### Backup / Restore tiles

Les tiles sont dans `apps/api/valhalla_tiles/valhalla_tiles/`. Elles représentent ~3.9 GB pour la France.

```bash
# Backup
tar czf valhalla_tiles_backup.tar.gz valhalla_tiles/valhalla_tiles/

# Restore
tar xzf valhalla_tiles_backup.tar.gz
```

> **Astuce** : Le rebuild prend ~55 min. Si vous avez un disque externe ou un stockage cloud, sauvegarder les tiles évite de les rebuilder.

---

## Dépannage

### Problème : OOM kill (exit code 137)

**Cause** : Le container manque de RAM pendant le build ou l'exécution.

**Solution** :
1. Augmenter la RAM allouée à Docker Desktop (≥12 GB)
2. Réduire le nombre de threads : `-j 2` au lieu de `-j 4`
3. Vérifier avec `docker stats` que le container ne sature pas la RAM

### Problème : Container quitte immédiatement

**Cause** : L'image officielle `ghcr.io/valhalla/valhalla:latest` n'a **pas d'entrypoint**. Sans `command:` explicite dans docker-compose, le container n'a rien à exécuter.

**Solution** : Vérifier que `docker-compose.yml` contient bien :
```yaml
command: valhalla_service /custom_files/valhalla.json 1
```

Le `1` active le mode verbose (utile pour le debug). Retirer pour moins de logs.

### Problème : "No route found"

**Cause** : Les coordonnées ne sont peut-être pas dans la bbox France.

**Solution** : Vérifier que vos coordonnées sont bien dans `france-latest.osm.pbf`. Pour d'autres régions, télécharger le fichier OSM correspondant.

### Problème : "Path distance exceeds limit" (matrix)

**Cause** : La distance entre source et target dépasse `max_matrix_distance` dans `valhalla.json`.

**Solution** : Augmenter `max_matrix_distance` dans les sections `auto` et `sources_to_targets` de `valhalla.json` :
```json
"max_matrix_distance": 400000.0
```
Puis redémarrer le service : `docker-compose restart valhalla`.

### Problème : Build tiles très lent (>2h)

**Cause** : Ressources limitées.

**Solution** : Allouer plus de RAM à Docker (12 GB recommandé) et vérifier que `-j 4` est spécifié.

### Problème : Paths Windows transformés par MSYS

**Cause** : Git Bash / MSYS2 convertit automatiquement `/custom_files/...` en `C:/Program Files/Git/custom_files/...`.

**Solution** : Préfixer chaque commande Docker avec `MSYS_NO_PATHCONV=1` :
```bash
MSYS_NO_PATHCONV=1 docker run ...
```

---

## Limites & Quotas

Contrairement à TomTom/Navitia, Valhalla est **self-hosted donc gratuit illimité**.

Limites configurées (voir `valhalla.json`) :
- Matrix : 50 sources × 50 targets max par requête
- Route : 20 waypoints max
- Distance max : 5000 km (auto/truck), 250 km (pedestrian)

**Pour MVP** : Ces limites sont largement suffisantes (besoin : ~50 communes × 3 destinations).

---

## Résumé des stats du build France

| Métrique | Valeur |
|----------|--------|
| Durée build tiles | ~55 min |
| Taille tiles | ~3.9 GB |
| Threads utilisés | 4 |
| RAM allouée | 12 GB |
| Taille OSM France | ~4 GB |

---

## Ressources

- [Valhalla Documentation](https://valhalla.github.io/valhalla/)
- [Valhalla API Reference](https://valhalla.github.io/valhalla/api/)
- [OSM France Downloads](http://download.geofabrik.de/europe/france.html)
- [Historical Traffic Guide](https://valhalla.github.io/valhalla/mjolnir/historical_traffic/)
