# Spécification — Extension Métriques Communes (Prix Immobilier & Géographie)

**Statut** : Draft  
**Date** : 12 février 2026  
**Implémentation** : Non commencée  
**Dépendances** : DVF (déjà intégré), INSEE grille densité

---

## 1) Contexte & intention produit

La recherche multi-critères nécessite des **métriques agrégées par commune** pour permettre le filtrage et le scoring. Actuellement, seule la métrique **insécurité (SSMSI)** est disponible.

Cette spécification couvre l'ajout de :
1. **Prix immobilier** (médians par type de bien)
2. **Géographie / Cadre de vie** (densité urbaine, proximité mer)
3. **Centroids communes** (pour routing)

---

## 2) Objectifs

### Objectif utilisateur
Filtrer les communes par :
- Budget achat/location ("max 300 000€ pour maison")
- Cadre de vie ("ville" vs "campagne")
- Proximité mer ("< 10km")

### Objectif produit
Permettre scoring communes basé sur critères objectifs (prix + cadre de vie).

### Objectif technique
Enrichir dataset statique avec agrégats calculés au build-time (pipeline importer).

---

## 3) Hors périmètre (MVP)

- ❌ Loyers (source OLL, post-MVP)
- ❌ Évolution prix dans le temps (graphiques tendances)
- ❌ Quartiers infra-communaux (agrégation commune uniquement)
- ❌ Proximité montagne (data complexe)
- ❌ Autres critères géographiques (distance aéroport, voie ferrée, etc.)

---

## 4) Décisions & hypothèses

### Source données prix immobilier

**Source** : DVF (Demandes de Valeurs Foncières) — déjà intégré dans importer.

**Périmètre** :
- Transactions **2 dernières années** (fenêtre glissante)
- Types bien : `Maison`, `Appartement`
- Exclusions : transactions aberrantes (prix < 5 000€, prix > 10M€)

**Calculs** :
- **Médiane prix/m²** (tous types confondus)
- **Médiane prix maison** (total transaction)
- **Médiane prix appartement** (total transaction)
- **Nombre transactions** (indicateur liquidité marché)

**Granularité** : Commune uniquement (pas quartier).

### Source données géographie

#### Densité urbaine

**Source** : INSEE Grille de densité communale
- URL : https://www.insee.fr/fr/statistiques/fichier/2114627/grille_densite_7_niveaux_2022.xlsx
- Format : Excel → conversion CSV
- Champs : `CODGEO`, `LIBGEO`, `LIBDENSE7`

**Mapping densité** :
- "Dense" / "Densité intermédiaire" → `urban`
- "Peu dense" / "Très peu dense" → `rural`
- (Autres niveaux → mapping à définir)

#### Proximité mer

**Source** : OSM Coastline (Natural Earth ou OSM data)
- Fichier : `coastline-france.geojson` (LineString côte française)
- Calcul : distance centroid commune → ligne côte (PostGIS `ST_Distance`)

**Buckets** :
- `< 10 km` → "coastal"
- `10-30 km` → "near_coastal"
- `> 30 km` → "inland"

---

## 5) Exports statiques générés

### 5.1. `communes/metrics/realEstate.json`

**Format** :
```json
{
  "34172": {
    "medianPricePerM2": 3200,
    "medianPriceApartment": 245000,
    "medianPriceHouse": 485000,
    "transactionCount": 1842,
    "dataYears": [2023, 2024]
  },
  "75056": {
    "medianPricePerM2": 9800,
    "medianPriceApartment": 520000,
    "medianPriceHouse": null,
    "transactionCount": 12489,
    "dataYears": [2023, 2024]
  }
}
```

**Taille estimée** : ~5 MB (35 000 communes)

**Champs** :
- `medianPricePerM2` : Prix médian €/m² (tous biens)
- `medianPriceApartment` : Prix médian appartement (total transaction)
- `medianPriceHouse` : Prix médian maison (total transaction)
- `transactionCount` : Nombre transactions sur période
- `dataYears` : Années prises en compte

