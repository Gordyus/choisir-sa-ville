# Spécification: Classification par Taille de Population pour l'Indice de Sécurité

**Version**: 1.0  
**Date**: 2026-02-08  
**Statut**: ✅ Validé PO/Architect Gatekeeper  
**Auteur**: GitHub Copilot CLI  
**Breaking Change**: Oui (schéma de données + métrique)

---

## 1. Vue d'Ensemble

### 1.1 Objectif

Implémenter une classification par taille de population pour l'indice de sécurité (insécurité) afin de:
1. **Résoudre le biais mécanique** des taux/capita sur petites populations
2. **Aligner sur les standards internationaux** (ONU-ICVS, classements homicides, littérature scientifique)
3. **Permettre des comparaisons légitimes** entre communes de tailles similaires
4. **Reconnaître correctement** Bordeaux (1ère ville >100k hab) comme niveau 4

### 1.2 Contexte

**Problème actuel**: Le système calcule un percentile [0..100] sur toutes les 34,875 communes ensemble, créant un **biais structurel** où les petites communes monopolisent le niveau 4 en raison de taux/1000 mécaniquement élevés.

**Exemple du biais**:
- Commune 30 habitants + 1 fait divers = 33.3 pour 1000
- Bordeaux 252k habitants + 1 fait divers = 0.004 pour 1000
- **Comparaison illégitime** sans correction de taille

**Résultat actuel**:
- 22 communes niveau 4 (indexGlobal = 100)
- **Toutes <6000 habitants**
- Bordeaux (top 1 villes >100k): niveau 3 (indexGlobal 99)

### 1.3 Standards Internationaux

**Consensus universel** (recherche détaillée: `doc/RESEARCH-security-index-methodologies.md`):

| Standard | Méthodologie |
|----------|--------------|
| **Numbeo Crime Index** | Classification implicite (villes comparables) |
| **ONU-ICVS** (70+ pays) | Analyse par catégorie urbain/rural/métropole |
| **Classements Homicides** | Seuil minimum 300,000 habitants |
| **Littérature Académique** | Toujours contrôler pour taille population |

**Taux Standard**: Pour **100,000 habitants** (pas pour 1,000)

---

## 2. Spécifications Fonctionnelles

### 2.1 Catégories de Population

**Définition de 3 catégories**:

```typescript
export const POPULATION_CATEGORIES = {
    small: { 
        min: 0, 
        max: 9999, 
        label: "Petites communes",
        description: "Villages et petites communes rurales"
    },
    medium: { 
        min: 10000, 
        max: 99999, 
        label: "Communes moyennes",
        description: "Villes moyennes"
    },
    large: { 
        min: 100000, 
        max: Infinity, 
        label: "Grandes villes",
        description: "Grandes villes et métropoles"
    }
} as const;

export type PopulationCategory = "small" | "medium" | "large";

export function getPopulationCategory(population: number | null): PopulationCategory | null {
    if (population === null || !Number.isFinite(population) || population <= 0) {
        return null;
    }
    if (population < 10000) return "small";
    if (population < 100000) return "medium";
    return "large";
}
```

**Seuils justifiés**:
- `10,000`: Transition rural/urbain (définition INSEE)
- `100,000`: Grandes agglomérations (seuil commun international)
- Aligné sur ICVS et classements académiques

**Distribution actuelle** (estimée):
- Small (<10k): ~30,000 communes (86%)
- Medium (10k-100k): ~4,800 communes (14%)
- Large (>100k): ~42 communes (<1%)

### 2.2 Métriques de Sortie

**Double Perspective**:

1. **Perspective Nationale** (actuelle, renommée):
   - `indexGlobalNational`: Percentile [0..100] sur toutes les 34,875 communes
   - `levelNational`: Niveau [0..4] basé sur `indexGlobalNational`
   - **Usage**: Vue d'ensemble France entière

