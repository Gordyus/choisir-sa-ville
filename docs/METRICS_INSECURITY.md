# Métrique Insécurité (SSMSI)

**Source** : Bases statistiques communales de la délinquance enregistrée – SSMSI (Ministère de l'Intérieur)  
**Licence** : Licence Ouverte / Etalab  
**Niveau géographique** : Commune (pivot territorial)  
**Granularité temporelle** : Annuelle (années disponibles dans `meta.json`)

---

## Vue d'ensemble

La métrique "insécurité" agrège les faits de délinquance enregistrés par commune en trois groupes pondérés :
- **Violences aux personnes** (poids 0.4) : violences physiques, sexuelles, vols avec armes
- **Sécurité des biens** (poids 0.35) : cambriolages, vols de véhicules, escroqueries
- **Tranquillité publique** (poids 0.25) : destructions et dégradations volontaires

L'export calcule :
1. **Taux par 1000 habitants** pour chaque groupe
2. **Score brut** (`scoreRaw`) : moyenne pondérée des taux
3. **Index global** (`indexGlobal`) : percentile rank 0–100 (utile pour tri/badge)
4. **Niveau** (`level`) : classification 0–4 basée sur quartiles (utilisé pour le rendu carto)

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
4. **Calcul des taux** : `ratePer1000 = (sumFacts / insee_pop) * 1000`
   - **Population source** : `insee_pop` du Parquet SSMSI uniquement
   - **Pas de fallback** : si `insee_pop` absent → `null`
5. **Score brut** : `scoreRaw = Σ(weight × rate)` où weights sont normalisés
6. **Index global** : percentile rank min-rank (0–100)
7. **Niveau** : classification quartile sur `scoreRaw > 0` :
   - Q1/Q2/Q3 calculés par année
   - Mapping : `scoreRaw=0 → 0`, `0 < scoreRaw < Q1 → 1`, etc.

### Sortie

**Fichiers** :
- `communes/metrics/insecurity/{year}.json` : données par année (format colonnes + rows)
- `communes/metrics/insecurity/meta.json` : métadonnées, seuils, labels

**Structure JSON** (exemple) :
```json
{
  "year": 2024,
  "unit": "faits pour 1000 habitants",
  "source": "Ministère de l'Intérieur – SSMSI",
  "generatedAtUtc": "2026-02-05T20:00:00.000Z",
  "columns": [
    "insee",
    "population",
    "violencesPersonnesPer1000",
    "securiteBiensPer1000",
    "tranquillitePer1000",
    "scoreRaw",
    "indexGlobal",
    "level"
  ],
  "rows": [
    ["01001", 860, 0, null, null, 0, 0, 0],
    ["75056", 2190327, 15.1, 26.3, 9.8, 17.2, 85, 4]
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
  "thresholds": {
    "2024": { "q1": 8.5, "q2": 14.2, "q3": 22.7, "method": "quartiles on scoreRaw > 0" },
    "2023": { "q1": 8.1, "q2": 13.8, "q3": 21.9, "method": "quartiles on scoreRaw > 0" }
  },
  "levels": {
    "labels": ["Très faible", "Faible", "Modéré", "Élevé", "Plus élevé"],
    "method": "Quartile-based classification on non-zero scoreRaw distribution"
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
    violencesPersonnesPer1000: number | null;
    securiteBiensPer1000: number | null;
    tranquillitePer1000: number | null;
    scoreRaw: number | null;
    indexGlobal: number | null;
    level: number | null;  // 0–4
  } | null;
  loading: boolean;
  error: Error | null;
}
```

**Chargement** :
- Fetch via `/data/{version}/communes/metrics/insecurity/{year}.json`
- Parsing colonnes → rows en Map `insee → metrics`
- Cache in-memory (un Map par année)

---

### Rendu Carte (`lib/map/state/displayBinder.ts`)

**Problème résolu** : L'ancienne approche utilisait une expression `match` géante (~35k communes) → freeze au toggle + stutter pan/zoom.

**Solution** : **Feature-state viewport-only**

**Mécanique** :
1. Au toggle "insécurité" :
   - Charger les données via `loadInsecurityYear()`
   - Construire Map `insee → level`
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
   - Lookup level par insee
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

---

### Badge Component (`components/insecurity-badge.tsx`)

Consomme `level` directement :
```typescript
const { data } = useInsecurityMetrics(inseeCode, year);
if (!data || data.level === null) return null;

const label = LEVEL_LABELS[data.level];
const color = INSECURITY_COLORS[data.level];
```

Pas de calcul runtime, juste lookup palette.

---

## Niveaux d'Insécurité

| Level | Label | Couleur | Condition |
|-------|-------|---------|-----------|
| 0 | Très faible | `#22c55e` (vert) | `scoreRaw = 0` ou `null` |
| 1 | Faible | `#84cc16` (lime) | `0 < scoreRaw < Q1` |
| 2 | Modéré | `#eab308` (jaune) | `Q1 ≤ scoreRaw < Q2` |
| 3 | Élevé | `#f97316` (orange) | `Q2 ≤ scoreRaw < Q3` |
| 4 | Plus élevé | `#ef4444` (rouge) | `Q3 ≤ scoreRaw` |

**Seuils** : calculés par année, stockés dans `meta.json`, baked au build-time.

---

## Décisions Architecturales

### Pourquoi `insee_pop` du Parquet (Task 2) ?

- **Bug 75056** : Paris absent du ZIP INSEE → population null
- **Single source** : cohérence faits + population (même fichier)
- **Couverture** : 99.98% des données ont `insee_pop` (inspection validée)
- **Découplage** : pas de corrélation entre agrégats

### Pourquoi quartiles sur `scoreRaw > 0` (Task 1) ?

- **Problème** : Distribution très concentrée sur 0 → rendu binaire (trop de vert/rouge)
- **Solution** : Ignorer les zéros pour le calcul des seuils → classes intermédiaires significatives
- **Rendu** : Plus de nuances (5 niveaux au lieu de 2)

### Pourquoi bake `level` au build-time ?

- **Performance** : Évite expression match géante (~35k communes) côté client
- **Déterminisme** : Un export = un level fixe (audit trail)
- **Cohérence** : Seuils versionnés dans meta.json

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
- Vérifier `meta.json` contient `thresholds` et `levels`
- Comparer distribution `scoreRaw` avant/après (pas de shift inattendu)

**Frontend** :
- Toggle "insécurité" : pas de freeze notable
- Pan/zoom : updates uniquement sur `moveend`/`zoomend`
- Mobile : `fill-opacity = 0.75`, navigation fluide
- Badge : affiche label correct (Très faible → Plus élevé)

**Régression** :
- Feature-state `highlight`/`active` prioritaire sur `insecurityLevelCode`
- Cleanup handlers au toggle off (pas de memory leak)
- AbortController annule requêtes en vol (pas de race conditions)

---

## Références

- **Pipeline importer** : `packages/importer/src/exports/communes/metrics/insecurity/`
- **Mapping catégories** : `packages/importer/src/exports/communes/metrics/insecurity/mapping/ssmsiToGroups.v1.json`
- **Data layer** : `apps/web/lib/data/insecurityMetrics.ts`
- **Map rendering** : `apps/web/lib/map/state/displayBinder.ts`
- **Badge component** : `apps/web/components/insecurity-badge.tsx`
- **Color palette** : `apps/web/lib/config/insecurityPalette.ts`

---

**Dernière mise à jour** : 2026-02-05  
**Tasks implémentées** : Task 2 (population Parquet) + Task 1 (quartiles + level) + Task Performance (viewport-only)