**Cas particuliers** :
- Commune sans transaction → `null` pour tous les champs (sauf `transactionCount: 0`)
- < 5 transactions → considéré non significatif, `null` pour médians

---

### 5.2. `communes/metrics/geography.json`

**Format** :
```json
{
  "34172": {
    "density": "urban",
    "densityLabel": "Dense",
    "coastDistance": "coastal",
    "coastDistanceKm": 8.2
  },
  "15014": {
    "density": "rural",
    "densityLabel": "Très peu dense",
    "coastDistance": "inland",
    "coastDistanceKm": 342.5
  }
}
```

**Champs** :
- `density` : Enum `"urban" | "rural"`
- `densityLabel` : Label INSEE original
- `coastDistance` : Enum `"coastal" | "near_coastal" | "inland"`
- `coastDistanceKm` : Distance en km (arrondi 0.1 km)

---

### 5.3. `communes/centroids.json`

**Rôle** : Fournir coordonnées centroid pour calcul routing.

**Format** :
```json
{
  "34172": {
    "lat": 43.610769,
    "lng": 3.876716
  },
  "75056": {
    "lat": 48.856614,
    "lng": 2.352222
  }
}
```

**Source** : Calcul PostGIS `ST_Centroid(geometry)` depuis données communes existantes.

**Taille estimée** : ~2 MB

---

## 6) Pipeline importer — Étapes techniques

### Étape 1 : Agrégation DVF (prix immobilier)

**Script** : `packages/importer/src/exports/communes/metrics/realEstate.ts`

**Logique** :
1. Charger toutes transactions DVF (2 dernières années)
2. Filtrer :
   - Type local : `Maison` ou `Appartement`
   - Prix : 5 000€ < prix < 10 000 000€
   - Surface habitable > 0 m²
3. Grouper par `codeInsee`
4. Calculer médians :
   - `medianPricePerM2` : médiane(`prix / surface`)
   - `medianPriceApartment` : médiane(`prix`) WHERE type = Appartement
   - `medianPriceHouse` : médiane(`prix`) WHERE type = Maison
5. Compter transactions
6. Exporter JSON

**Dépendances** :
- Export DVF existant (`src/exports/transactions/`)
- Librairie stats (simple-statistics ou implémentation manuelle médiane)

---

### Étape 2 : Grille densité INSEE

**Script** : `packages/importer/src/exports/communes/metrics/geography.ts`

**Logique** :
1. Télécharger Excel INSEE grille densité
2. Parser Excel → JSON (librairie `xlsx`)
3. Mapper `LIBDENSE7` → enum `urban` / `rural`
4. Joindre avec communes par `CODGEO`
5. Intégrer dans `geography.json`

**Mapping densité** :
```typescript
const DENSITY_MAPPING: Record<string, "urban" | "rural"> = {
  "Dense": "urban",
  "Densité intermédiaire": "urban",
  "Peu dense": "rural",
  "Très peu dense": "rural",
  // Autres cas → fallback "rural"
};
```

---

### Étape 3 : Distance côte

**Script** : `packages/importer/src/exports/communes/metrics/coastDistance.ts`

**Logique** :
1. Charger GeoJSON côte France (Natural Earth `ne_10m_coastline.shp` filtré France)
2. Pour chaque commune :
   - Calculer centroid
   - Calculer distance à coastline (librairie Turf.js `pointToLineDistance`)
3. Classifier :
   - < 10 km → `coastal`
   - 10-30 km → `near_coastal`
   - > 30 km → `inland`
4. Intégrer dans `geography.json`

**Dépendances** :
- Turf.js (manipulation géométrie)
- GeoJSON coastline (source externe ou OSM)

---

### Étape 4 : Centroids communes

**Script** : `packages/importer/src/exports/communes/centroids.ts`

**Logique** :
1. Charger GeoJSON communes (existant)
2. Pour chaque commune :
   - Calculer `ST_Centroid(geometry)` (Turf.js `centroid()`)
   - Extraire `lat`, `lng`