2. **Perspective Catégorie** (nouvelle):
   - `indexGlobalCategory`: Percentile [0..100] dans la catégorie de taille
   - `levelCategory`: Niveau [0..4] basé sur `indexGlobalCategory`
   - `rankInCategory`: Position absolue (ex: "1/42", "523/30145")
   - **Usage**: Comparaison légitime entre pairs

**Affichage UI**: Badge affiche **catégorie** (métrique légitime), national en tooltip

### 2.3 Passage à "pour 100,000 habitants"

**Standard scientifique universel** (ONU, EU, académiques):

**Changement**:
```typescript
// AVANT (actuel)
violencesPersonnesPer1000: number | null;  // Bordeaux: 16.3
securiteBiensPer1000: number | null;       // Bordeaux: 80.1
tranquillitePer1000: number | null;        // Bordeaux: 14.7

// APRÈS (nouveau)
violencesPersonnesPer100k: number | null;  // Bordeaux: 1630
securiteBiensPer100k: number | null;       // Bordeaux: 8010
tranquillitePer100k: number | null;        // Bordeaux: 1470
```

**Impact**:
- Cosmétique: ×100 sur tous les taux affichés
- Formule de score inchangée (pondération 40/35/25 conservée)
- Facilite comparaisons internationales
- Plus intuitif grandes villes (évite décimales)

---

## 3. Spécifications Techniques

### 3.1 Schéma de Données

#### Avant (v2026-02-08)

```json
{
    "year": 2024,
    "columns": [
        "insee",
        "population",
        "violencesPersonnesPer1000",
        "securiteBiensPer1000",
        "tranquillitePer1000",
        "indexGlobal",
        "level",
        "dataCompleteness"
    ],
    "rows": [
        [
            "33063",
            252040,
            16.3,
            80.1,
            14.7,
            99,
            3,
            1.0
        ]
    ]
}
```

#### Après (v2026-02-15 ou suivante)

```json
{
    "year": 2024,
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
        [
            "33063",           // insee
            252040,            // population
            "large",           // populationCategory [NOUVEAU]
            1630,              // violencesPersonnesPer100k [×100]
            8010,              // securiteBiensPer100k [×100]
            1470,              // tranquillitePer100k [×100]
            99,                // indexGlobalNational [RENOMMÉ]
            99,                // indexGlobalCategory [NOUVEAU]
            3,                 // levelNational [RENOMMÉ]
            4,                 // levelCategory [NOUVEAU]
            "1/42",            // rankInCategory [NOUVEAU]
            1.0                // dataCompleteness
        ]
    ]
}
```

**Résumé changements**:
- **Renommages**: `indexGlobal` → `indexGlobalNational`, `level` → `levelNational`
- **Ajouts**: 5 champs (`populationCategory`, `indexGlobalCategory`, `levelCategory`, `rankInCategory`, métrique ×100)
- **Total colonnes**: 8 → 12

### 3.2 Algorithme de Calcul

**Fichier**: `packages/importer/src/exports/communes/metrics/insecurity/exportMetricsInsecurity.ts`

**Pseudo-code**:

```typescript
// 1. Classifier toutes les communes
for (const commune of communes) {
    const population = populationByInsee.get(commune.insee) ?? null;
    const category = getPopulationCategory(population);
    
    commune.populationCategory = category;
    commune.violencesPersonnesPer100k = (violencesPer1k ?? 0) * 100;  // ×100
    commune.securiteBiensPer100k = (biensPer1k ?? 0) * 100;           // ×100
    commune.tranquillitePer100k = (tranquillitePer1k ?? 0) * 100;     // ×100
    commune.scoreRaw = computeRawScore(...);  // Formule inchangée
}

// 2. Calculer percentile NATIONAL (comme actuellement)
const scoreValues = communes
    .map(c => c.scoreRaw)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));

const indexByScoreNational = buildPercentileIndex(scoreValues);

for (const commune of communes) {
    commune.indexGlobalNational = commune.scoreRaw === null 
        ? null 
        : indexByScoreNational.get(commune.scoreRaw) ?? null;
    commune.levelNational = mapIndexToLevel(commune.indexGlobalNational);
}

// 3. Calculer percentile PAR CATÉGORIE (nouveau)
const categorizedCommunes = {
    small: communes.filter(c => c.populationCategory === "small"),
    medium: communes.filter(c => c.populationCategory === "medium"),
    large: communes.filter(c => c.populationCategory === "large")
};

for (const [category, communesInCategory] of Object.entries(categorizedCommunes)) {
    const scoreValuesCategory = communesInCategory
        .map(c => c.scoreRaw)
        .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    
    const indexByScoreCategory = buildPercentileIndex(scoreValuesCategory);
    
    // Trier par score décroissant pour calcul rank
    const sortedByScore = [...communesInCategory]
        .filter(c => c.scoreRaw !== null)
        .sort((a, b) => (b.scoreRaw ?? 0) - (a.scoreRaw ?? 0));
    
    for (const commune of communesInCategory) {
        commune.indexGlobalCategory = commune.scoreRaw === null
            ? null
            : indexByScoreCategory.get(commune.scoreRaw) ?? null;
        commune.levelCategory = mapIndexToLevel(commune.indexGlobalCategory);
        
        // Calculer rank
        const rank = sortedByScore.findIndex(c => c.insee === commune.insee) + 1;
        commune.rankInCategory = rank > 0 
            ? `${rank}/${communesInCategory.length}`
            : null;
    }
}

// 4. Export JSON avec nouveau schéma
const tabularRows = communes.map(c => [
    c.insee,
    c.population,
    c.populationCategory,
    c.violencesPersonnesPer100k,
    c.securiteBiensPer100k,
    c.tranquillitePer100k,
    c.indexGlobalNational,
    c.indexGlobalCategory,
    c.levelNational,
    c.levelCategory,
    c.rankInCategory,
    c.dataCompleteness
] as const);
```

**Fonction helper `buildPercentileIndex()`** (existante, inchangée):
- Tri croissant des scores
- Calcul percentile [0..100]
- Map score → percentile

**Fonction `mapIndexToLevel()`** (mise à jour quintiles standards):
```typescript
function mapIndexToLevel(indexGlobal: number | null): number {
    if (indexGlobal === null || !Number.isFinite(indexGlobal)) return 0;
    
    // Quintiles standards (alignés sur Numbeo Crime Index et méthodologies académiques)
    if (indexGlobal < 20) return 0;  // [0-20)   = Très bas
    if (indexGlobal < 40) return 1;  // [20-40)  = Bas
    if (indexGlobal < 60) return 2;  // [40-60)  = Moyen
    if (indexGlobal < 80) return 3;  // [60-80)  = Haut
    return 4;  // [80-100] = Très haut (top 20%)
}
```

### 3.3 Métadonnées (meta.json)

**Ajouter section `populationCategories`**:

```json
{
    "geoLevel": "commune",
    "fallbackChain": [],
    "missingValueTreatment": "implicit_zero",
    "weightRenormalization": false,
    "weights": {
        "violences_personnes": 0.4,
        "securite_biens": 0.35,
        "tranquillite": 0.25
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
    "dataCompleteness": {
        "description": "Proportion of categories with data for each commune",
        "range": [0, 1],
        "threshold_warning": 0.67
    }
}
```

---

## 4. Frontend (UI Layer)

### 4.1 Types TypeScript

**Fichier**: `apps/web/lib/data/insecurityMetrics.ts` (ou équivalent)

