# Task — SSMSI : `indexGlobal` avec filtre epsilon sur les “très faibles”

## Contexte

L’export `communes/metrics/insecurity/{year}.json` produit :
- des taux thématiques (par 1000 habitants),
- un `scoreRaw` (moyenne pondérée des 3 familles),
- un `indexGlobal` (normalisation nationale en 0–100),
- un `level` (classes pour l’affichage UI/carte).

On observe qu’une grande partie des communes ont un `scoreRaw` nul ou quasi nul, ce qui peut :
- “écraser” la distribution nationale utilisée pour calculer `indexGlobal`,
- réduire la discriminabilité de `indexGlobal` pour les communes réellement > 0.

Objectif : permettre de **filtrer** les communes “très faibles” du calcul percentile des autres communes, tout en conservant une sémantique simple pour l’utilisateur.

## Problème

Le percentile national est actuellement construit sur l’ensemble des `scoreRaw` valides. Avec une masse de scores très faibles (ex. 0), la distribution devient très asymétrique et l’`indexGlobal` peut être peu informatif pour les communes non nulles (effet “binaire” / manque de nuances).

## Décision / comportement souhaité

Introduire un paramètre **epsilon** `ε` pour définir le seuil de “très faible”.

### Définition

- `ε` est un **seuil en unité de `scoreRaw`**.
- “Très faible” signifie : `scoreRaw <= ε`.

### Règle de calcul `indexGlobal`

Pour chaque commune × année :
- Si `scoreRaw` est `null` (pas de données calculables) :
  - `indexGlobal = null` (inchangé).
- Si `scoreRaw <= ε` :
  - `indexGlobal = 0` (plancher).
- Si `scoreRaw > ε` :
  - `indexGlobal` est calculé par **percentile national** mais **uniquement** sur la distribution des scores strictement `> ε`.
  - Le percentile des scores `> ε` est **rescalé** sur `[1..100]` afin que les communes “non très faibles” ne retombent pas à 0 :
    - `indexGlobal = round(1 + 99 * percentile_rank(scoreRaw, distribution_{>ε}))`

Notes :
- Cette règle garantit :
  - `0` = “très faible (<= ε)”,
  - `1..100` = “au-dessus du seuil”, avec une granularité nationale.
- Le classement doit être **déterministe** (tri stable) et gérer les ex-aequo (ties) de façon stable.

## Paramétrage (exigence)

`ε` doit être **facilement paramétrable** (sans modifier plusieurs fichiers).

Recommandation (à choisir à l’implémentation) :
- Une constante unique dans l’exporteur (ex. `DEFAULT_INDEXGLOBAL_EPSILON = 0.01`) + lecture optionnelle d’une variable d’environnement (build-time), par exemple :
  - `CSVV_INSECURITY_INDEXGLOBAL_EPSILON=0.01`
- Validation stricte :
  - nombre fini,
  - `ε >= 0`,
  - sinon fallback sur la valeur par défaut + warning console.

Le `meta.json` doit documenter la valeur réellement utilisée, par année (et sa méthode) :
- `indexGlobal.method = "percentile_rank on scoreRaw > epsilon, rescaled to [1..100]"`
- `indexGlobal.epsilon = <valeur>`

## Non-objectifs

- Ne change pas le calcul des taux thématiques.
- Ne change pas la composition de `scoreRaw` (poids).
- Ne change pas le calcul `level` (classification UI) dans cette task (sauf si explicitement décidé dans une task séparée).

## Cas limites attendus

1) **Aucun score > ε** pour une année :
   - toutes les communes avec `scoreRaw <= ε` → `indexGlobal=0`
   - toutes les communes avec `scoreRaw=null` → `indexGlobal=null`
   - et log d’un warning explicite (distribution vide).

2) **Une seule commune** avec `scoreRaw > ε` :
   - elle doit obtenir `indexGlobal=100` (ou `1..100` cohérent, mais stable et documenté).

3) **Ex-aequo** (plusieurs communes avec le même `scoreRaw`) :
   - percentile stable (ex. min-rank) pour conserver déterminisme.

## Critères d’acceptation

- `indexGlobal` conserve le domaine `null` ou entier dans `[0..100]`.
- Les communes `scoreRaw <= ε` ont `indexGlobal=0` et n’influencent pas le percentile des autres.
- Les communes `scoreRaw > ε` ont toujours `indexGlobal >= 1`.
- La valeur `ε` utilisée est facilement modifiable et documentée dans `meta.json`.
- Résultat déterministe (build reproductible).

## Fichiers concernés (implémentation future)

- `packages/importer/src/exports/communes/metrics/insecurity/exportMetricsInsecurity.ts`
  - adaptation de la construction de l’index percentile (`buildPercentileIndex`) et du mapping final.
- `apps/web/public/data/{datasetVersion}/communes/metrics/insecurity/meta.json`
  - ajout de la documentation `epsilon` + méthode.