3. Exporter `centroids.json`

**Optimisation** :
- Si centroid déjà calculé dans communes existantes → réutiliser
- Sinon : calcul à partir polygones

---

## 7) Frontend — Consommation données

### Hooks React

**Nouveau fichier** : `apps/web/lib/data/communeMetrics.ts`

```typescript
export type CommuneMetrics = {
  realEstate: {
    medianPricePerM2: number | null;
    medianPriceApartment: number | null;
    medianPriceHouse: number | null;
    transactionCount: number;
    dataYears: number[];
  };
  geography: {
    density: "urban" | "rural";
    densityLabel: string;
    coastDistance: "coastal" | "near_coastal" | "inland";
    coastDistanceKm: number;
  };
};

export async function fetchCommuneMetrics(
  codeInsee: string
): Promise<CommuneMetrics | null> {
  // Fetch /data/current/communes/metrics/realEstate.json
  // Fetch /data/current/communes/metrics/geography.json
  // Combiner résultats
}
```

**Hook** :
```typescript
export function useCommuneMetrics(codeInsee: string | null) {
  const [metrics, setMetrics] = useState<CommuneMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    if (!codeInsee) return;
    // Fetch metrics
  }, [codeInsee]);
  
  return { metrics, loading };
}
```

---

## 8) Validation données

### Tests qualité

**Script** : `packages/importer/src/exports/communes/metrics/__tests__/realEstate.test.ts`