```typescript
export type PopulationCategory = "small" | "medium" | "large";

export interface InsecurityMetric {
    insee: string;
    population: number | null;
    populationCategory: PopulationCategory | null;
    
    // Taux pour 100k (changé)
    violencesPersonnesPer100k: number | null;
    securiteBiensPer100k: number | null;
    tranquillitePer100k: number | null;
    
    // Double perspective
    indexGlobalNational: number | null;
    indexGlobalCategory: number | null;
    levelNational: number;
    levelCategory: number;
    rankInCategory: string | null;
    
    dataCompleteness: number;
}
```

### 4.2 Hook `useInsecurityMetrics`

**Aucune modification API publique nécessaire** (encapsulation des nouveaux champs):

```typescript
// Le hook parse les nouvelles colonnes automatiquement
export function useInsecurityMetrics(insee: string, year?: number) {
    // ... fetch logic ...
    
    // Mapping automatique des 12 colonnes vers InsecurityMetric
    const metric: InsecurityMetric = {
        insee: row[0],
        population: row[1],
        populationCategory: row[2],
        violencesPersonnesPer100k: row[3],
        securiteBiensPer100k: row[4],
        tranquillitePer100k: row[5],
        indexGlobalNational: row[6],
        indexGlobalCategory: row[7],
        levelNational: row[8],
        levelCategory: row[9],
        rankInCategory: row[10],
        dataCompleteness: row[11]
    };
    
    return metric;
}
```

### 4.3 Badge Component

**Fichier**: `apps/web/components/insecurity-badge.tsx` (ou équivalent)

**Structure recommandée**:

```tsx
export function InsecurityBadge({ metric }: { metric: InsecurityMetric }) {
    const level = metric.levelCategory;  // Afficher CATÉGORIE (métrique légitime)
    const levelInfo = INSECURITY_LEVELS[level];
    const categoryLabel = metric.populationCategory 
        ? POPULATION_CATEGORIES[metric.populationCategory].label
        : "Catégorie inconnue";
    
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div className="flex flex-col gap-1">
                    {/* Badge principal: Niveau catégorie */}
                    <Badge variant={getLevelVariant(level)} className="w-fit">
                        Niveau {level} – {levelInfo.label}
                    </Badge>
                    
                    {/* Sous-texte: Rang dans catégorie */}
                    {metric.rankInCategory && (
                        <Text variant="muted" size="sm">
                            {metric.rankInCategory} {categoryLabel}
                        </Text>
                    )}
                </div>
            </TooltipTrigger>
            
            <TooltipContent>
                <div className="space-y-2">
                    <p className="font-medium">
                        Niveau {level} ({categoryLabel})
                    </p>
                    <p className="text-muted-foreground">
                        Niveau {metric.levelNational} (classement national)
                    </p>
                    <Separator />
                    <div className="text-xs space-y-1">
                        <p>Percentile national: {metric.indexGlobalNational}</p>
                        <p>Percentile catégorie: {metric.indexGlobalCategory}</p>
                        {metric.dataCompleteness < 1.0 && (
                            <p className="text-amber-600">
                                Données partielles ({Math.round(metric.dataCompleteness * 100)}%)
                            </p>
                        )}
                    </div>
                </div>
            </TooltipContent>
        </Tooltip>
    );
}
```

**Principe**: KISS (Keep It Simple)
- Badge affiche **catégorie** (prioritaire)
- Sous-texte: rang dans catégorie
- Tooltip: détails complets (national + catégorie)
- **Pas de toggle** (over-engineering)

### 4.4 FAQ Update

**Fichier**: `apps/web/lib/data/faqContent.ts` (ou équivalent)

**Ajouter 3 nouvelles sections** au sein de l'item `insecurity-index`:

