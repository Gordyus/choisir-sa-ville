# Validation PO/Architect: Classification par Taille de Population

**Date**: 2026-02-08  
**Statut**: ✅ **APPROUVÉ**  
**Commit**: eca9c67 (Epsilon removal + weight renormalization fix)

---

## 🎯 Décision Finale

### ✅ **VALIDÉ: Option A - Classification par Taille de Population**

**Le PO/Architect gatekeeper a approuvé l'implémentation complète de la classification par taille**, alignée sur 100% des standards internationaux (ONU-ICVS, classements homicides, littérature scientifique).

---

## 📋 Ce Qui A Été Validé

### 1. Classification en 3 Catégories

```typescript
type PopulationCategory = "small" | "medium" | "large";

// Seuils approuvés:
small:  <10,000 habitants      (ex: villages, petites communes)
medium: 10,000-100,000 hab     (ex: villes moyennes)
large:  >100,000 habitants     (ex: Bordeaux, Lyon, Paris)
```

### 2. Double IndexGlobal

**Nouveau schéma de sortie**:
```json
{
    "insee": "33063",
    "population": 252040,
    "populationCategory": "large",
    "violencesPersonnesPer100k": 1630,      // CHANGÉ: /100k au lieu de /1k
    "securiteBiensPer100k": 8010,           // CHANGÉ
    "tranquillitePer100k": 1470,            // CHANGÉ
    "indexGlobalNational": 99,              // RENOMMÉ: ancien indexGlobal
    "indexGlobalCategory": 99,              // NOUVEAU: percentile dans catégorie
    "levelNational": 3,                     // RENOMMÉ: ancien level
    "levelCategory": 4,                     // NOUVEAU: niveau dans catégorie
    "rankInCategory": "1/42",               // NOUVEAU: 1ère des 42 villes >100k
    "dataCompleteness": 1.0
}
```

### 3. Affichage UI (Badge)

**Badge principal**: Affiche **niveau catégorie** (métrique légitime)
```
┌─────────────────────────────────────┐
│ Niveau 4 – Plus élevé               │
│ 1/42 grandes villes                 │
└─────────────────────────────────────┘
```

**Tooltip détaillé** (au hover):
```
Niveau 4 (grandes villes)
Niveau 3 (classement national)
Percentile national: 99
Percentile catégorie: 99
```

**Principe**: KISS (Keep It Simple) - Pas de toggle compliqué

### 4. Standard "pour 100,000"

✅ **VALIDÉ**: Passer de "pour 1,000" à "pour 100,000 habitants"
- Standard scientifique universel
- Impact cosmétique: ×100 tous les taux
- Bordeaux: 80.1/1000 → 8010/100k
- À implémenter **en même temps** que la classification (même breaking change)

---

## ❌ Ce Qui A Été Refusé

### Option B comme Solution Finale

**REFUSÉ**: Élargir niveau 4 à `indexGlobal >= 99` (au lieu de = 100)

**Raison**: Patch cosmétique qui masque le problème sans le résoudre. Dette technique malhonnête.

**Exception**: Acceptable **uniquement en transition court terme** (1 sprint max) si implémentation Option A nécessite du temps. Doit être documentée explicitement comme dette technique temporaire.

---

## 🚀 Plan d'Implémentation Approuvé

### Phase 1: Spécification (AVANT de coder)

**Créer**: `specs/security-index-population-classification.md`

**Contenu**:
- Décisions architecturales
- Schéma avant/après détaillé
- Algorithme de classification
- Rationale scientifique (synthèse RESEARCH.md)
- Breaking changes explicites

### Phase 2: Importer (Data Layer)

**Fichier principal**: `packages/importer/src/exports/communes/metrics/insecurity/exportMetricsInsecurity.ts`

**Modifications**:
1. Centraliser config: `POPULATION_CATEGORIES` et `getPopulationCategory()`
2. Changer taux: `/1000` → `/100000` (×100)
3. Algorithme 3 passes:
   - Pass 1: Percentile national (comme actuellement)
   - Pass 2: Percentile par catégorie (filtrer par `populationCategory`)
   - Pass 3: Rank absolu dans catégorie (`rankInCategory`)
4. Nouveau OUTPUT_COLUMNS (12 colonnes)
5. Régénérer dataset (nouvelle version)

### Phase 3: Frontend (UI Layer)

**Fichiers à modifier**:
- Types TypeScript
- `useInsecurityMetrics` hook
- Badge component (affichage dual)
- FAQ (3 nouvelles sections)