**Vérifications** :
- ✅ Médiane prix > 0 pour communes avec transactions
- ✅ `medianPricePerM2` cohérent (1000€ < prix/m² < 50 000€ pour France métropole)
- ✅ `transactionCount` > 0 si médians non null
- ✅ Pas de valeur aberrante (> 10M€ pour maison hors Paris/Côte d'Azur)

**Rapport qualité** :
```
✅ 32 458 communes avec données DVF
❌ 2 542 communes sans transaction (zones rurales)
⚠️  14 communes avec < 5 transactions (données non significatives)
```

---

## 9) Performances

### Taille fichiers

| Fichier | Taille estimée | Compression gzip |
|---------|----------------|------------------|
| `realEstate.json` | ~5 MB | ~1 MB |
| `geography.json` | ~3 MB | ~700 KB |
| `centroids.json` | ~2 MB | ~500 KB |
| **Total** | **~10 MB** | **~2.2 MB** |

**Impact** : +2.2 MB données statiques (acceptable pour MVP).

### Temps build

**Estimation** :
- Agrégation DVF : ~30s (calcul médians 35k communes × 2 ans transactions)
- Grille densité INSEE : ~5s (simple mapping)
- Distance côte : ~60s (calcul géométrique 35k centroids)
- Centroids : ~10s

**Total** : ~2 min ajout au pipeline importer (acceptable).

---

## 10) Migration dataset

### Versioning

Nouveau dataset : `v2026-02-18` (exemple)

**Changements** :
- Ajout `communes/metrics/realEstate.json`
- Ajout `communes/metrics/geography.json`
- Ajout `communes/centroids.json`

**Rétrocompatibilité** : Oui (nouveaux fichiers, pas de modification existants).

### Manifest

`data/current/manifest.json` :
```json
{
  "version": "v2026-02-18",
  "generated": "2026-02-18T10:30:00Z",
  "datasets": {
    "communes": {
      "index": "communes/indexLite.json",
      "metrics": {
        "realEstate": "communes/metrics/realEstate.json",
        "geography": "communes/metrics/geography.json"
      },
      "centroids": "communes/centroids.json"
    },
    "transactions": { ... }
  }
}
```

---

## 11) UI — Affichage métriques

### Page détail commune

**Nouveau composant** : `CommuneMetricsCard`

**Affichage** :
```
┌─────────────────────────────────────┐
│ 🏠 Immobilier                       │
├─────────────────────────────────────┤
│ Prix médian / m²    3 200 €         │
│ Appartement         245 000 €       │
│ Maison              485 000 €       │
│ Transactions (2ans) 1 842           │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 🌍 Géographie                       │
├─────────────────────────────────────┤
│ Densité             Dense (urbain)  │
│ Proximité mer       8.2 km          │
└─────────────────────────────────────┘
```

**Localisation** : Intégrer dans `RightPanelDetailsCard` (onglet ou section).

---

## 12) Roadmap post-MVP

### Phase 2 : Loyers (OLL)

**Source** : Observatoire des Loyers de l'Agglomération Montpelliéraine (OLL)
- URL : https://data.montpellier3m.fr/dataset/oll-open-data
- Format : CSV
- Données : loyers moyens par commune, type bien, surface

**Export** : `communes/metrics/rentals.json`

**Champs** :
- `medianRentPerM2`
- `medianRentApartment`
- `medianRentHouse`

**Effort** : Moyen (source externe, agrégation similaire DVF).

---

### Phase 3 : Évolution prix

**Calculs** :
- Évolution prix/m² sur 5 ans (graphique)
- Détection tendance (hausse/baisse)

**Export** : `communes/metrics/realEstateTrends.json`

**UI** : Graphique Chart.js dans détail commune.

---

### Phase 4 : Métriques quartier (infra-communal)

**Granularité** : IRIS (Îlots Regroupés pour l'Information Statistique)

**Difficulté** : Élevée (35k communes × ~15 IRIS/commune = 500k+ zones).

---

## 13) Métriques de succès MVP

**Technique** :
- ✅ Couverture > 90% communes avec données prix
- ✅ Temps build < 5 min total
- ✅ Taille datasets < 5 MB (gzippé)

**Produit** : (voir spec multi-criteria-search)
- ✅ > 60% recherches utilisent filtre prix
- ✅ Critère "ville vs campagne" utilisé par > 40% recherches

---

## 14) Risques & mitigations

| Risque | Impact | Probabilité | Mitigation |
|--------|--------|-------------|------------|
| Données DVF incomplètes (zones rurales) | Moyen | Élevée | Afficher "Données insuffisantes" si < 5 transactions |
| Distance côte imprécise (décalage OSM) | Faible | Moyenne | Tolérance ±2 km acceptable MVP |
| Taille fichiers trop élevée | Faible | Faible | Compression gzip efficace (~80% gain) |
| Grille densité INSEE obsolète | Faible | Faible | Mise à jour annuelle INSEE, regénération dataset |

---

## 15) Annexes

### A. Exemple calcul médiane prix

**Transactions commune 34172 (Montpellier)** :
```
Appartement : [180k, 220k, 240k, 250k, 280k, 310k, 350k]
Maison : [420k, 450k, 485k, 520k, 580k]
```

**Calculs** :
- `medianPriceApartment` : 250 000€ (valeur centrale)
- `medianPriceHouse` : 485 000€
- Surface moyenne : 85 m²
- `medianPricePerM2` : médiane(prix/surface) ≈ 3 200 €/m²

### B. Sources alternatives prix immobilier

| Source | Couverture | Granularité | Gratuit | Licence |
|--------|------------|-------------|---------|---------|
| **DVF** | France entière | Commune | ✅ | Open Data |
| OLL | Montpellier uniquement | Commune | ✅ | Open Data |
| SeLoger API | France | Quartier | ❌ | Payant |
| Notaires de France | France | Département | ✅ (agrégats) | Open Data |

**Recommandation MVP** : DVF uniquement (couverture nationale).

### C. Coastline France — Source GeoJSON

**Option 1** : Natural Earth (10m résolution)
- URL : https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-coastline/
- Format : Shapefile → conversion GeoJSON
- Licence : Public domain

**Option 2** : OSM Overpass
- Query : `[out:json]; way["natural"="coastline"](bbox_france); out geom;`
- Précision supérieure mais fichier volumineux

**Recommandation MVP** : Natural Earth (simplicité, taille raisonnable).