```typescript
{
    id: "insecurity-index",
    question: "Comment est calculé l'indice de sécurité ?",
    answer: `
        <!-- Contenu existant... -->
        
        ### Classification par taille de population
        
        Pour permettre des comparaisons légitimes, les communes sont classées en 3 catégories selon leur population :
        
        - **Petites communes** : moins de 10 000 habitants
        - **Communes moyennes** : 10 000 à 100 000 habitants  
        - **Grandes villes** : plus de 100 000 habitants
        
        Le niveau affiché (0 à 4) reflète le classement **au sein de la catégorie de taille**.
        
        ### Pourquoi cette classification ?
        
        Les petites communes peuvent avoir des taux très élevés avec peu de faits divers.
        
        **Exemple** : Une commune de 50 habitants avec 1 seul fait divers aura un taux de 2 000 pour 100 000 habitants, 
        alors qu'une grande ville avec 200 faits pour 100 000 habitants aura un taux bien plus faible.
        
        Comparer ces deux communes directement serait mathématiquement invalide. La classification par taille 
        résout ce biais en comparant chaque commune à ses **pairs de taille similaire**.
        
        ### Que signifie "pour 100 000 habitants" ?
        
        C'est le standard scientifique international (ONU, études académiques). Les taux sont exprimés en 
        "faits pour 100 000 habitants" au lieu de "pour 1 000" pour faciliter les comparaisons internationales 
        et éviter les confusions avec les pourcentages.
    `
}
```

---

## 5. Tests de Validation

### 5.1 Tests Importer (Obligatoires)

**Fichier de test**: `packages/importer/src/exports/communes/metrics/insecurity/exportMetricsInsecurity.test.ts` (à créer)

**Cas de test**:

```typescript
describe("exportMetricsInsecurity with population classification", () => {
    test("getPopulationCategory classifies correctly", () => {
        expect(getPopulationCategory(5000)).toBe("small");
        expect(getPopulationCategory(50000)).toBe("medium");
        expect(getPopulationCategory(250000)).toBe("large");
        expect(getPopulationCategory(null)).toBe(null);
        expect(getPopulationCategory(0)).toBe(null);
    });
    
    test("Paris is classified as large", () => {
        const paris = findCommune("75056");
        expect(paris.populationCategory).toBe("large");
    });
    
    test("3 témoin communes have correct levelCategory", () => {
        // Small: Commune <10k
        const smallCommune = findCommune("01001"); // Exemple
        expect(smallCommune.populationCategory).toBe("small");
        expect(smallCommune.levelCategory).toBeGreaterThanOrEqual(0);
        expect(smallCommune.levelCategory).toBeLessThanOrEqual(4);
        
        // Medium: Commune 10k-100k
        const mediumCommune = findCommune("38185"); // Grenoble
        expect(mediumCommune.populationCategory).toBe("medium");
        
        // Large: Bordeaux
        const bordeaux = findCommune("33063");
        expect(bordeaux.populationCategory).toBe("large");
        expect(bordeaux.levelCategory).toBe(4);
        expect(bordeaux.rankInCategory).toBe("1/42");
    });
    
    test("indexGlobalNational is identical to old indexGlobal formula", () => {
        // Rétro-compatibilité: la formule nationale n'a pas changé
        const commune = findCommune("75056");
        const oldIndex = calculateOldIndexGlobal(commune);
        expect(commune.indexGlobalNational).toBe(oldIndex);
    });
    
    test("taux are correctly multiplied by 100", () => {
        const commune = findCommune("33063");
        // Ancien: violencesPer1k = 16.3
        // Nouveau: violencesPer100k = 1630
        expect(commune.violencesPersonnesPer100k).toBeCloseTo(1630, 0);
    });
});
```

### 5.2 Tests Frontend (Obligatoires)

**Fichier de test**: `apps/web/components/insecurity-badge.test.tsx` (à créer)

**Cas de test**:

