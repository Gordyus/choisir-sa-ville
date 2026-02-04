# Pipeline de génération de données

**Package** : `packages/importer`  
**Type** : Script Node.js batch (jamais appelé au runtime)

---

## Vue d'ensemble

Le pipeline télécharge des données publiques depuis différentes sources (INSEE, La Poste, etc.), les parse, normalise, agrège et génère des fichiers JSON optimisés pour l'application frontend.

---

## Commande principale

```bash
pnpm --filter @choisir-sa-ville/importer export:static
```

**Sortie** :
```
apps/web/public/data/v2026-02-04/
├── manifest.json
├── communes/
│   ├── indexLite.json
│   └── {dept}/
│       └── {inseeCode}.json
├── infra-zones/
│   ├── indexLite.json
│   └── {dept}/
│       └── {id}.json
└── ...
```

---

## Sources de données

### 1. INSEE - Communes

**URL** : `https://www.insee.fr/...` (voir `constants.ts`)  
**Format** : CSV  
**Contenu** : Liste officielle des communes françaises

**Colonnes utilisées** :
- `TYPECOM` : Type (COM, ARM, COMD, COMA)
- `COM` : Code INSEE
- `LIBELLE` : Nom officiel
- `DEP` : Code département
- `REG` : Code région
- `COMPARENT` : Code commune parente (pour ARM/COMD/COMA)

### 2. INSEE - Départements

**Format** : CSV  
**Contenu** : Liste des départements + rattachement régional

### 3. INSEE - Régions

**Format** : CSV  
**Contenu** : Liste des régions

### 4. La Poste - Codes postaux

**Format** : CSV  
**Contenu** : Correspondance INSEE ↔ Code postal + coordonnées GPS

**Colonnes utilisées** :
- `Code_commune_INSEE`
- `Code_postal`
- `Latitude`
- `Longitude`

### 5. INSEE - Populations

**URL** : Archive ZIP contenant `donnees_communes.csv`  
**Format** : CSV dans ZIP  
**Contenu** : Populations municipales officielles

**Colonnes utilisées** :
- `COM` : Code INSEE
- `PMUN` : Population municipale

---

## Pipeline détaillé

### Étape 1 : Download

**Fonction** : `downloadFile(url)`

**Comportement** :
1. Calcule hash MD5 de l'URL
2. Vérifie si fichier existe dans `.cache/{hash}-{filename}`
3. Si cache HIT → retourne chemin local
4. Si cache MISS → télécharge, sauvegarde dans cache, retourne chemin

**Avantages** :
- Idempotence : re-run ne re-télécharge pas
- Performance : cache local
- Offline-capable après premier run

### Étape 2 : Parse

**Fonction** : `parseCsv(text)` et `parseCsvFile(path)`

**Bibliothèque** : `csv-parse`

**Comportement** :
1. Parse CSV avec détection auto du séparateur
2. Retourne tableau d'objets `{ [colonne]: valeur }`

**Gestion erreurs** :
- Lignes malformées → warning + skip
- Fichier vide → erreur

### Étape 3 : Normalize

**Fonctions** :
- `normalizeInseeCode(value)` : Nettoie et pad à 5 chiffres
- `normalizeCode(value)` : Uppercase + trim
- `normalizeName(value)` : Normalisation pour recherche

**Exemples** :
```typescript
normalizeInseeCode("123")    → "00123"
normalizeInseeCode("75056")  → "75056"
normalizeCode("  01  ")      → "01"
normalizeName("Saint-Étienne") → "saintetienne"
```

### Étape 4 : Map & Filter

**Communes** :
```typescript
function mapCommunes(records, deptRegionMap) {
  const communes = [];
  for (const record of records) {
    if (record.TYPECOM !== "COM") continue; // Ignore ARM/COMD/COMA
    
    const commune = {
      insee: normalizeInseeCode(record.COM),
      name: record.LIBELLE,
      departmentCode: record.DEP,
      regionCode: deptRegionMap.get(record.DEP) || record.REG
    };
    communes.push(commune);
  }
  return communes;
}
```

**Infra-zones** :
```typescript
function mapInfraZones(records) {
  const infraZones = [];
  for (const record of records) {
    if (!["ARM", "COMD", "COMA"].includes(record.TYPECOM)) continue;
    
    const zone = {
      id: `${record.TYPECOM}:${record.COM}`,
      type: record.TYPECOM,
      code: normalizeInseeCode(record.COM),
      parentCommuneCode: normalizeInseeCode(record.COMPARENT),
      name: record.LIBELLE
    };
    infraZones.push(zone);
  }
  return infraZones;
}
```

