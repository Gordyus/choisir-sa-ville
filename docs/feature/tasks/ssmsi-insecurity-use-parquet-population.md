# Task — SSMSI : utiliser la population du Parquet (et découpler l’agrégat)

## Contexte

L’export `communes/metrics/insecurity/{year}.json` calcule des taux “par 1000 habitants” et un indice global (`indexGlobal`) à partir des faits SSMSI.

Aujourd’hui, le calcul dépend d’une population “référence” extraite du ZIP INSEE (`donnees_communes.csv`) via `populationByInsee`. Cette dépendance introduit un bug visible :

- certaines grandes communes (ex : **Paris `75056`**) n’ont pas de population directe dans la référence INSEE telle qu’importée,
- l’export insécurité produit alors `population=null` et toutes les métriques `null`,
- alors même que le Parquet SSMSI contient des lignes `diff` pour `75056` et inclut une population `insee_pop`.

La documentation SSMSI précise que la base communale inclut notamment :
- `insee_pop` (+ `insee_pop_millesime`)
- `insee_log` (+ `insee_log_millesime`)
- `taux_pour_mille`
- `est_diffuse` (diff / ndiff)

## Objectif

1) **Utiliser la population issue du Parquet SSMSI** (`insee_pop`) pour calculer les taux et l’indice, afin d’éviter les trous de couverture (ex : 75056).
2) Rendre l’agrégat “insécurité” **le plus indépendant possible** des autres sources :
   - minimiser les dépendances externes inutiles (ZIP INSEE populationRef),
   - réduire le couplage à `communes/indexLite.json` ou à d’autres exports.

## Décision produit / technique

- Pour le calcul des taux `*Per1000`, on normalise par **`insee_pop` du Parquet SSMSI** (quand disponible) plutôt que par la population INSEE importée séparément.
- On reste conservateur : si pas de `insee_pop` ou `est_diffuse != "diff"`, la valeur reste `null`.
- Le Parquet fournissant déjà `taux_pour_mille`, on documente ce champ, mais **on ne bascule pas** automatiquement dessus pour le MVP (voir “Notes / risques”).

## Portée

### À faire

- Lire/propager `insee_pop` (et éventuellement son millésime) lors de l’agrégation.
- Construire une population par commune **depuis le Parquet** (au minimum par `commune×année`).
- Calculer `ratePer1000 = (facts / insee_pop) * 1000`.
- Générer `communes/metrics/insecurity/{year}.json` sans dépendre de `populationByInsee` (ZIP INSEE).
- Mettre à jour `meta.json` pour refléter la source de population réellement utilisée (SSMSI).
- Ajouter un warning si une commune a des faits mappés (`facts>0`) mais `insee_pop` est manquant.

### Non-objectifs (pour cette task)

- Revoir le mapping indicateurs → groupes.
- Intégrer les `complement_info_*` (communes non diffusées).
- Changer la méthode de rendu carto (cf. task dédiée).

## Critères d’acceptation

- Pour **`75056`** et une année disponible (ex: 2024), la ligne exportée n’a plus `population=null` et les taux ne sont plus tous `null` si `est_diffuse="diff"` est présent dans le Parquet.
- L’export `metrics/insecurity` peut s’exécuter sans la source `populationRef` (ou, a minima, n’en dépend plus pour son calcul).
- Le calcul reste déterministe et stable : tri par INSEE, arrondi stable, format `columns/rows`.

## Notes / risques

- La doc SSMSI mentionne que `taux_pour_mille` peut être “par 1000 logements” pour certains indicateurs (ex : cambriolages). Notre export vise une normalisation “par 1000 habitants” cohérente entre groupes. Utiliser `insee_pop` garde un dénominateur homogène, mais diverge du `taux_pour_mille` officiel pour ces indicateurs spécifiques.
- La présence d’arrondissements (Paris/Lyon/Marseille) dans certains indicateurs peut impacter la distribution ; la logique reste commune-centric (pivot = commune).