```typescript
describe("InsecurityBadge with population classification", () => {
    test("displays levelCategory as main badge", () => {
        const metric: InsecurityMetric = {
            // ... Bordeaux data ...
            levelCategory: 4,
            levelNational: 3,
            rankInCategory: "1/42",
            populationCategory: "large"
        };
        
        const { getByText } = render(<InsecurityBadge metric={metric} />);
        expect(getByText(/Niveau 4/)).toBeInTheDocument();
        expect(getByText(/1\/42 grandes villes/i)).toBeInTheDocument();
    });
    
    test("tooltip shows both perspectives", () => {
        const metric: InsecurityMetric = {
            // ... data ...
            levelCategory: 4,
            levelNational: 3,
            indexGlobalCategory: 99,
            indexGlobalNational: 99
        };
        
        const { getByRole } = render(<InsecurityBadge metric={metric} />);
        const tooltip = getByRole("tooltip");
        
        expect(tooltip).toHaveTextContent(/Niveau 4/);
        expect(tooltip).toHaveTextContent(/Niveau 3/);
        expect(tooltip).toHaveTextContent(/Percentile national: 99/);
        expect(tooltip).toHaveTextContent(/Percentile catégorie: 99/);
    });
});
```

### 5.3 Tests de Régression (Critiques)

**Vérifications manuelles** (checklist):

- [ ] Bordeaux (33063):
  - [ ] `populationCategory = "large"`
  - [ ] `levelCategory = 4`
  - [ ] `rankInCategory = "1/42"`
  - [ ] Badge affiche "Niveau 4"
  - [ ] Sous-texte affiche "1/42 grandes villes"

- [ ] Paris (75056):
  - [ ] `populationCategory = "large"`
  - [ ] Taux ×100 corrects
  - [ ] `indexGlobalNational` cohérent

- [ ] Petite commune (<10k):
  - [ ] `populationCategory = "small"`
  - [ ] `levelCategory` cohérent
  - [ ] `rankInCategory` format correct

- [ ] Viewport performance:
  - [ ] Aucun freeze au chargement carte
  - [ ] Feature-state update fluide
  - [ ] AbortControllers cleanup OK

---

## 6. Breaking Changes

### 6.1 Schéma de Données JSON

**Incompatibilité**:
- Colonnes renommées: `indexGlobal` → `indexGlobalNational`, `level` → `levelNational`
- 5 nouvelles colonnes: `populationCategory`, `indexGlobalCategory`, `levelCategory`, `rankInCategory`
- Taux ×100: `per1000` → `per100k`

**Impact**:
- **Frontend**: Hook `useInsecurityMetrics` encapsule le changement → transparent pour composants
- **Externe**: Toute consommation directe des JSON est cassée (versioning en place)

### 6.2 Versioning

