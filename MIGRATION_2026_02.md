# Migration vers architecture statique - Février 2026

## Actions effectuées

### Fichiers/dossiers à supprimer manuellement

Le projet a migré vers une architecture **statique complète (Jamstack)**. 
Les éléments suivants ne sont plus utilisés et doivent être supprimés :

#### 1. API Backend (obsolète)
```bash
# Supprimer le dossier complet
rm -rf apps/api
```

**Raison** : L'API Fastify + PostgreSQL a été remplacée par des données JSON statiques servies directement par Next.js.

#### 2. Docker Compose (PostgreSQL non utilisée)
```bash
# Supprimer le fichier
rm docker-compose.yml
```

**Raison** : Aucune base de données n'est utilisée en runtime. Les données sont générées au build par `packages/importer`.

#### 3. Scripts root obsolètes
Dans `package.json` (root), supprimer ces scripts qui référencent des packages inexistants :
- `build:deps` (référence packages/core et packages/db qui n'existent pas)

### Documentation obsolète déplacée

Les fichiers suivants ont été déplacés vers `docs/archive/` :
- `docs/DB_MODEL.md` → `docs/archive/DB_MODEL.md`
- `docs/API_CONTRACT.md` → `docs/archive/API_CONTRACT.md`

Un fichier `docs/archive/README.md` explique pourquoi ces documents sont archivés.

### Nouveaux fichiers créés

- `AGENTS.md` - Réécrit complètement pour refléter l'architecture actuelle
- `docs/ARCHITECTURE.md` - Architecture détaillée du projet
- `docs/DATA_PIPELINE.md` - Documentation du pipeline de génération de données
- `docs/archive/README.md` - Explication de l'ancienne architecture

## Nouvelle architecture

### Build Time
```
packages/importer (Node.js script)
  ↓ Télécharge données INSEE/Open Data
  ↓ Parse, normalise, agrège
  ↓ Génère JSON optimisés
  ↓
apps/web/public/data/{version}/
  ├── communes/indexLite.json
  ├── infra-zones/indexLite.json
  ├── manifest.json
  └── ...
```

### Runtime
```
Next.js (apps/web)
  ↓ Lit JSON statiques via fetch()
  ↓ Cache dans IndexedDB (7j TTL)
  ↓ SelectionService (state management)
  ↓ Render Map + UI
```

## Commandes de développement

```bash
# 1. Générer les données statiques (à faire en premier)
pnpm --filter @choisir-sa-ville/importer export:static

# 2. Lancer le frontend en dev
pnpm --filter @choisir-sa-ville/web dev

# 3. Build de production
pnpm --filter @choisir-sa-ville/web build
pnpm --filter @choisir-sa-ville/web start
```

## Migration complétée par

- Architecture statique (Jamstack)
- Suppression API + PostgreSQL
- Documentation mise à jour
- Pipeline de données optimisé
