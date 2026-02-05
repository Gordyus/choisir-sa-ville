# Task — SSMSI : rendu carto plus “réaliste/graduel” (corriger l’effet binaire)

## Problème observé

Le rendu carto “insécurité” apparaît souvent **binaire** (beaucoup de vert et beaucoup de rouge, très peu d’intermédiaires).

Raison principale : la distribution de `scoreRaw` (et donc de `indexGlobal`) est très concentrée sur `0` :
- une grande partie des communes ont `scoreRaw=0` (aucun fait dans les catégories mappées, ou taux nuls),
- avec un percent-rank, toutes ces communes tombent à `indexGlobal=0`,
- la première valeur strictement >0 arrive après un gros bloc, ce qui fait sauter directement vers un percentile élevé.

Conséquence : les classes basées sur des seuils fixes (0–24 / 25–49 / 50–74 / 75–100) donnent peu de nuances (voire des classes vides).

## Objectif

Obtenir un rendu carto **plus progressif** et plus intuitif (plus de nuances), sans changer l’architecture (données statiques, lazy load, cache) et sans calcul lourd runtime.

## Solutions envisagées (résumé)

1) Changer la définition de l’index (dense-rank sur valeurs uniques / midrank / etc.).  
2) **(Retenue pour l’instant)** Traiter `scoreRaw=0` comme une classe à part, puis calculer les seuils (quartiles) sur la distribution **`scoreRaw>0`** uniquement.  
3) Abandonner le percentile (utiliser score brut + échelle log/continue).  
4) Revoir l’agrégation/mapping et/ou les unités (réduire l’effet “zéro massif”).

## Décision (MVP)

On retient la **solution 2** :

- `scoreRaw=0` ⇒ niveau “faible” (ou niveau “zéro” explicite selon choix UI).
- Pour `scoreRaw>0`, on calcule des seuils par année (Q1/Q2/Q3) sur la distribution non nulle.
- On “bake” ces seuils dans `communes/metrics/insecurity/meta.json` (par année) pour éviter tout calcul runtime.
- La carte utilise ces seuils pour colorer les polygones.

## Portée

### À faire

- Lors de l’export annuel :
  - extraire la liste des `scoreRaw` strictement > 0
  - calculer Q1/Q2/Q3 (sur `scoreRaw`, pas sur `indexGlobal`)
  - stocker ces seuils dans `meta.json` (par année)
- Exposer une fonction de mapping “scoreRaw → level” (partagée entre carte et badge).
- Adapter le rendu carto du mode “Insécurité” pour utiliser ces seuils.

### Non-objectifs

- Pas de légende/hint UX à ce stade.
- Pas de choix d’année dans l’UI (année courante seulement).
- Pas de re-design UI : uniquement un rendu plus nuancé.

## Critères d’acceptation

- En mode “Insécurité”, la carte montre des classes intermédiaires significatives (pas seulement vert/rouge).
- Les seuils sont stables, documentés, et versionnés dans `meta.json`.
- Le rendu reste déterministe et ne dépend pas du viewport.

## Notes

- Cette solution conserve la possibilité de garder `indexGlobal` en 0..100 (utile pour badge/tri), tout en utilisant des seuils “réalistes” pour le rendu carto.
- Si on veut strictement 4 classes de tailles similaires, on peut aussi définir les seuils en quantiles sur `indexGlobal` **non zéro**, mais `scoreRaw` est plus direct et évite les artefacts d’arrondi.

