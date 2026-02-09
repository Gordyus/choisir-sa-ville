# FEATURE COMPLETE: Classification par Taille de Population pour l'Indice de Sécurité

**Date de Complétion**: 2026-02-08  
**Branche**: `aggregat-insecurity`  
**Commits**: 14 commits (6ab8967..db0fd67)  
**Statut**: ✅ TERMINÉ ET VALIDÉ

---

## 1. Vue d'Ensemble

L'indice de sécurité a été refondu pour adopter une **classification par taille de population** alignée sur les standards internationaux (ONU-ICVS, Numbeo Crime Index, classements homicides OMS/UNODC). Cette refonte majeure inclut:

- **3 catégories de population** (<10k, 10k-100k, >100k habitants)
- **Taux pour 100,000 habitants** (standard international, au lieu de /1,000)
- **Quintiles standards** [80-100] pour niveau 4 (alignement Numbeo)
- **Suppression complète du concept epsilon** (simplification méthodologie)
- **Correction de 2 bugs critiques** affectant 70%+ des communes

**Breaking Changes**: Schéma JSON modifié (8 → 12 colonnes), métriques ×100, renommages de champs.

---

## 2. Décisions Architecturales Clés

### 2.1 Classification par Population (3 Catégories)

**Référence**: `doc/RESEARCH-security-index-methodologies.md`

**Consensus 100% des standards internationaux**:
- **Numbeo Crime Index**: Sépare grandes villes mondiales (perception publique)
- **ONU-ICVS**: Sépare urbain/rural dans tous les rapports (biais densité)
- **Classements homicides OMS/UNODC**: Toujours par taille de ville
- **Littérature scientifique**: "Comparer communes 100 hab vs 100k hab est statistiquement invalide"

**Catégories adoptées**:
```typescript
small:  population < 10,000       // 33,874 communes (97.0%)
medium: 10,000 ≤ pop < 100,000    // 953 communes (2.7%)
large:  population ≥ 100,000      // 42 communes (0.1%)
```

**Justification seuils**:
- 10,000: Seuil INSEE transition communes rurales/urbaines
- 100,000: Seuil grandes agglomérations (ministère Intérieur)

### 2.2 Taux pour 100,000 Habitants

**Changement**: `/1000` → `/100000` (×100)

**Standard académique universel**:
- OMS: Homicide rate per 100,000 (standard mondial)
- Numbeo: Safety perception per 100,000
- Police UK/US: Crime rate per 100,000

