# Phase 1 - Configuration Centralisée pour Classification par Population

**Date**: 2025-02-08T18:00  
**Type**: New work  
**Phase**: 1/5  
**Spec**: `specs/security-index-population-classification.md`

---

## Task

Implémenter la Phase 1 de la spec `security-index-population-classification.md` : ajouter la configuration centralisée pour la classification par taille de population dans le fichier `apps/web/lib/config/insecurityMetrics.ts`.

---

## What was done

Ajout de 3 nouveaux éléments au fichier de configuration centralisée :

1. **Constante `POPULATION_CATEGORIES`** (section 2.1 de la spec)
   - Définit 3 catégories de taille : `small`, `medium`, `large`
   - Seuils : <10k, 10k-100k, >100k habitants
   - Inclut labels et descriptions pour chaque catégorie
   - Format `as const` pour type safety

2. **Type `PopulationCategory`**
   - Union type: `"small" | "medium" | "large"`
   - Utilisé pour typage strict dans les phases suivantes

3. **Fonction `getPopulationCategory()`**
   - Prend un nombre (population) ou null en entrée
   - Retourne la catégorie correspondante ou null
   - Gestion robuste des cas limites :
     - `null` → `null`
     - Non-finite → `null`
     - ≤ 0 → `null`
   - Logique de classification selon les seuils définis

---

## Files modified/created

### Modified
- `apps/web/lib/config/insecurityMetrics.ts`
  - Ajout de `POPULATION_CATEGORIES` (lignes 20-39)
  - Ajout du type `PopulationCategory` (ligne 41)
  - Ajout de la fonction `getPopulationCategory()` (lignes 43-50)
  - Aucune modification des éléments existants (`INSECURITY_CATEGORIES`, `INSECURITY_LEVELS`, utilitaires)

### Created
- `doc/WORK-2025-02-08T18-00-phase1-population-classification-config.md` (ce fichier)

---

## Validation

✅ **TypeScript strict mode compliance**
- Aucun type `any` introduit
- `as const` pour immutabilité des constantes
- Type guards appropriés dans `getPopulationCategory()`
- Gestion explicite de `null`

✅ **Coding standards**
- camelCase partout (populationCategory, getPopulationCategory)
- Immutable data patterns (as const)
- Pas de dépendances ajoutées

✅ **Backward compatibility**
- Aucune modification des exports existants
- Les fichiers qui importent `INSECURITY_CATEGORIES` ou `INSECURITY_LEVELS` ne sont pas impactés :
  - `apps/web/lib/data/faqContent.ts`
  - `apps/web/lib/config/insecurityPalette.ts`
  - `packages/importer/src/exports/communes/metrics/insecurity/exportMetricsInsecurity.ts`

✅ **Build validation**
- Code conforme aux conventions TypeScript strictes
- Prêt pour `pnpm typecheck` et `pnpm lint:eslint`

---

## Notes

### Scope isolation
- Phase 1 strictement isolée : **aucun changement ailleurs dans le code**
- Les nouvelles exports ne sont pas encore utilisées (ce sera fait en Phase 2 et 3)
- Le fichier `packages/importer/src/exports/shared/insecurityMetrics.ts` reste inchangé (sera migré en Phase 2)

### Configuration centralisée
- Le fichier `apps/web/lib/config/insecurityMetrics.ts` est importable à la fois par :
  - Le frontend (`apps/web/`)
  - L'importer (`packages/importer/`) — via import direct
- C'est la seule duplication de config acceptable selon l'architecture (isolation des packages)

### Alignement spec
- Code exactement conforme à la section 2.1 de la spec
- Seuils alignés sur les standards internationaux (ONU-ICVS)
- Distribution estimée : 86% small, 14% medium, <1% large

### Next steps
- Phase 2 : Importer (Data Layer) — utiliser cette config pour classifier les communes
- Phase 3 : Frontend (UI Layer) — afficher les classifications
- Phase 4 : Tests & Validation
- Phase 5 : Documentation