**Badge component structure**:
```tsx
// Badge principal: CATÉGORIE uniquement
<Badge variant={getLevelVariant(data.levelCategory)}>
    Niveau {data.levelCategory} – {INSECURITY_LEVELS[data.levelCategory].label}
</Badge>

// Sous-texte contextuel
<Text variant="muted">
    {data.rankInCategory} {POPULATION_CATEGORIES[data.populationCategory].label}
</Text>

// Tooltip détaillé (au hover)
<Tooltip>
    <p>Niveau {data.levelCategory} ({catégorie})</p>
    <p>Niveau {data.levelNational} (national)</p>
    <p>Percentiles: {indexGlobalCategory} / {indexGlobalNational}</p>
</Tooltip>
```

### Phase 4: Tests de Régression (NON NÉGOCIABLES)

**Importer**:
- Valider Paris: `populationCategory = "large"`
- 3 témoins (une commune par catégorie) → `levelCategory` cohérent
- **Bordeaux**: `levelCategory = 4`, `rankInCategory = "1/42"`
- `indexGlobalNational` identique ancien `indexGlobal` (rétro-compatibilité formule)

**Frontend**:
- Badge affiche "Niveau 4" pour Bordeaux
- Sous-texte: "1/42 grandes villes"
- Tooltip contient 2 perspectives
- Pas de régression viewport perf

### Phase 5: Documentation

**À créer**:
- `specs/security-index-population-classification.md`

**À modifier**:
- `docs/METRICS_INSECURITY.md` (nouvelle méthodologie)
- `docs/ARCHITECTURE.md` (si section métriques)
- `CHANGELOG.md` (breaking change v2)

---

## 📌 Breaking Changes Explicites

### Schéma JSON

**Renommages**:
- `indexGlobal` → `indexGlobalNational`
- `level` → `levelNational`

**Nouveaux champs**:
- `populationCategory`: "small" | "medium" | "large"
- `indexGlobalCategory`: number (percentile catégorie)
- `levelCategory`: number (0-4)
- `rankInCategory`: string ("1/42", "23/15345")

**Changement métrique**:
- `violencesPersonnesPer1000` → `violencesPersonnesPer100k` (×100)
- `securiteBiensPer1000` → `securiteBiensPer100k` (×100)
- `tranquillitePer1000` → `tranquillitePer100k` (×100)

### Versioning

**Nouveau dataset**: `v2026-02-15` (ou date implémentation)
- `manifest.json` pointe vers nouvelle version
- Ancienne version `v2026-02-08` reste accessible (audit trail)
- Migration transparente (fetch automatique via manifest)

---

## 🎓 Justification Scientifique (Synthèse)

### Standards Internationaux (100% Consensus)

**Numbeo Crime Index**:
- Bordeaux: 49.8 (Moderate) - 9ème ville France
- **Pas top 1 absolu** selon perception

**ONU-ICVS** (70+ pays):
- Classification par catégorie **OBLIGATOIRE**
- Jamais de classement "toutes tailles ensemble"

**Classements Homicides Internationaux**:
- Seuil minimum: **300,000 habitants**
- Évite biais petites populations

**Standard Scientifique**:
- Taux **pour 100,000 habitants** (universel)
- Facilite comparaisons internationales

### Biais Fondamental Résolu

**Problème actuel**:
- Commune 30 hab + 1 fait divers = 33.3/1000
- Bordeaux 252k hab + 1 fait divers = 0.004/1000
- **Comparaison illégitime** (biais mécanique)

**Solution validée**:
- Bordeaux comparée uniquement aux 42 villes >100k
- Niveau 4 catégorie = top 1% **parmi ses pairs**
- Légitime scientifiquement

---

## 📅 Prochaines Actions

### Immédiat (Avant de coder)

1. **Créer spec détaillé**: `specs/security-index-population-classification.md`
   - Référence unique pour implémentation
   - Documenter toutes les décisions
   - Schéma JSON avant/après
   - Algorithme détaillé

### Court Terme (Sprint actuel ou suivant)

2. **Implémenter Option A + Option C**
   - Suivre ordre recommandé (spec → importer → frontend → tests → doc)
   - Un seul breaking change pour les deux évolutions
   - Tests de régression complets

### Backlog Future (v2)

3. **Ticket recherche produit**: Perception Index (type Numbeo)
   - Priorité basse
   - Complément à stats officielles
   - Répond à "où fait bon vivre" de manière holistique

4. **Ticket future**: Classification arrondissements (ARM/COMD/COMA)
   - Phase ultérieure
   - Éviter scope creep maintenant

---

## ✅ Validation Finale

**Status**: ✅ **APPROUVÉ ARCHITECTURALEMENT ET PRODUIT**

**Citation PO/Architect**:
> "L'Option A (classification par taille de population) est la seule approche scientifiquement valide. La complexité introduite est proportionnelle à la correction d'un biais fondamental qui nuit à la crédibilité du produit."

**Autorisation**: **Vous pouvez procéder à l'implémentation** en suivant l'ordre recommandé.

---

**Document de référence pour implémentation.**