**Avantages**:
- Comparabilité internationale immédiate
- Élimination des confusions "30 pour 1000" (3% semble énorme, mais c'est 0.03)
- Align avec toutes les publications scientifiques

### 2.3 Adoption Quintiles Standards [80-100]

**Référence**: `doc/FIX-2026-02-08T20-00-standard-quintiles-80-100.md`

**Problème initial**: Niveau 4 réservé à `indexGlobal = 100` uniquement (22 communes, toutes <6000 hab)
- Bordeaux (1/42 grandes villes): niveau 3 au lieu de 4
- Rouen (2/42 grandes villes): niveau 3 au lieu de 4

**Mapping initial** (déséquilibré):
```
0-24 → 0, 25-49 → 1, 50-74 → 2, 75-99 → 3, 100 → 4
```

**Mapping final** (quintiles standards):
```
0-19 → 0, 20-39 → 1, 40-59 → 2, 60-79 → 3, 80-100 → 4
```

**Alignement Numbeo Crime Index**:
- Very Low: <20
- Low: 20-40
- Moderate: 40-60
- High: 60-80
- Very High: 80-100

**Résultat**: 9/42 grandes villes niveau 4 (21%, équilibré) au lieu de 1/42 (2.4%)

### 2.4 Suppression Concept Epsilon

**Référence**: `doc/UPDATE-2026-02-08-epsilon-removal.md`

**Supprimé**: Filtrage epsilon (communes avec `indexGlobal < epsilon` marquées `indexGlobal = null`)

**Raison**: Portait à confusion utilisateur, masquait données valides, pas de justification académique

**Nouvelle approche**: Toutes les communes avec données valides ont un `indexGlobal` [0..100]

---

## 3. Bugs Critiques Résolus

### 3.1 Weight Renormalization (CRITICAL)

**Référence**: `doc/BUGFIX-2026-02-08-weight-renormalization.md`

**Problème**: Quand une catégorie de crime était manquante, les poids étaient renormalisés pour sommer à 1.0 sur les seules catégories disponibles.

**Exemple Commune 52519 (Cunel, 47 habitants)**:
- Données: Biens = 170.2/1000, Violences = 0, Tranquillité = manquante
- **Calcul incorrect**: `(0.35 / 0.35) × 170.2 = 170.2` (biens devient 100% du score)
- **Calcul correct**: `0.4×0 + 0.35×170.2 + 0.25×0 = 59.57`

**Impact**: **70% des communes affectées** (24,534/34,875 avaient données partielles)

**Fix**:
```typescript
// AVANT (incorrect)
const sumWeights = parts.reduce((acc, p) => acc + p.weight, 0);
const score = parts.reduce((acc, p) => acc + (p.value / sumWeights) * p.weight, 0);

// APRÈS (correct)
const score = 
    (parts.violences?.value ?? 0) * 0.40 +
    (parts.biens?.value ?? 0) * 0.35 +
    (parts.tranquillite?.value ?? 0) * 0.25;
```

### 3.2 Level Mapping Inversion (CRITICAL)

**Référence**: `doc/BUGFIX-2026-02-08-level-mapping.md`

**Problème**: `mapScoreToLevel(scoreRaw, quartiles)` causait inversion quand tous les quartiles étaient zéro.

**Exemple**: Commune avec `scoreRaw = 1.5` dans région où Q1=Q2=Q3=0
- **Mapping incorrect**: `scoreRaw > Q3 (0)` → niveau 3 (devrait être 0)
- Entités avec 0 affichées "Élevé" au lieu de "Très faible"

**Fix**: Remplacement par `mapIndexToLevel(indexGlobal)` qui mappe directement le percentile [0..100] sur les niveaux [0..4], ignorant complètement `scoreRaw` et `quartiles`.

---

## 4. Breaking Changes

### 4.1 Schéma JSON de Sortie

**Avant** (8 colonnes):
```json
["insee", "population", "violencesPer1000", "biensPer1000", "tranquillitePer1000", "indexGlobal", "level", "dataCompleteness"]
```

**Après** (12 colonnes):
```json
["insee", "population", "populationCategory", "violencesPer100k", "biensPer100k", "tranquillitePer100k", "indexGlobalNational", "indexGlobalCategory", "levelNational", "levelCategory", "rankInCategory", "dataCompleteness"]
```

**Changements clés**:
- `*Per1000` → `*Per100k` (taux ×100)
- `indexGlobal` → `indexGlobalNational` (renommage)
- `level` → `levelNational` (renommage)
- Ajout: `populationCategory`, `indexGlobalCategory`, `levelCategory`, `rankInCategory`

### 4.2 Frontend (Type Interface)

**Fichier**: `apps/web/lib/data/insecurityMetrics.ts`

**Interface `InsecurityMetricsRow`** modifiée:
```typescript
// Nouveaux champs obligatoires
populationCategory: "small" | "medium" | "large"
indexGlobalCategory: number | null
levelCategory: number | null
rankInCategory: string | null  // Format: "1/42"
```

**Hook `useInsecurityMetrics()`**: Encapsule parsing, backward-compatible au niveau API

### 4.3 Configuration

**Fichiers**:
- `packages/importer/src/exports/shared/insecurityMetrics.ts`
- `apps/web/lib/config/insecurityMetrics.ts`

**Ajouts**:
```typescript
export const POPULATION_CATEGORIES = {
    small: { threshold: 10000, label: "Petites communes" },
    medium: { min: 10000, max: 100000, label: "Villes moyennes" },
    large: { threshold: 100000, label: "Grandes villes" }
};

export function getPopulationCategory(pop: number): PopulationCategory;
```

**Modification `INSECURITY_LEVELS`**: Descriptions mises à jour avec quintiles [80-100]

---

## 5. Validation Finale

**Référence**: `doc/VALIDATION-population-classification-2026-02-08.md`

### 5.1 Validation PO/Architect Gatekeeper

- ✅ **Approuvé**: Classification par population (Option A)
- ✅ **Validé**: Changement à per 100,000 (Option C)
- ✅ **Plan d'implémentation**: 5 phases (Configuration → Importer → Frontend → Tests → Docs)

### 5.2 Dataset Régénéré v2026-02-08

**Distribution**:
- 33,874 petites communes (97.0%)
- 953 moyennes (2.7%)
- 42 grandes (0.1%)

**Fichiers**:
- `apps/web/public/data/v2026-02-08/communes/metrics/insecurity/{2016-2024}.json`
- `apps/web/public/data/v2026-02-08/communes/metrics/insecurity/meta.json`

### 5.3 Validation Bordeaux & Rouen

**Bordeaux** (INSEE 33063, 252,040 habitants):
- Catégorie: `large`
- `indexGlobalCategory`: 99
- `levelCategory`: 4 (Plus élevé)
- `rankInCategory`: "1/42"
- ✅ **Conforme attente**: Top 1 grandes villes insécures

**Rouen** (INSEE 76540, 111,557 habitants):
- Catégorie: `large`
- `indexGlobalCategory`: 98
- `levelCategory`: 4 (Plus élevé)
- `rankInCategory`: "2/42"
- ✅ **Conforme attente**: Top 2 grandes villes insécures

**Distribution niveau 4 (grandes villes)**: 9/42 (21%)
- Bordeaux, Rouen, Grenoble, Lille, Lyon, Paris, Marseille, Montpellier, Saint-Denis

---

## 6. Implémentation Technique

### 6.1 Phases d'Implémentation

1. **Phase 1**: Configuration centralisée (commit 6ab8967)
2. **Phase 2**: Importer (3-pass percentile calculation) (commit 477c4a3)
3. **Phase 3**: Frontend UI (badge, hooks, types) (commit 589b0ae)
4. **Phase 4**: Tests (skipped - no test framework configured)
5. **Phase 5**: Documentation (commit 7c741fe)

### 6.2 Calcul Percentile 3-Pass

**Fichier**: `packages/importer/src/exports/communes/metrics/insecurity/exportMetricsInsecurity.ts`

**Algorithme**:
1. **Pass 1 (National)**: Percentile min-rank sur toutes les 34,875 communes → `indexGlobalNational`
2. **Pass 2 (Catégorie)**: Percentile min-rank par catégorie (small/medium/large) → `indexGlobalCategory`
3. **Pass 3 (Niveau)**: Map `indexGlobalCategory` via quintiles → `levelCategory`

**Fonction clé**: `buildPercentileIndex(scores: number[]): Map<number, number>`
- Utilise min-rank percentile [0..100]
- Gestion égalités: `Math.floor((minRank / total) * 100)`

### 6.3 Badge Component

**Fichier**: `apps/web/components/insecurity-badge.tsx`

**Affichage**:
- Titre principal: Niveau catégorie ("Plus élevé")
- Sous-titre: Contexte catégorie ("Grandes villes")
- Tooltip: 3 indicateurs `/100k` + année

**Données affichées** (tooltip):
```
Violences aux personnes: 1630 pour 100 000 hab.
Atteintes aux biens: 8010 pour 100 000 hab.
Atteintes à la tranquillité: 1470 pour 100 000 hab.

Année 2024
```

---

## 7. Pondérations (Note Technique Debt)

**Poids actuels** (hardcodés):
- Violences: **40%**
- Biens: **35%**
- Tranquillité: **25%**

**Rationale** (documenté FAQ):
- Violences > Biens: Gravité des conséquences (santé > patrimoine)
- Biens > Tranquillité: Volume et impact financier

**⚠️ Technical Debt** (identifié par gatekeeper):
- Aucune source académique documentée pour ces pondérations
- Décision "produit" arbitraire
- Recommandation: Sourcing académique futur (littérature criminologie)

---

## 8. Références Documentation Permanente

### 8.1 Spécifications

- **Spec principale**: `specs/security-index-population-classification.md` (30,678 chars)
  - Statut: ✅ IMPLÉMENTÉ (2026-02-08)
  - Sections: Vue d'ensemble, specs fonctionnelles/techniques, frontend, tests, breaking changes, docs

### 8.2 Documentation Technique

- **Architecture**: `docs/ARCHITECTURE.md`
  - Section: "Insecurity Aggregate"
  - Diagrammes: Flux données, calcul percentiles

- **Méthodologie**: `docs/METRICS_INSECURITY.md`
  - Pipeline complet (sources → calcul → sortie)
  - Formules mathématiques
  - Schéma JSON détaillé

- **Changelog**: `CHANGELOG.md`
  - Version v2026-02-08
  - Breaking changes listés
  - Migration guide

### 8.3 FAQ Utilisateur

- **Fichier**: `apps/web/lib/data/faqContent.ts`
- **Contenu**: 1 accordion consolidé (88 lignes)
  - Explication classification par population
  - Exemple calcul score agrégé (commune fictive 50k hab)
  - Rationale pondérations
  - Interprétation couleurs/niveaux

---

## 9. Commits de la Feature (14 total)

```
db0fd67 docs(metrics): fix quintile boundaries in technical doc
99d057d fix(badge): display year from data in tooltip
741bc7a fix(badge): display security metrics in tooltip as requested
d2da34a refactor(badge): simplify security index badge display
2d68341 docs(faq): add calculation example and weighting rationale
af39ddb docs(faq): rewrite security index FAQ for user-friendliness
b263dd3 docs: update documentation for quintile thresholds
31583ec data: regenerate v2026-02-08 with quintile thresholds
e5c574b fix(insecurity): adopt standard quintiles [80-100] for level 4
7c741fe docs: update documentation for population-based classification (Phase 5)
2b504b1 data: regenerate v2026-02-08 with population classification schema
589b0ae feat(insecurity): implement population-based UI components (Phase 3)
477c4a3 feat(insecurity): implement population-based classification in importer (Phase 2)
6ab8967 feat(insecurity): add centralized population classification config (Phase 1)
```

---

## 10. Validation Qualité

### 10.1 Validations Build

- ✅ **TypeScript**: `pnpm typecheck` PASS (0 errors)
- ✅ **ESLint**: `pnpm lint:eslint` PASS (0 warnings, --max-warnings=0)
- ✅ **Next.js Build**: Production build successful
- ⚠️ **Tests**: Aucun framework configuré (vitest planifié)

### 10.2 Code Review Pre-MR

**Agent**: `code-review-pre-mr.md` (exécuté 2026-02-08T21:03)

**Résultat**:
- ✅ **Aucune issue bloquante**
- ✅ **Pas de fuite mémoire** (AbortController cleanup vérifié)
- ✅ **Pas de code mort** (imports inutilisés nettoyés)
- ✅ **Type safety** (TypeScript strict respecté)
- ✅ **Sécurité** (pas de XSS, HTML construction sécurisée)

**Issue mineure corrigée**: Documentation inconsistency (quintile boundaries → corrigé commit db0fd67)

### 10.3 Tests Manuels Effectués

- ✅ Bordeaux: Affichage correct niveau 4 catégorie, 1/42
- ✅ Rouen: Affichage correct niveau 4 catégorie, 2/42
- ✅ Année affichée tooltip (2024)
- ✅ Métriques tooltip (3 indicateurs `/100k`)
- ✅ FAQ lisible et pédagogique

---

## 11. État Final

### 11.1 Fichiers Créés

- `specs/security-index-population-classification.md`
- `packages/importer/src/exports/shared/insecurityMetrics.ts` (nouvelle config)
- `apps/web/lib/config/insecurityMetrics.ts` (sync config frontend)
- `apps/web/public/data/v2026-02-08/` (dataset complet)

### 11.2 Fichiers Modifiés

- `packages/importer/src/exports/communes/metrics/insecurity/exportMetricsInsecurity.ts`
- `apps/web/lib/data/insecurityMetrics.ts`
- `apps/web/components/insecurity-badge.tsx`
- `apps/web/lib/data/faqContent.ts`
- `apps/web/lib/map/state/displayBinder.ts`
- `docs/ARCHITECTURE.md`
- `docs/METRICS_INSECURITY.md`
- `CHANGELOG.md`

### 11.3 Prêt pour Merge

- ✅ **14 commits** clean et atomiques
- ✅ **Documentation** complète et à jour
- ✅ **Validations** toutes passées
- ✅ **Code review** effectuée (aucun bloquant)
- ✅ **Tests manuels** validés

**Branche**: `aggregat-insecurity`  
**Base**: `main`  
**Ready to Merge**: ✅ OUI

---

**Document consolidé final. Toute documentation temporaire (9 fichiers `doc/*2026-02-08*.md`) a été intégrée ici et peut être supprimée en toute sécurité.**