### Étape 5 : Aggregate

**Coordonnées** :

Problème : Sources géographiques (codes postaux) ont plusieurs lignes par commune.

Solution :
```typescript
function aggregateCoordinates(postalRecords) {
  const map = new Map(); // insee → { latSum, lngSum, count }
  
  for (const record of postalRecords) {
    const { insee, lat, lng } = record;
    if (!lat || !lng) continue;
    
    const current = map.get(insee) || { latSum: 0, lngSum: 0, count: 0 };
    current.latSum += lat;
    current.lngSum += lng;
    current.count += 1;
    map.set(insee, current);
  }
  
  // Moyenne
  for (const [insee, stats] of map) {
    map.set(insee, {
      lat: round(stats.latSum / stats.count),
      lng: round(stats.lngSum / stats.count)
    });
  }
  
  return map;
}
```

**Populations** :

Direct mapping INSEE → population.

**Dérivation pour communes sans données** :

Si une commune n'a pas de coordonnées directes, on calcule depuis ses infra-zones :

```typescript
function deriveFromChildren(parentInsee, coords, parentChildrenMap) {
  const children = parentChildrenMap.get(parentInsee);
  if (!children) return null;
  
  let latSum = 0, lngSum = 0, count = 0;
  for (const child of children) {
    const stats = coords.get(child);
    if (!stats) continue;
    latSum += stats.latSum;
    lngSum += stats.lngSum;
    count += stats.count;
  }
  
  return count > 0 ? { lat: latSum / count, lng: lngSum / count } : null;
}
```

### Étape 6 : Export JSON

**Index léger (colonnes compressées)** :

Au lieu de :
```json
[
  { "insee": "75056", "name": "Paris", "lat": 48.856, "lng": 2.352, ... },
  { "insee": "13055", "name": "Marseille", "lat": 43.296, "lng": 5.369, ... }
]
```

On exporte :
```json
{
  "columns": ["insee", "name", "departmentCode", "regionCode", "lat", "lng", "population"],
  "rows": [
    ["75056", "Paris", "75", "11", 48.856, 2.352, 2165423],
    ["13055", "Marseille", "13", "93", 43.296, 5.369, 869815]
  ]
}
```

**Avantages** :
- ✅ Taille réduite (~40% vs JSON classique)
- ✅ Parse rapide
- ✅ Type-safe côté frontend (colonnes connues)

**Fichiers individuels** :

Pour les détails (métriques, etc.), un fichier JSON par entité :
```json
// apps/web/public/data/v2026-02-04/communes/75/75056.json
{
  "inseeCode": "75056",
  "name": "Paris",
  "departmentCode": "75",
  "regionCode": "11",
  "lat": 48.8566,
  "lng": 2.3522,
  "population": 2165423,
  "postalCodes": ["75001", "75002", ..., "75020"],
  "metrics": {
    "housing": { ... },
    "safety": { ... }
  }
}
```

### Étape 7 : Manifest

**Fichier** : `manifest.json`

**Contenu** :
```json
{
  "datasetVersion": "v2026-02-04",
  "generatedAt": "2026-02-04T10:30:00Z",
  "files": [
    "communes/indexLite.json",
    "communes/01/01001.json",
    ...
  ],
  "sources": [
    {
      "name": "INSEE Communes",
      "url": "https://...",
      "downloadedAt": "2026-02-04T10:00:00Z",
      "hash": "abc123..."
    }
  ]
}
```

**Usage** :
- Versionning
- Cache invalidation
- Audit des sources

---

## Structure du code

```
packages/importer/src/
├── exports/
│   ├── exportDataset.ts              # Entry point principal
│   ├── constants.ts                  # URLs des sources
│   ├── writeManifest.ts              # Génération manifest.json
│   │
│   ├── communes/                     # Exports spécifiques communes
│   │   ├── exportIndexLite.ts        # Index léger
│   │   ├── exportMetricsCore.ts      # Métriques de base
│   │   ├── exportMetricsHousing.ts   # Métriques logement
│   │   └── exportPostalIndex.ts      # Index codes postaux
│   │
│   ├── infra-zones/                  # Exports infra-zones
│   │   └── exportIndexLite.ts
│   │
│   └── shared/                       # Utilitaires
│       ├── downloadFile.ts           # Download avec cache
│       ├── parseCsv.ts               # Parse CSV
│       ├── readZipEntry.ts           # Lire fichier dans ZIP
│       ├── fileSystem.ts             # writeJsonAtomic, ensureDir
│       ├── hash.ts                   # MD5 hash
│       └── types.ts                  # Types partagés
│
└── .cache/                           # Cache des téléchargements
    ├── {hash}-communes.csv
    ├── {hash}-postal.csv
    └── ...
```