**Nouveau dataset**: `v2026-02-15` (ou date d'implémentation)

**Migration**:
```json
// apps/web/public/data/current/manifest.json
{
    "version": "v2026-02-15",
    "generatedAt": "2026-02-15T12:00:00Z",
    "previousVersion": "v2026-02-08"
}
```

**Rollback plan**:
- `v2026-02-08` reste accessible en read-only
- Modifier `manifest.json` pour pointer vers ancienne version si nécessaire

### 6.3 Rétro-compatibilité

**Non garanti** pour:
- Accès direct aux fichiers JSON (versioning explicite)
- Champs renommés (`indexGlobal`, `level`)

**Garanti** pour:
- Hook `useInsecurityMetrics` (encapsule la structure)
- Badge component (consomme le hook)
- Formule nationale (identique, juste renommée)

---

## 7. Documentation

### 7.1 Fichiers à Créer

- [x] `specs/security-index-population-classification.md` (ce document)
- [ ] Tests: `packages/importer/src/exports/communes/metrics/insecurity/exportMetricsInsecurity.test.ts`
- [ ] Tests: `apps/web/components/insecurity-badge.test.tsx`

### 7.2 Fichiers à Modifier

**Importer**:
- [ ] `packages/importer/src/exports/communes/metrics/insecurity/exportMetricsInsecurity.ts` (logique principale)
- [ ] `packages/importer/src/exports/shared/insecurityMetrics.ts` → **migrer vers** `apps/web/lib/config/insecurityMetrics.ts`

**Frontend**:
- [ ] `apps/web/lib/config/insecurityMetrics.ts` (config centralisée + `POPULATION_CATEGORIES`)
- [ ] `apps/web/lib/data/insecurityMetrics.ts` (types + hook)
- [ ] `apps/web/components/insecurity-badge.tsx` (affichage dual)
- [ ] `apps/web/lib/data/faqContent.ts` (3 nouvelles sections)

**Documentation**:
- [ ] `docs/METRICS_INSECURITY.md` (méthodologie complète)
- [ ] `docs/ARCHITECTURE.md` (si section métriques mentionnée)
- [ ] `CHANGELOG.md` (breaking change v2)
- [ ] `README.md` (si mention méthodologie)

### 7.3 CHANGELOG.md Entry

```markdown
## [Unreleased]

### BREAKING CHANGES

#### Indice de Sécurité: Classification par Taille de Population

L'indice de sécurité (insécurité) adopte désormais une classification par taille de population 
conforme aux standards internationaux (ONU-ICVS, classements homicides, littérature scientifique).

**Changements schéma JSON**:
- `indexGlobal` renommé en `indexGlobalNational`
- `level` renommé en `levelNational`
- Nouveaux champs: `populationCategory`, `indexGlobalCategory`, `levelCategory`, `rankInCategory`
- Taux exprimés en "pour 100,000 hab" au lieu de "pour 1,000" (×100)

**Impact utilisateur**:
- Badge affiche désormais le niveau **dans la catégorie de taille** (petites/moyennes/grandes)
- Comparaisons légitimes entre communes de tailles similaires
- Bordeaux (1ère ville >100k hab) correctement classée niveau 4

**Migration**:
- Dataset version: `v2026-02-15` (nouvelle structure)
- Ancienne version `v2026-02-08` reste accessible
- Frontend: Mise à jour automatique via hook `useInsecurityMetrics`

**Référence**: `specs/security-index-population-classification.md`
```

---

## 8. Ordre d'Implémentation

### Phase 1: Configuration Centralisée ✅

1. **Créer/modifier** `apps/web/lib/config/insecurityMetrics.ts`:
   - Ajouter `POPULATION_CATEGORIES`
   - Ajouter `getPopulationCategory()`
   - Centraliser constants (importables par importer ET frontend)

### Phase 2: Importer (Data Layer) 🔧

2. **Modifier** `exportMetricsInsecurity.ts`:
   - Importer config centralisée
   - Classifier communes (`populationCategory`)
   - Changer taux: `/1000` → `/100000` (×100)
   - Calculer 3 percentiles (national + 3 catégories)
   - Calculer `rankInCategory`
   - Mettre à jour `OUTPUT_COLUMNS` (12 colonnes)
   - Export JSON nouveau schéma

3. **Mettre à jour** `meta.json`:
   - Ajouter section `populationCategories`

4. **Régénérer** dataset:
   ```bash
   pnpm --filter @choisir-sa-ville/importer export:static
   ```

### Phase 3: Frontend (UI Layer) 🎨

5. **Mettre à jour** types TypeScript:
   - `apps/web/lib/data/insecurityMetrics.ts`
   - Type `InsecurityMetric` avec nouveaux champs

6. **Modifier** hook `useInsecurityMetrics`:
   - Parser 12 colonnes (au lieu de 8)
   - Retourner structure complète

7. **Refactor** badge component:
   - Affichage dual (catégorie + tooltip)
   - Sous-texte rang catégorie

8. **Update** FAQ:
   - 3 nouvelles sections
   - Expliquer classification
   - Expliquer taux/100k

### Phase 4: Tests & Validation ✅

9. **Créer tests** importer:
   - `getPopulationCategory()`
   - 3 témoins (une par catégorie)
   - Bordeaux validation complète
   - Rétro-compatibilité `indexGlobalNational`

10. **Créer tests** frontend:
    - Badge affichage
    - Tooltip contenu
    - Régression viewport

11. **Validation manuelle**:
    - Checklist tests de régression
    - Dev server + sélection Bordeaux
    - Vérifier badge "Niveau 4 - 1/42 grandes villes"

### Phase 5: Documentation 📝

12. **Mettre à jour** documentation:
    - `docs/METRICS_INSECURITY.md`
    - `docs/ARCHITECTURE.md`
    - `CHANGELOG.md`
    - `README.md`

13. **Commit & Push**:
    ```bash
    git add -A
    git commit -m "feat(insecurity): Implement population-based classification
    
    BREAKING CHANGES:
    - Add population categories (small/medium/large)
    - Double indexGlobal (national + category)
    - Change rates from per 1k to per 100k
    - Rename indexGlobal → indexGlobalNational
    - Add 5 new fields to schema
    
    Closes #XXX
    See specs/security-index-population-classification.md"
    ```

---

## 9. Références

### Documents de Recherche

- `doc/RESEARCH-security-index-methodologies.md` — Standards internationaux (Numbeo, ICVS, ONU)
- `doc/ANALYSIS-bordeaux-level-4.md` — Analyse problème initial
- `doc/VALIDATION-population-classification-2026-02-08.md` — Validation PO/Architect

### Standards Internationaux

- **Numbeo Crime Index**: https://numbeo.com/crime/indices_explained.jsp
- **International Crime Victims Survey (ICVS)**: 70+ pays, standard de facto
- **UN Office on Drugs and Crime (UNODC)**: Classements homicides, seuil 300k habitants
- **Wikipedia Crime Statistics**: Synthèse méthodologies internationales

### Code Actuel

- `packages/importer/src/exports/communes/metrics/insecurity/exportMetricsInsecurity.ts` (v2026-02-08)
- `apps/web/lib/config/insecurityMetrics.ts` (constants)
- `apps/web/components/insecurity-badge.tsx` (affichage)

---

## 10. Notes d'Implémentation

### 10.1 Performance

**Impact estimé**:
- **Importer**: +~20% temps calcul (3 passes percentile au lieu d'1)
  - Acceptable (batch offline)
- **Frontend**: Négligeable (parsing 12 colonnes vs 8)
  - Hook encapsule la complexité

### 10.2 Edge Cases

**Communes sans population**:
- `populationCategory = null`
- Pas de `indexGlobalCategory` ni `levelCategory`
- Affichage: Badge "Données insuffisantes"

**Communes avec `scoreRaw = null`**:
- `indexGlobalNational = null`, `levelNational = 0`
- `indexGlobalCategory = null`, `levelCategory = 0`
- `rankInCategory = null`

**Catégories vides** (peu probable):
- Si aucune commune dans une catégorie: skip percentile calculation
- Peu probable (42 grandes villes confirmées)

### 10.3 Future Enhancements (Backlog)

**v2.1 - Perception Index**:
- Ajouter enquête utilisateurs (crowdsourced)
- Crime Index + Safety Index (type Numbeo)
- Double perspective: Stats officielles + Perception

**v2.2 - Arrondissements**:
- Classification ARM/COMD/COMA
- Spec séparée: `specs/zone-safety-insecurity-index-spec.md`

**v2.3 - Métropoles**:
- 4ème catégorie: >1,000,000 habitants
- Alignement sur seuils internationaux avancés

---

## Validation Finale

**Statut**: ✅ **Spec Validée PO/Architect Gatekeeper**

**Citation**:
> "L'Option A (classification par taille de population) est la seule approche scientifiquement valide. 
> La complexité introduite est proportionnelle à la correction d'un biais fondamental qui nuit à la 
> crédibilité du produit."

**Autorisation**: Implémentation approuvée. Suivre l'ordre recommandé (Phase 1 → 5).

---

**Document de référence unique pour l'implémentation.**

_Toute question ou ambiguïté doit être résolue en consultant ce document._
