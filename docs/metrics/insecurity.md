# Métrique Insécurité (SSMSI)

**Statut** : Implémenté  
**Dernière révision** : 2026-02-08

**Source** : Bases statistiques communales de la délinquance enregistrée – SSMSI (Ministère de l'Intérieur)  
**Licence** : Licence Ouverte / Etalab  
**Niveau géographique** : Commune (pivot territorial)  
**Granularité temporelle** : Annuelle (années disponibles dans `meta.json`)  
**Méthodologie** : Classification par taille de population conforme aux standards internationaux (ONU-ICVS)

---

## Vue d'ensemble

La métrique "insécurité" agrège les faits de délinquance enregistrés par commune en trois groupes pondérés :
- **Violences aux personnes** (poids 0.4) : violences physiques, sexuelles, vols avec armes
- **Sécurité des biens** (poids 0.35) : cambriolages, vols de véhicules, escroqueries
- **Tranquillité publique** (poids 0.25) : destructions et dégradations volontaires

L'export calcule :
1. **Taux pour 100,000 habitants** pour chaque groupe (standard international)
2. **Score brut** (`scoreRaw`) : moyenne pondérée des taux
3. **Classification par taille de population** : 3 catégories (petites/moyennes/grandes communes)
4. **Double perspective percentile** :
   - `indexGlobalNational` : percentile 0–100 sur toutes les communes (vision nationale)
   - `indexGlobalCategory` : percentile 0–100 dans la catégorie de taille (comparaison légitime)
5. **Niveaux** (0–4) : classification basée sur les percentiles **catégorie** (utilisé pour badge + rendu carto)
6. **Rang dans la catégorie** : classement relatif (ex: "1/42" pour Bordeaux dans les grandes villes)

---

## Classification par Taille de Population

### Rationale

**Problème du percentile national unique** :
- Biais structurel : petites communes monopolisent le niveau 4 en raison de taux mécaniquement élevés
- Comparaisons illégitimes : village 30 habitants comparé à Bordeaux 252k habitants
- Exemple : 1 fait divers = 33.3/1000 (village) vs 0.004/1000 (grande ville)

**Solution : Classification par catégorie de taille** :
- Aligne sur standards internationaux (ONU-ICVS, classements homicides, littérature académique)
- Permet comparaisons légitimes entre communes de tailles similaires
- Reconnaît correctement Bordeaux (1ère ville >100k hab) comme niveau 4

### Catégories de Population

| Catégorie | Seuil | Label | Description | Distribution estimée |
|-----------|-------|-------|-------------|----------------------|
| **small** | 0 – 9,999 | Petites communes | Villages et petites communes rurales | ~30,000 communes (86%) |
| **medium** | 10,000 – 99,999 | Communes moyennes | Villes moyennes | ~4,800 communes (14%) |
| **large** | ≥ 100,000 | Grandes villes | Grandes villes et métropoles | ~42 communes (<1%) |

**Justification des seuils** :
- `10,000 hab` : Transition rural/urbain (définition INSEE)
- `100,000 hab` : Grandes agglomérations (seuil commun international)
- Aligné sur ONU-ICVS et classements académiques

### Standards Internationaux

| Standard | Méthodologie |
|----------|--------------|
| **Numbeo Crime Index** | Classification implicite (villes comparables) |
| **ONU-ICVS** (70+ pays) | Analyse par catégorie urbain/rural/métropole |
| **Classements Homicides** | Seuil minimum 300,000 habitants |
| **Littérature Académique** | Toujours contrôler pour taille population |

**Taux standard** : Pour **100,000 habitants** (pas pour 1,000)

---

## Pipeline de Données (Importer)

### Entrée : Parquet SSMSI

**URL** : `https://www.data.gouv.fr/api/1/datasets/r/98fd2271-4d76-4015-a80c-bcec329f6ad0`  
**Format** : Parquet (4.7M+ lignes, 13 colonnes)  
**Colonnes utilisées** :
- `CODGEO_2025` : code INSEE commune
- `annee` : année
- `nombre` : nombre de faits
- `indicateur` : catégorie d'infraction
- `insee_pop` : population (source unique pour dénominateur)

### Traitement

1. **Lecture en chunks** (100K lignes) via `hyparquet`
2. **Mapping des catégories** : `mapping/ssmsiToGroups.v1.json` définit les indicateurs → groupes
3. **Agrégation** : accumulation des faits par `(année, insee, groupe)`
4. **Calcul des taux** : `ratePer100k = (sumFacts / insee_pop) * 100000`
   - **Population source** : `insee_pop` du Parquet SSMSI uniquement
   - **Pas de fallback** : si `insee_pop` absent → `null`
   - **Unité standard** : Pour 100,000 habitants (conforme aux standards internationaux)
5. **Classification par taille** : Assignation catégorie (small/medium/large) selon population
6. **Score brut** : `scoreRaw = Σ(weight × rate)` où weights sont normalisés
7. **Double calcul percentile** :
   - **National** : percentile rank min-rank (0–100) sur toutes les communes
   - **Catégorie** : percentile rank min-rank (0–100) par catégorie de taille
8. **Niveau** : classification sur `indexGlobalCategory` (percentiles catégorie) :
   - Mapping quintiles : `indexGlobal=null → 0`, `0-19 → 0`, `20-39 → 1`, `40-59 → 2`, `60-79 → 3`, `80-100 → 4`
9. **Rang catégorie** : Tri décroissant par `scoreRaw` dans la catégorie → format `"rank/total"` (ex: "1/42")

### Sortie

**Fichiers** :
- `communes/metrics/insecurity/{year}.json` : données par année (format colonnes + rows)
- `communes/metrics/insecurity/meta.json` : métadonnées, seuils, labels

**Structure JSON** (exemple) :
```json
{
  "year": 2024,
  "unit": "faits pour 100,000 habitants",
  "source": "Ministère de l'Intérieur – SSMSI",
  "generatedAtUtc": "2026-02-08T12:00:00.000Z",
  "columns": [
    "insee",
    "population",
    "populationCategory",
    "violencesPersonnesPer100k",
    "securiteBiensPer100k",
    "tranquillitePer100k",
    "indexGlobalNational",
    "indexGlobalCategory",
    "levelNational",
    "levelCategory",
    "rankInCategory",
    "dataCompleteness"
  ],
  "rows": [
    ["01001", 860, "small", 0, null, null, 0, 0, 0, 0, null, 0.67],
    ["33063", 252305, "large", 1630, 2815, 980, 99, 99, 3, 4, "1/42", 1.0],
    ["75056", 2190327, "large", 1510, 2630, 980, 85, 85, 4, 3, "3/42", 1.0]
  ]
}
```

**Meta.json** (extrait) :
```json
{
  "yearsAvailable": [2016, 2017, ..., 2024],
  "population": {
    "source": "SSMSI Parquet (insee_pop column)",
    "fallbackStrategy": "none"
  },
  "populationCategories": {
    "small": {
      "min": 0,
      "max": 9999,
      "label": "Petites communes",
      "count": 30145
    },
    "medium": {
      "min": 10000,
      "max": 99999,
      "label": "Communes moyennes",
      "count": 4688
    },
    "large": {
      "min": 100000,
      "max": null,
      "label": "Grandes villes",
      "count": 42
    }
  },
  "levels": {
    "labels": ["Très faible", "Faible", "Modéré", "Élevé", "Plus élevé"],
    "method": "Percentile-based classification on indexGlobalCategory (0-24/25-49/50-74/75-99/100)"
  },
  "dataCompleteness": {
    "description": "Proportion of categories with data for each commune",
    "range": [0, 1],
    "threshold_warning": 0.67
  }
}
```

---

## Consommation Frontend

### Couche Data (`lib/data/insecurityMetrics.ts`)

**Hook principal** : `useInsecurityMetrics(inseeCode, year)`

Retourne :
```typescript
{
  data: {
    insee: string;
    population: number | null;
    populationCategory: "small" | "medium" | "large" | null;
    violencesPersonnesPer100k: number | null;
    securiteBiensPer100k: number | null;
    tranquillitePer100k: number | null;
    indexGlobalNational: number | null;
    indexGlobalCategory: number | null;
    levelNational: number;
    levelCategory: number;
    rankInCategory: string | null;
    dataCompleteness: number;
  } | null;
  loading: boolean;
  error: Error | null;
}
```

**Chargement** :
- Fetch via `/data/{version}/communes/metrics/insecurity/{year}.json`
- Parsing colonnes → rows en Map `insee → metrics`
- Cache in-memory (un Map par année)

**Perspective affichée** : Le hook retourne les deux perspectives (national + catégorie), permettant au composant badge d'afficher la perspective catégorie par défaut avec tooltip détaillé.

---

### Rendu Carte (`lib/map/state/displayBinder.ts`)

**Problème résolu** : L'ancienne approche utilisait une expression `match` géante (~35k communes) → freeze au toggle + stutter pan/zoom.

**Solution** : **Feature-state viewport-only**

**Mécanique** :
1. Au toggle "insécurité" :
   - Charger les données via `loadInsecurityYear()`
   - Construire Map `insee → levelCategory` (perspective catégorie utilisée pour rendu)
   - Appliquer expression compacte sur `fill-color` :
     ```typescript
     ["case",
       ["boolean", ["feature-state", "active"]], ACTIVE_COLOR,
       ["boolean", ["feature-state", "highlight"]], HIGHLIGHT_COLOR,
       ["match", ["feature-state", "insecurityLevelCode"],
         0, "#22c55e",  // Très faible
         1, "#84cc16",  // Faible
         2, "#eab308",  // Modéré
         3, "#f97316",  // Élevé
         4, "#ef4444",  // Plus élevé
         DEFAULT_COLOR
       ]
     ]
     ```

2. Sur `moveend` + `zoomend` (règles MapLibre projet) :
   - Query features visibles : `queryRenderedFeatures({ layers: ['communesFill'] })`
   - Lookup `levelCategory` par insee
   - Apply feature-state avec **batching RAF** (200 features/frame)
   - Cache états appliqués (évite writes redondants)

3. Cleanup au toggle off :
   - Retirer handlers `moveend`/`zoomend`
   - Clear feature-states
   - Abort controller annule requêtes en vol

**Optimisation mobile** :
- Détection : `matchMedia("(pointer: coarse)")`
- `fill-opacity = 0.75` (mobile) vs `0.25` (desktop)
- Réduit coût GPU blending sur petits devices

**Note classification** : Le rendu carte utilise `levelCategory` (niveau dans la catégorie de taille), permettant une visualisation cohérente où les grandes villes comme Bordeaux sont correctement représentées en rouge (niveau 4).

---

### Badge Component (`components/insecurity-badge.tsx`)

Consomme `levelCategory` et `rankInCategory` pour l'affichage principal :
```typescript
const { data } = useInsecurityMetrics(inseeCode, year);
if (!data || data.levelCategory === null) return null;

const label = LEVEL_LABELS[data.levelCategory];
const color = INSECURITY_COLORS[data.levelCategory];
const categoryLabel = POPULATION_CATEGORIES[data.populationCategory ?? "small"].label;
```

**Affichage** :
- **Badge principal** : Niveau dans la catégorie (ex: "Niveau 4")
- **Sous-texte** : Rang dans la catégorie (ex: "1/42 grandes villes")
- **Tooltip** : Perspectives détaillées (national + catégorie, percentiles)

Pas de calcul runtime, juste lookup palette.

---

## Niveaux d'Insécurité

**Classification basée sur `indexGlobalCategory`** (percentile dans la catégorie de taille) :

| Level | Label | Couleur | Condition |
|-------|-------|---------|-----------|
| 0 | Très faible | `#22c55e` (vert) | `indexGlobalCategory = null` ou `[0-20)` |
| 1 | Faible | `#84cc16` (lime) | `indexGlobalCategory [20-40)` |
| 2 | Modéré | `#eab308` (jaune) | `indexGlobalCategory [40-60)` |
| 3 | Élevé | `#f97316` (orange) | `indexGlobalCategory [60-80)` |
| 4 | Plus élevé | `#ef4444` (rouge) | `indexGlobalCategory [80-100]` |

**Méthodologie**: Quintiles standards (5 catégories équilibrées de 20 points chacune), conforme aux standards internationaux (Numbeo Crime Index, méthodologies académiques ICVS).

**Rationale** : Les niveaux sont calculés sur les percentiles **catégorie** (pas national), garantissant :
- Comparaisons légitimes entre communes de tailles similaires
- Distribution équitable des niveaux au sein de chaque catégorie
- Reconnaissance correcte des grandes villes à forte criminalité (ex: Bordeaux niveau 4)

**Perspective nationale** (`indexGlobalNational`) : Disponible dans le tooltip pour contexte mais non utilisée pour le niveau affiché.

---

## Décisions Architecturales

### Pourquoi classification par taille de population (Phase 5) ?

- **Problème biais national** : Percentile unique sur 34,875 communes → petites communes monopolisent niveau 4
- **Standards internationaux** : ONU-ICVS, classements homicides, tous utilisent catégories de taille
- **Comparaisons légitimes** : Village 30 hab vs Bordeaux 252k = comparaison illégitime sans correction
- **Résultat** : Bordeaux (1ère ville >100k) correctement reconnue niveau 4, comparée à ses pairs (Paris, Lyon, Marseille)

### Pourquoi taux pour 100,000 habitants (pas 1,000) ?

- **Standard international universel** : ONU-ICVS, classements homicides, Numbeo
- **Cohérence méthodologique** : Aligne avec littérature académique
- **Lisibilité** : Évite décimales multiples (1630 vs 16.3)
- **Migration** : Simple multiplication ×100 des anciennes valeurs

### Pourquoi double perspective (national + catégorie) ?

- **Perspective principale** : Catégorie (affichage badge, rendu carte)
- **Contexte national** : Disponible dans tooltip pour information
- **Use case** : "Bordeaux niveau 4 dans grandes villes, mais percentile 99 national (pas 100)"
- **Transparence** : Permet à l'utilisateur de comprendre les deux visions

### Pourquoi `insee_pop` du Parquet (Task 2) ?

- **Bug 75056** : Paris absent du ZIP INSEE → population null
- **Single source** : cohérence faits + population (même fichier)
- **Couverture** : 99.98% des données ont `insee_pop` (inspection validée)
- **Découplage** : pas de corrélation entre agrégats

### Pourquoi bake `levelCategory` au build-time ?

- **Performance** : Évite calcul runtime + expression match géante (~35k communes) côté client
- **Déterminisme** : Un export = un level fixe (audit trail)
- **Cohérence** : Seuils percentiles versionnés dans meta.json
- **Simplicité** : Frontend consomme directement sans logique métier

### Pourquoi feature-state viewport-only (Task Performance) ?

- **Problème** : Expression géante → freeze toggle + stutter pan/zoom
- **Solution** : Expression compacte (5 entrées) + updates viewport-only
- **Perf** : Coût proportionnel aux features visibles (≈100–500 au lieu de 35k)
- **Mobile** : Batching RAF + opacity adaptive → fluide sur touch devices

---

## Arrondissements (Scope Futur)

**Actuellement** : Export **commune-only**, arrondissements (ARM) agrégés dans commune parente.

**Task future** : `docs/feature/tasks/ssmsi-insecurity-arrondissements-future.md`
- Étudier export `infra-zones/metrics/insecurity/` pour ARM/COMD/COMA
- Coloration granulaire (commune ≠ arrondissement si scores différents)
- Décision produit requise (granularité justifiée ? petits effectifs ?)

---

## Validation & Tests

**Importer** :
- `pnpm --filter @choisir-sa-ville/importer export:static`
- Vérifier 75056 a `population !== null` et taux calculés
- Vérifier Bordeaux (33063) :
  - `populationCategory = "large"`
  - `levelCategory = 4`
  - `rankInCategory = "1/42"`
  - Taux ×100 corrects (ex: 1630 pour violences au lieu de 16.3)
- Vérifier `meta.json` contient `populationCategories` avec counts
- Comparer distribution `levelCategory` par catégorie (équilibrée)

**Frontend** :
- Toggle "insécurité" : pas de freeze notable
- Pan/zoom : updates uniquement sur `moveend`/`zoomend`
- Mobile : `fill-opacity = 0.75`, navigation fluide
- Badge Bordeaux : affiche "Niveau 4 - 1/42 grandes villes"
- Tooltip : montre les deux perspectives (national + catégorie)

**Régression** :
- Feature-state `highlight`/`active` prioritaire sur `insecurityLevelCode`
- Cleanup handlers au toggle off (pas de memory leak)
- AbortController annule requêtes en vol (pas de race conditions)
- Rendu carte utilise `levelCategory` (pas `levelNational`)

**Tests unitaires** :
- `getPopulationCategory()` : retourne correct small/medium/large selon population
- `mapIndexToLevel()` : mapping percentile → level [0..4]
- Bordeaux témoin : toutes propriétés correctes
- Paris témoin : `populationCategory = "large"`, taux cohérents

---

## Références

- **Pipeline importer** : `packages/importer/src/exports/communes/metrics/insecurity/`
- **Mapping catégories** : `packages/importer/src/exports/communes/metrics/insecurity/mapping/ssmsiToGroups.v1.json`
- **Data layer** : `apps/web/lib/data/insecurityMetrics.ts`
- **Map rendering** : `apps/web/lib/map/state/displayBinder.ts`
- **Badge component** : `apps/web/components/insecurity-badge.tsx`
- **Color palette** : `apps/web/lib/config/insecurityPalette.ts`

---

**Dernière mise à jour** : 2026-02-08  
**Version dataset** : v2026-02-08  
**Spec de référence** : `docs/archive/security-index-population-classification.md`  
**Tasks implémentées** : 
- Task 2 (population Parquet)
- Task 1 (quartiles + level)
- Task Performance (viewport-only)
- **Phase 5 (classification par taille de population)** ✅