---

## Types principaux

```typescript
// exports/shared/types.ts

export type ExportCommune = {
  insee: string;
  name: string;
  departmentCode: string | null;
  regionCode: string | null;
};

export type ExportInfraZone = {
  id: string;                 // "ARM:75101"
  type: "ARM" | "COMD" | "COMA";
  code: string;               // "75101"
  parentCommuneCode: string;  // "75056"
  name: string;
};

export type PostalRecord = {
  insee: string;
  postalCode: string;
  lat: number | null;
  lng: number | null;
};

export type SourceMeta = {
  name: string;
  url: string;
  filePath: string;           // Chemin local dans .cache/
  downloadedAt: string;
  hash: string;
};

export type ExportContext = {
  datasetDir: string;         // apps/web/public/data/v2026-02-04
  datasetVersion: string;     // v2026-02-04
};
```

---

## Gestion d'erreurs

### Données manquantes

**Communes sans coordonnées** :
- Log warning avec INSEE + nom
- Tente dérivation depuis infra-zones
- Si échec, exporte avec `lat: null, lng: null`

**Communes sans population** :
- Log warning
- Exporte avec `population: null`

**Codes postaux orphelins** :
- Skip silencieusement (communes fusionnées, etc.)

### Fichiers corrompus

**CSV malformé** :
- `csv-parse` lève erreur → log + exit 1

**ZIP corrompu** :
- `unzipper` lève erreur → log + exit 1

### Réseau

**Timeout** :
- Retry 3x avec backoff exponentiel
- Si échec final → log + exit 1

---

## Optimisations

### Cache local

- Évite re-téléchargement
- Hash MD5 pour invalidation
- `.gitignore`d (pas commité)

### Colonnes compressées

- ~40% économie de taille
- Parse plus rapide (moins de clés JSON)

### Groupement par département

Au lieu de :
```
communes/
  ├── 01001.json  (35000+ fichiers à la racine)
  ├── 01002.json
  └── ...
```

On groupe :
```
communes/
  ├── 01/
  │   ├── 01001.json
  │   └── 01002.json
  ├── 75/
  │   └── 75056.json
  └── ...
```

**Avantages** :
- ✅ FS plus efficace (moins de fichiers par dossier)
- ✅ URL prévisible : `/data/{version}/communes/{dept}/{code}.json`

### Écriture atomique

```typescript
async function writeJsonAtomic(path, data) {
  const tmpPath = `${path}.tmp`;
  await writeFile(tmpPath, JSON.stringify(data, null, 2));
  await rename(tmpPath, path);  // Atomique sur POSIX
}
```

**Évite** : Fichiers corrompus si crash pendant écriture.

---

## Extension future

### Nouvelles sources

1. Ajouter URL dans `constants.ts`
2. Ajouter download dans `downloadSources()`
3. Créer mapper `mapNewSource(records)`
4. Créer exporter `exportNewMetrics()`
5. Ajouter dans `main()` pipeline

### Nouvelles métriques

Exemple : Ajouter prix médian m²

1. Trouver source (DVF, etc.)
2. Download + parse
3. Mapper : INSEE → prix médian
4. Export dans `communes/{dept}/{code}.json` :
   ```json
   {
     ...,
     "metrics": {
       "housing": {
         "medianPricePerSqm": 8500
       }
     }
   }
   ```

### Incrémental

Actuellement : export complet à chaque run.

Future : détecter changements, ne régénérer que le modifié.

**Complexité** :
- Tracking des dépendances
- Gestion des suppressions
- Tests plus complexes

**Décision** : YAGNI pour l'instant (export complet = 30s).

---

## Checklist avant commit

- [ ] `pnpm --filter @choisir-sa-ville/importer typecheck` passe
- [ ] `pnpm --filter @choisir-sa-ville/importer export:static` génère données
- [ ] Vérifier `apps/web/public/data/{version}/manifest.json`
- [ ] Vérifier quelques fichiers manuellement (Paris, Marseille, etc.)
- [ ] Frontend charge les nouvelles données sans erreur

---

## Références

- **INSEE** : https://www.insee.fr/fr/information/2008354
- **La Poste** : https://datanova.laposte.fr/
- **csv-parse** : https://csv.js.org/parse/
- **unzipper** : https://www.npmjs.com/package/unzipper
