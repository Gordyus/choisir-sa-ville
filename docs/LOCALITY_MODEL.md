# Modèle territorial (Locality Model)

Ce document décrit comment le territoire est modélisé côté produit.

## Hiérarchie

Pays → Région → Département → Commune (pivot) → Zone infra-communale (optionnelle)

### Principe fondamental

- La **commune** est le niveau pivot : toute donnée doit pouvoir être expliquée au niveau communal.
- Une **zone infra** n’existe jamais sans commune parente.

## Correspondance INSEE

| TYPECOM | Niveau produit | Description |
|---|---|---|
| COM | Commune | Commune “pivot” |
| ARM | Zone infra | Arrondissements municipaux |
| COMD | Zone infra | Commune déléguée |
| COMA | Zone infra | Commune associée |

Règle : ARM/COMD/COMA sont **toujours** des zones infra (jamais des communes).

## SEO / Navigation (principe)

- La commune reste la page principale.
- Les zones infra enrichissent l’expérience sans “aplatir” le modèle.

## Règle d’or

> La commune est le socle.  
> Les zones infra apportent la précision.  
> Ne jamais aplatir les données au mauvais niveau.

