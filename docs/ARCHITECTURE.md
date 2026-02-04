# Architecture du projet Choisir sa Ville

**Dernière mise à jour** : Février 2026  
**Type d'architecture** : Jamstack (Static Site Generation)

---

## Vue d'ensemble

Choisir sa Ville est une application web permettant de comparer et sélectionner des zones géographiques en France selon des critères objectifs (population, loyers, accessibilité, etc.).

Le projet utilise une **architecture statique complète** :
- Génération de données au **build time** depuis des sources ouvertes
- Serveur de fichiers statiques au **runtime** (Next.js)
- Cache côté client (IndexedDB)
- Aucun backend API, aucune base de données

---

## Diagramme d'architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          BUILD TIME                                         │
│                      (packages/importer)                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐               │
│  │   Sources    │     │   Sources    │     │   Sources    │               │
│  │    INSEE     │     │  La Poste    │     │  Open Data   │               │
│  │  (communes)  │     │  (postaux)   │     │   (autres)   │               │
│  └──────┬───────┘     └──────┬───────┘     └──────┬───────┘               │
│         │                    │                    │                        │
│         └────────────────────┼────────────────────┘                        │
│                              ▼                                             │
│                  ┌───────────────────────┐                                 │
│                  │  Pipeline Node.js     │                                 │
│                  │  - Download (cache)   │                                 │
│                  │  - Parse CSV          │                                 │
│                  │  - Normalize          │                                 │
│                  │  - Aggregate          │                                 │
│                  │  - Generate JSON      │                                 │
│                  └───────────┬───────────┘                                 │
│                              │                                             │
│                              ▼                                             │
│              ┌───────────────────────────────────┐                         │
│              │  apps/web/public/data/{version}/  │                         │
│              │  ├── manifest.json                │                         │
│              │  ├── communes/indexLite.json      │                         │
│              │  ├── communes/{dept}/{code}.json  │                         │
│              │  ├── infra-zones/...              │                         │
│              │  └── ...                          │                         │
│              └───────────────────────────────────┘                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                  │
                                  │  Next.js build includes static files
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          RUNTIME                                            │
│                       (apps/web - Next.js)                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────────────────────────────────────────┐             │
│  │                  Browser (Client)                         │             │
│  │                                                           │             │
│  │  ┌─────────────────────────────────────────────────────┐  │             │
│  │  │            UI Layer (React)                         │  │             │
│  │  │  ┌──────────────┐         ┌──────────────┐         │  │             │
│  │  │  │  VectorMap   │         │ RightPanel   │         │  │             │
│  │  │  │  Component   │         │  Component   │         │  │             │
│  │  │  └──────┬───────┘         └──────┬───────┘         │  │             │
│  │  │         │                        │                 │  │             │
│  │  │         └────────────┬───────────┘                 │  │             │
│  │  │                      │                             │  │             │
│  │  └──────────────────────┼─────────────────────────────┘  │             │
│  │                         │                                │             │
│  │  ┌──────────────────────┼─────────────────────────────┐  │             │
│  │  │         Service Layer (Headless)                   │  │             │
│  │  │                      │                             │  │             │
│  │  │         ┌────────────▼────────────┐                │  │             │
│  │  │         │  SelectionService       │                │  │             │
│  │  │         │  - highlighted: Ref     │                │  │             │
│  │  │         │  - active: Ref          │                │  │             │
│  │  │         │  - listeners            │                │  │             │
│  │  │         └─────────────────────────┘                │  │             │
│  │  │                                                    │  │             │
│  │  └────────────────────────────────────────────────────┘  │             │
│  │                         │                                │             │
│  │  ┌──────────────────────┼─────────────────────────────┐  │             │
│  │  │         Data Layer                                 │  │             │
│  │  │                      │                             │  │             │
│  │  │  ┌───────────────────▼──────────────────────┐      │  │             │
│  │  │  │  EntityDataProvider (interface)          │      │  │             │
│  │  │  │  - getCommune(code)                      │      │  │             │
│  │  │  │  - getInfraZone(id)                      │      │  │             │
│  │  │  └───────────────────┬──────────────────────┘      │  │             │
│  │  │                      │                             │  │             │
│  │  │  ┌───────────────────▼──────────────────────┐      │  │             │
│  │  │  │  CachedEntityDataProvider (decorator)    │      │  │             │
│  │  │  │  ┌────────────────────────────┐          │      │  │             │
│  │  │  │  │   IndexedDB Cache          │          │      │  │             │
│  │  │  │  │   TTL: 7 days              │          │      │  │             │
│  │  │  │  │   Version-aware            │          │      │  │             │
│  │  │  │  └────────────────────────────┘          │      │  │             │
│  │  │  └───────────────────┬──────────────────────┘      │  │             │
│  │  │                      │                             │  │             │
│  │  │  ┌───────────────────▼──────────────────────┐      │  │             │
│  │  │  │  StaticFilesEntityDataProvider           │      │  │             │
│  │  │  │  - fetch(/data/{version}/...)            │      │  │             │
│  │  │  └───────────────────┬──────────────────────┘      │  │             │
│  │  │                      │                             │  │             │
│  │  └──────────────────────┼─────────────────────────────┘  │             │
│  │                         │                                │             │
│  │                         ▼                                │             │
│  │              ┌──────────────────────┐                    │             │
│  │              │  HTTP GET requests   │                    │             │
│  │              └──────────┬───────────┘                    │             │
│  └─────────────────────────┼────────────────────────────────┘             │
│                            │                                              │
│                            ▼                                              │
│                 ┌──────────────────────┐                                  │
│                 │   Next.js Server     │                                  │
│                 │   (Static files)     │                                  │
│                 │   /data/{version}/   │                                  │
│                 └──────────────────────┘                                  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Flux de données

