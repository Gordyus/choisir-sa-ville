# Task (Futur) — SSMSI : Étendre insécurité au niveau arrondissement

## Contexte

Actuellement, l'export `communes/metrics/insecurity/{year}.json` **agrège les données au niveau commune pivot uniquement**, même pour les grandes villes avec arrondissements (Paris, Lyon, Marseille).

Le Parquet SSMSI contient des codes ARM (Arrondissements municipaux) comme données sources, mais ils sont :
- Fusionnés dans les totaux de la commune parent lors de l'agrégation
- Affichés sur la carte avec les mêmes couleurs que la commune
- Jamais exportés de manière granulaire

## Objectif (Futur)

Étudier et implémenter la **possibilité d'afficher l'insécurité au niveau arrondissement**, permettant :
- Un export séparé `infra-zones/metrics/insecurity/{year}.json` pour les ARM/COMD/COMA
- Une coloration carto granulaire (commune ≠ arrondissement si insécurité différente)
- Une cohérence avec le modèle territorial existant (commune pivot + infra-zones)

## Portée (À Définir)

### Points d'étude

1. **Couverture Parquet** :
   - Pour chaque commune multi-arrondissements (Paris, Lyon, Marseille) : distribution des faits par ARM
   - Suffisamment de granularité pour calculer des scores significatifs ?
   - Risque de petits effectifs / non-diffusé pour certains ARM ?

2. **Modèle de données** :
   - Format export : colonnes identiques au niveau commune, indexées par INSEE ARM ?
   - Fallback logic si une infra-zone n'a pas assez de données (utiliser commune parent ?)
   - Schéma `meta.json` pour documenter niveau arrondissement

3. **Rendu carto** :
   - Frontend : gestion du style (deux layers map avec couleurs différentes)
   - Badge/détail : afficher l'insécurité ARM ou commune parente ?
   - Interaction : click sur ARM → détail ARM ou commune ?

4. **Dépendances** :
   - Impact sur `displayBinder.ts` (logique coloration multi-level)
   - Hook `useInsecurityMetrics()` : accepter `kind: "commune" | "infraZone"` ?
   - Tests : couvrir cas Paris (20 ARM), Lyon (9 ARM), Marseille (16 ARM)

### Non-objectifs (Hors scope étude)

- Appliquer cette logique à d'autres métriques au niveau arrondissement
- Support pour communes déléguées (COMD) ou associées (COMA) si pas de cas d'usage

## Critères de Décision

Avant implémentation future, valider :

1. ✅ **Demande produit claire** : souhait UI/UX d'afficher insécurité granulaire par arrondissement
2. ✅ **Couverture données** : vérifier que Parquet a assez de faits/population par ARM (ex: éviter de petits effectifs)
3. ✅ **Effort frontend** : estimer l'ajout de logique pour deux niveaux géographiques
4. ✅ **Fallback strategy** : définir comment gérer les ARM avec peu/pas de données

## Notes

- Cette task est **décorrélée de Task 1 & 2** (seuils quartiles + population Parquet)
- Task 1 & 2 restent **commune-only**
- Si décision positive, cette task peut être lancée après stabilisation de Task 1 & 2
- Aligner avec la pattern existante `fallbackChain` dans `meta.json` (voir `CachedEntityDataProvider`)

## Liens

- `docs/LOCALITY_MODEL.md` — Hiérarchie territoriale et ARM
- `packages/importer/src/exports/communes/metrics/insecurity/` — Export existant
- `apps/web/lib/map/layers/adminPolygons.ts` — Layers carte communes + ARM
- `apps/web/lib/data/insecurityMetrics.ts` — Couche data insécurité (à étendre si go)
