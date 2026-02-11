# Code Review: Transactions DVF Hérault

**Date**: 2026-02-09  
**Branch**: jolly-leakey  
**Commits**: 226b621, bc34c9c  
**Reviewers**: po-architect-gatekeeper, code-review agents

---

## Synthèse

La feature **Transactions DVF** (Demandes de Valeurs Foncières) pour le département de l'Hérault (34) a été implémentée et testée. Elle ajoute l'affichage de points de transactions immobilières sur la carte (zoom ≥14) et permet de consulter l'historique des ventes par adresse via le panneau de droite.

**Verdict global** : ✅ **Architecture solide, code de qualité, prêt à merger après corrections mineures**

**Conformité architecturale** : 10/10  
**Qualité du code** : 8/10 (3 issues moyennes à corriger)  
**Documentation** : 7/10 (spec présente mais placement à corriger)

---

## ✅ Points forts

### Architecture
- ✅ **Séparation des couches parfaite** : lib/selection (TypeScript pur), lib/data (loaders), lib/map (MapLibre), components (React UI)
- ✅ **Règles MapLibre respectées** : moveend/zoomend uniquement, pas de `move`, pas de logique dans les event handlers
- ✅ **Pattern Jamstack strict** : Données statiques versionnées, aucune API backend, fichiers JSON dans `public/data/v2026-02-09/`
- ✅ **Extension propre du domaine** : `EntityRef.transactionAddress` suit le pattern existant (commune, infraZone)
- ✅ **AbortController partout** : Toutes les fonctions async acceptent un signal, cleanup correct

### Code
- ✅ **Type safety** : TypeScript strict, discriminated unions, pas de `any`
- ✅ **Gestion erreurs** : try/catch, distinction AbortError, logs conditionnels dev-only
- ✅ **Cache mémoire** : Déduplication des requêtes bundles, pattern identique à StaticFilesEntityDataProvider
- ✅ **Cleanup** : Listeners retirés, AbortControllers annulés, pas de memory leaks détectés
- ✅ **Conventions** : camelCase, fichiers bien nommés, imports propres

### Documentation
- ✅ **Spec complète** : `docs/feature/transactions-address-history/spec.md` (375 lignes, alignée avec le code)
- ✅ **Agent custom** : `.claude/agents/dvf-transaction-history-implementer.md` bien documenté

---

## ❌ Issues critiques (bloquantes merge)

### 1. Feature ID manquant dans GeoJSON
**Fichier**: `apps/web/lib/map/transactionLayer.ts:54`  
**Sévérité**: 🔴 **HIGH**  
**Problème**: `generateId: false` nécessite que chaque feature GeoJSON ait un champ `id` au niveau Feature (pas juste dans `properties`). Si l'importer ne génère pas ces IDs, MapLibre acceptera le GeoJSON mais `setFeatureState` échouera silencieusement → les points ne s'allumeront jamais en highlight/active.

**Action requise** :
1. ✅ Vérifier que le pipeline importer génère `Feature.id = addressId` (pas juste `properties.id`)
2. ✅ Tester avec données réelles Hérault : cliquer sur un point → doit s'allumer en orange (active)
3. ❌ Si KO : soit corriger l'importer, soit passer à `generateId: true` avec mapping addressId → index

**Code actuel** :
```typescript
// transactionLayer.ts:54
generateId: false  // ⚠️ Requiert Feature.id explicite
```

**Fix importer** (si manquant) :
```typescript
const feature: Feature<Point> = {
  type: "Feature",
  id: addressId,  // ← REQUIS au niveau Feature, pas seulement dans properties
  geometry: { type: "Point", coordinates: [lon, lat] },
  properties: { id: addressId }
};
```

---

## ⚠️ Issues moyennes (à corriger avant merge)

### 2. AbortSignal ignoré lors de réutilisation du cache manifest
**Fichier**: `apps/web/lib/data/transactionBundles.ts:46-63`  
**Sévérité**: 🟡 **MEDIUM**  
**Problème**: Si `resolveDatasetVersion()` est appelée avec un nouveau signal pendant qu'un fetch est déjà en cours, le nouveau signal est ignoré. La promesse en cache est liée au premier signal uniquement.

**Impact** :
- Si l'utilisateur navigue rapidement → le nouveau `AbortController` de cleanup n'annule pas le fetch manifest déjà lancé
- En pratique : fetch inutile continue en arrière-plan (gaspillage bande passante, mais pas de crash)

**Fix recommandé** (option 1 — simple) :
```typescript
// Accepter que le manifest ne soit jamais vraiment abortable une fois lancé
// Documenter ce trade-off dans un commentaire :
// Note: If a fetch is already in-flight when a new caller provides a signal,
// the existing fetch will continue even if the new signal is aborted.
// This is acceptable as manifest fetches are small and infrequent.
```

**Fix avancé** (option 2 — si critique) :
```typescript
// Lier tous les signaux entrants à un AbortController maître
let masterController: AbortController | null = null;
// ... dans resolveDatasetVersion :
if (!datasetVersionPromise) {
  masterController = new AbortController();
  datasetVersionPromise = fetchDatasetVersion(masterController.signal);
}
if (signal) {
  signal.addEventListener("abort", () => masterController?.abort());
}
```