### 1. Build Time (Génération des données)

```bash
$ pnpm --filter @choisir-sa-ville/importer export:static
```

**Étapes** :
1. **Download** : Télécharge les sources depuis INSEE, La Poste, etc.
   - Cache local dans `packages/importer/.cache/`
   - Hash MD5 pour éviter re-téléchargement
2. **Parse** : Parse les CSV avec `csv-parse`
3. **Normalize** : Normalise les codes INSEE, noms, coordonnées
4. **Aggregate** : Calcule les coordonnées moyennes, populations, etc.
5. **Generate** : Écrit les JSON optimisés dans `apps/web/public/data/{version}/`
6. **Manifest** : Crée `manifest.json` avec métadonnées et checksums

**Sortie** :
```
apps/web/public/data/v2026-02-04/
├── manifest.json
├── communes/
│   ├── indexLite.json         (Toutes les communes, colonnes compressées)
│   ├── 01/                    (Département 01)
│   │   ├── 01001.json
│   │   └── ...
│   ├── 75/
│   │   ├── 75056.json         (Paris)
│   │   └── ...
│   └── ...
├── infra-zones/
│   └── ...
└── ...
```

### 2. Runtime (Consommation des données)

**Premier chargement** :
1. User ouvre l'application
2. Next.js sert la page HTML + JS bundle
3. MapLibre initialise la carte
4. `loadCommunesIndexLite()` charge `/data/current/manifest.json`
5. Puis charge `/data/{version}/communes/indexLite.json`
6. Index stocké en mémoire (Map<inseeCode, CommuneIndexLiteEntry>)

**Interaction utilisateur** (ex: clic sur Paris) :
1. MapLibre détecte clic sur label "Paris"
2. Map adapter résout : nom "Paris" → inseeCode "75056"
3. `SelectionService.setActive({ kind: "commune", inseeCode: "75056" })`
4. RightPanel écoute via `useSelection()` → détecte changement
5. RightPanel appelle `useCommune("75056")`
6. `EntityDataProvider.getCommune("75056")` :
   - Check IndexedDB cache → MISS
   - Fetch `/data/{version}/communes/75/75056.json`
   - Parse JSON
   - Store dans IndexedDB (TTL 7j)
   - Return data
7. RightPanel affiche les détails

**Visite ultérieure** (même utilisateur, <7 jours) :
- Étapes 1-5 identiques
- Étape 6 : IndexedDB cache → **HIT** → retour immédiat
- Pas de requête réseau

---

## Packages et responsabilités

### packages/importer

**Rôle** : Pipeline de génération de données statiques

**Dépendances** :
- `csv-parse` : Parser CSV
- `unzipper` : Décompresser archives
- Node.js standard libs (fs, path, crypto)

**Structure** :
```
packages/importer/src/
├── exports/
│   ├── exportDataset.ts          (Entry point principal)
│   ├── communes/
│   │   ├── exportIndexLite.ts
│   │   ├── exportMetricsCore.ts
│   │   └── ...
│   ├── infra-zones/
│   │   └── exportIndexLite.ts
│   ├── shared/
│   │   ├── downloadFile.ts
│   │   ├── parseCsv.ts
│   │   └── types.ts
│   └── constants.ts               (URLs des sources)
└── ...
```

