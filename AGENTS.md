# AGENTS – Règles techniques du projet

Ce document définit les règles **NON NÉGOCIABLES** pour le développement du projet.

**Dernière mise à jour** : 4 février 2026  
**Architecture** : Jamstack (données statiques + Next.js)

---

## 1) Architecture générale

### Principe fondamental

Le projet utilise une **architecture statique** :
- **Build time** : génération de datasets JSON depuis des sources ouvertes (INSEE, etc.)
- **Runtime** : Next.js sert des fichiers statiques (données + config)
- **Aucun backend API** applicatif, **aucune base de données** au runtime

### Monorepo

```
choisir-sa-ville/
├── packages/
│   └── importer/           # Pipeline de génération (batch, build-time)
├── apps/
│   └── web/                # Next.js (frontend)
│       └── public/
│           ├── config/     # Config runtime (JSON)
│           └── data/       # Datasets statiques versionnés
├── docs/
└── specs/
```

### Séparation des responsabilités (apps/web)

**lib/selection/** (source de vérité de l’état)
- TypeScript pur, sans dépendance React/MapLibre
- Émet des événements (`highlight`, `active`) via subscribe
- Type central : `EntityRef` (`commune` | `infraZone`)

**lib/data/** (lecture des datasets statiques)
- Accès runtime basé sur `/data/current/manifest.json` → `datasetVersion`
- Modules principaux : `communesIndexLite.ts`, `infraZonesIndexLite.ts`
- La couche “EntityDataProvider” existe pour des évolutions (détails par entité), mais le flux actuel UI s’appuie sur les index lites

**lib/map/** (adaptateur carte)
- Charge le style via `stylePipeline.ts` (sanitize + injection polygones + styling labels)
- Gère interactions via `mapInteractionService.ts`
- Met à jour `SelectionService` (pas de logique UI)

**components/** (UI)
- Aucune logique métier lourde
- Consomme `SelectionService` (hooks) et `lib/data/*` pour charger les infos à afficher

---

## 2) Frontend (NON NÉGOCIABLE)

### Stack obligatoire

- Next.js (App Router)
- Tailwind CSS
- shadcn/ui (components dans `apps/web/components/ui/`)
- MapLibre GL JS

Interdits : autre framework UI, autre framework CSS, état global React “gratuit”.

### Carte MapLibre – règles

**Init / cleanup**
- Initialisation une seule fois au montage
- Cleanup complet à l’unmount : `map.remove()`

**Événements de viewport**
- Pour tout traitement déclenché par un changement de viewport : **`moveend` + `zoomend` uniquement**
- **Jamais** `move` pour du traitement continu (spam)

**Pointer events**
- Autorisés (ex: `mousemove`, `click`) pour l’interaction label-first

**Interactions (label-first)**
- Chaque interaction commence par `queryRenderedFeatures(point, { layers: [labelLayerId] })`
- Résolution d’entité : nom normalisé → candidates (index lite) → nearest par distance

**Feature-state**
- Vocabulaire strict (labels) : `hasData`, `highlight`, `active`
- Le style applique la priorité : `active > highlight > hasData > default`

---

## 3) Données (décisions produit)

Hiérarchie :

Pays → Région → Département → Commune (pivot) → Zone infra (optionnelle)

Règle : une zone infra n’existe jamais sans commune parente (ARM/COMD/COMA).

Voir `docs/LOCALITY_MODEL.md`.

---

## 4) Pipeline de données (packages/importer)

- Batch Node.js, jamais appelé au runtime
- Produit un dataset versionné `vYYYY-MM-DD`
- Met à jour le pointeur runtime : `apps/web/public/data/current/manifest.json`

Commande :
```bash
pnpm --filter @choisir-sa-ville/importer export:static
```

---

## 5) Conventions

- TypeScript strict (pas de `any` sans justification)
- camelCase partout dans le code
- Données : les fichiers “indexLite” sont optimisés (colonnes courtes comme `insee`, `lng`), c’est une exception assumée

---

## 6) Qualité

- `pnpm typecheck` doit passer
- `pnpm lint:eslint` doit passer (0 warning)
- Tests : requis pour la logique critique lorsque présents (selection, indexes, importer)