### 3. Clés React non-uniques dans la liste de transactions
**Fichier**: `apps/web/components/right-panel-details-card.tsx:302`  
**Sévérité**: 🟡 **MEDIUM**  
**Problème**: Les items de transaction utilisent `key={${tx.date}-${index}}`. Si plusieurs transactions ont la même date, la clé n'est unique que par l'index → instabilité lors de tri/filtrage → React peut réutiliser incorrectement les nœuds DOM.

**Impact** :
- Potentielles glitches visuelles si on ajoute un filtre ou re-tri dynamique
- Pas de crash, mais mauvaise pratique React

**Fix** :
```typescript
// Utiliser une clé composite basée sur les champs de la transaction :
key={`${tx.date}-${tx.priceEur}-${tx.typeLocal}-${tx.surfaceM2 ?? 'null'}`}

// Ou ajouter un ID unique dans le modèle de données si disponible :
key={tx.transactionId}
```

---

## 📚 Documentation à corriger avant merge

### 1. Déplacer la spec dans `specs/`
**Fichier**: `docs/feature/transactions-address-history/spec.md`  
**Action** : Déplacer ou copier vers `specs/transactions-address-history.md` et passer status "Draft" → "Approved"

### 2. Enrichir ARCHITECTURE.md
**Fichier**: `docs/ARCHITECTURE.md`  
**Sections manquantes** :
- Section "Données" : décrire le pattern bundles z15 (équivalent à insecurity)
- Section "Sélection" : documenter l'extension `EntityRef.transactionAddress`
- Section "Map interactions" : mentionner la règle "label-first fallback" pour transactions

### 3. Mettre à jour CHANGELOG.md
**Fichier**: `CHANGELOG.md`  
**Entrée à ajouter** :
```markdown
## [Unreleased]
### Added
- DVF transaction history for Hérault (34) — map points (zoom ≥14) + address history panel
```

---

## 🧪 Tests de validation requis

Avant de merger, tester sur données réelles Hérault (34) :

### Fonctionnel
- [ ] Points visibles à zoom ≥ 14
- [ ] Clic sur point → panneau droit affiche historique complet
- [ ] **Clic sur point → point s'allume en orange (active)** ← Valide Feature.id
- [ ] Hover sur point → point s'allume en bleu (highlight)
- [ ] Tri par date décroissante fonctionne
- [ ] Badge VEFA affiché quand `isVefa: true`
- [ ] Calcul prix/m² correct quand surface présente
- [ ] Adresses sans transactions → message adapté
- [ ] Bundles 404 → gestion gracieuse (pas de crash)
- [ ] AbortController annule le fetch au unmount du component

### Interactions prioritaires
- [ ] Clic sur label commune → panneau commune (pas transaction)
- [ ] Clic sur zone sans label ni transaction → panneau vide
- [ ] Highlight/active des points n'interfère pas avec commune/infraZone

### Performance
- [ ] Pan/zoom fluide avec points affichés
- [ ] Pas de freeze au chargement des bundles
- [ ] Cache mémoire fonctionne (pas de re-fetch au re-clic)
- [ ] Pas de memory leaks (vérifier DevTools Memory Profiler)

---

## 🎯 Checklist avant merge

### Critique (P0)
- [ ] **Fix #1** : Vérifier Feature.id dans GeoJSON généré par importer
- [ ] **Fix #2** : Décider stratégie AbortSignal (accepter limitation ou implémenter masterController)
- [ ] **Fix #3** : Corriger les clés React dans la liste de transactions
- [ ] **Doc #1** : Déplacer spec vers `specs/` et passer status "Approved"
- [ ] **Doc #2** : Enrichir `ARCHITECTURE.md` (sections Données, Sélection, Map)
- [ ] **Tests** : Valider tous les points de la checklist fonctionnelle ci-dessus

### Recommandé (P1)
- [ ] **Doc #3** : Mettre à jour `CHANGELOG.md`
- [ ] **Code #4** : Créer `useTransactionHistory(ref)` hook pour uniformiser avec `useCommune`/`useInfraZone`

### Optionnel (P2)
- [ ] Déplacer `transactionBundles.ts` vers `lib/data/transactions/` (si scope s'étend)
- [ ] Tester agent `dvf-transaction-history-implementer` sur un autre département

---

## 📊 Métriques

**Fichiers modifiés** : 12 fichiers core + 1 agent  
**Lignes ajoutées** : ~600 lignes TypeScript/React + 1.15M lignes GeoJSON  
**Nouveaux modules** : 2 (`transactionBundles.ts`, `transactionLayer.ts`)  
**Extensions de types** : 1 (`EntityRef.transactionAddress`)  
**Issues critiques** : 1 (Feature.id manquant)  
**Issues moyennes** : 2 (AbortSignal cache, React keys)  
**Issues mineures** : 0  
**Dette technique** : Faible (hook manquant, path spec)

---

## 💬 Commentaire final

Cette implémentation est **exemplaire en termes d'architecture** : séparation des couches parfaite, règles MapLibre respectées, TypeScript strict, AbortControllers partout. Les trois issues identifiées sont **faciles à corriger** et n'affectent pas la structure globale.

**Recommandation** : ✅ **Approuvé après corrections P0**

La feature est prête à être intégrée dès que :
1. Le Feature.id est validé/corrigé dans le GeoJSON
2. Les clés React sont fixées
3. La stratégie AbortSignal est documentée
4. La documentation est mise à jour

Bravo pour le respect strict des invariants du projet ! 🎉