**Commandes** :
- `pnpm --filter @choisir-sa-ville/importer export:static` : Génère toutes les données

**Règles** :
- ❌ Jamais appelé au runtime
- ✅ Idempotent (peut être rejoué)
- ✅ Cache local (`.cache/`)
- ✅ Versioning automatique (`v{YYYY}-{MM}-{DD}`)

### apps/web

**Rôle** : Application frontend Next.js

**Dépendances principales** :
- `next` : Framework React
- `react`, `react-dom`
- `maplibre-gl` : Cartographie
- `tailwindcss` : Styling
- `shadcn-ui` : Composants UI
- `class-variance-authority`, `clsx`, `tailwind-merge` : Utilitaires CSS

**Structure** :
```
apps/web/
├── app/                           # Next.js App Router
│   ├── layout.tsx
│   ├── page.tsx                   # Page principale (map + panel)
│   └── globals.css
│
├── components/                    # Composants React
│   ├── ui/                        # shadcn/ui
│   │   ├── button.tsx
│   │   └── card.tsx
│   ├── vector-map.tsx             # Composant carte
│   ├── right-panel.tsx            # Panneau de détails
│   ├── header.tsx
│   └── footer.tsx
│
├── lib/                           # Logique métier
│   ├── selection/                 # Service de sélection (headless)
│   │   ├── selectionService.ts
│   │   ├── hooks.ts               # useSelection()
│   │   └── types.ts
│   ├── data/                      # Accès données
│   │   ├── entityDataProvider.ts  # Interface
│   │   ├── staticFilesEntityDataProvider.ts
│   │   ├── cache/
│   │   │   ├── cachedEntityDataProvider.ts
│   │   │   └── indexedDbCache.ts
│   │   ├── communesIndexLite.ts   # Index en mémoire
│   │   ├── infraZonesIndexLite.ts
│   │   ├── hooks.ts               # useEntity(), useCommune()
│   │   └── index.ts
│   ├── map/                       # Adaptateur MapLibre
│   │   ├── mapInteractionService.ts
│   │   ├── layers/
│   │   │   ├── managedCityLabels.ts
│   │   │   ├── highlightState.ts
│   │   │   └── ...
│   │   └── style/
│   │       └── stylePipeline.ts
│   ├── config/
│   │   └── appConfig.ts
│   └── utils.ts
│
└── public/
    └── data/                      # Données statiques générées
        ├── current → v2026-02-04  (symlink)
        └── v2026-02-04/
            ├── manifest.json
            └── ...
```

**Règles** :
- ✅ Next.js 15+ avec App Router
- ✅ Tailwind + shadcn/ui uniquement
- ✅ Séparation stricte : selection / data / map / ui
- ❌ Aucune logique métier dans les composants
- ❌ Aucun appel backend API

---

## Patterns d'architecture

### 1. Service de sélection (Headless)

**Principe** : État de sélection complètement découplé de l'UI et de la carte.

```typescript
// lib/selection/selectionService.ts

interface SelectionService {
  getState(): SelectionState;
  setHighlighted(entity: EntityRef | null): void;
  setActive(entity: EntityRef | null): void;
  clearAll(): void;
  subscribe(listener: SelectionListener): () => void;
}

// Aucune dépendance React, MapLibre, ou autre lib UI
```

**Usage** :
```typescript
// Map adapter (écoute clics, produit événements)
import { getSelectionService } from '@/lib/selection';

function handleMapClick(inseeCode: string) {
  getSelectionService().setActive({ kind: 'commune', inseeCode });
}

// UI component (écoute sélection, affiche détails)
import { useSelection } from '@/lib/selection/hooks';

function RightPanel() {
  const { active } = useSelection();
  // Render détails de 'active'
}
```

**Avantages** :
- ✅ Testable sans UI
- ✅ Réutilisable (URL state, search, etc.)
- ✅ Un seul source of truth

### 2. Provider Pattern (Données)

**Principe** : Interface abstraite + implémentations interchangeables.

