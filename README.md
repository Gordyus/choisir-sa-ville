# Choisir sa ville

Application web pour explorer des zones géographiques en France (communes + zones infra) sur une carte, avec des métriques issues de sources ouvertes.

**Architecture** : Jamstack (données statiques + Next.js)  
**Runtime** : aucun backend API, aucune base de données

## Démarrage rapide

Pré-requis : Node.js ≥ 22, pnpm ≥ 10.

```bash
pnpm install
pnpm export:static
pnpm dev
```

Ouvrir http://localhost:3000

## Données

- Les données sont générées au build par `packages/importer` dans `apps/web/public/data/vYYYY-MM-DD/`.
- Le frontend lit la version active via `apps/web/public/data/current/manifest.json`, puis charge les fichiers depuis `/data/{datasetVersion}/...`.

Fichiers actuellement consommés au runtime (voir `apps/web/lib/data/*`):
- `communes/indexLite.json`
- `communes/postalIndex.json`
- `communes/metrics/core.json`
- `communes/metrics/housing.json`
- `infraZones/indexLite.json`

## Config (runtime)

Configuration statique servie par Next.js :
- `apps/web/public/config/map-tiles.json` : sources tuilées + couche de labels interactive
- `apps/web/public/config/app-debug.json` : options debug (dev-friendly)

## Documentation

- `AGENTS.md` : règles techniques (source de vérité)
- `docs/INDEX.md` : table des matières complète avec statuts
- `docs/architecture/overview.md` : architecture actuelle (basée sur le code)
- `docs/architecture/data-pipeline.md` : génération des datasets statiques
- `CONTRIBUTING.md` : guide de contribution