```typescript
// Interface
interface EntityDataProvider {
  getCommune(code: string): Promise<CommuneData | null>;
  getInfraZone(id: string): Promise<InfraZoneData | null>;
}

// Implémentation concrète
class StaticFilesEntityDataProvider implements EntityDataProvider {
  async getCommune(code: string) {
    const url = `/data/${version}/communes/${dept}/${code}.json`;
    return fetch(url).then(r => r.json());
  }
}

// Décorateur cache
class CachedEntityDataProvider implements EntityDataProvider {
  constructor(private provider: EntityDataProvider) {}
  
  async getCommune(code: string) {
    const cached = await indexedDB.get(code);
    if (cached) return cached;
    
    const data = await this.provider.getCommune(code);
    await indexedDB.set(code, data, ttl);
    return data;
  }
}
```

**Composition** :
```typescript
const provider = new CachedEntityDataProvider(
  new StaticFilesEntityDataProvider()
);
```

**Avantages** :
- ✅ Swap implémentation facilement (tests, mocks)
- ✅ Cache transparent
- ✅ Extensible (API future, local storage, etc.)

### 3. Spatial Resolution (Carte)

**Problème** : MapLibre renvoie des IDs de features, pas des EntityRef.

**Solution** : Pipeline de résolution en plusieurs étapes.

```typescript
// 1. Label click → récupère properties
const features = map.queryRenderedFeatures(point, {
  layers: ['managed-city-labels']
});
const { name, class: labelClass } = features[0].properties;

// 2. Résolution par nom normalisé + classe
const normalized = normalizeName(name);
const candidates = labelClass === 'city'
  ? await findCommunesByNormalizedName(normalized)
  : await findInfraZonesByNormalizedName(normalized);

// 3. Si ambiguïté, résolution par distance
if (candidates.length > 1) {
  const nearest = findNearestByDistance(candidates, clickPoint);
  return toEntityRef(nearest);
}

// 4. Si toujours ambiguïté, résolution spatiale (polygones)
const resolved = await spatialIndexQuery(clickPoint);
return toEntityRef(resolved);
```

**Avantages** :
- ✅ Labels comme source primaire (UX)
- ✅ Polygones uniquement pour désambiguïsation
- ✅ Robuste même si données incomplètes

---

## Décisions d'architecture

### Pourquoi statique (Jamstack) ?

**Avantages** :
- ✅ **Performance** : Données servies par CDN, cache navigateur
- ✅ **Simplicité** : Pas de backend à maintenir
- ✅ **Coût** : Hosting statique très bon marché
- ✅ **Scalabilité** : CDN scale infiniment
- ✅ **Offline-first** : IndexedDB permet usage offline

**Inconvénients** :
- ❌ Pas de personnalisation temps réel
- ❌ Mise à jour des données = re-build + re-deploy

**Décision** : OK pour un MVP avec données publiques qui changent peu.

### Pourquoi Next.js (et pas Vite/Astro) ?

- ✅ App Router moderne
- ✅ Optimisations image/font builtin
- ✅ Écosystème React mature
- ✅ Transition facile vers API routes si besoin futur

### Pourquoi IndexedDB (et pas localStorage) ?

- ✅ Stockage illimité (vs 5-10MB localStorage)
- ✅ Async (pas de freeze UI)
- ✅ Structured data (JSON natif)
- ✅ TTL gérable

### Pourquoi MapLibre (et pas Leaflet) ?

- ✅ Vector tiles (vs raster)
- ✅ Performance supérieure
- ✅ Styling avancé (MapLibre GL Style Spec)
- ✅ Moderne, WebGL, bien maintenu

---

## Évolution future

### Court terme (MVP)

- ✅ Carte interactive avec sélection
- ✅ Détails communes (population, département, région)
- ✅ Cache IndexedDB
- 🔜 Recherche par nom
- 🔜 Filtres basiques

### Moyen terme

- 🔜 Métriques (loyers, sécurité, QoL)
- 🔜 Comparaison multi-zones
- 🔜 Export / partage
- 🔜 URL state (deep linking)

### Long terme (si besoin)

- ❓ API backend pour personnalisation
- ❓ Authentification utilisateurs
- ❓ Données temps réel
- ❓ Contributions communautaires

---

## Références

- **Next.js** : https://nextjs.org/docs
- **MapLibre GL JS** : https://maplibre.org/maplibre-gl-js/docs/
- **Tailwind CSS** : https://tailwindcss.com/docs
- **shadcn/ui** : https://ui.shadcn.com/
- **IndexedDB API** : https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API

---

**Document maintenu par l'équipe. Toute modification majeure doit être validée.**
