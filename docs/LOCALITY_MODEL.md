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

## Notion d'entité générique

Une **entité** est l'unité de base à laquelle s'attache une information dans l'application. Aujourd'hui les entités sont des communes ou des infraZones. À l'avenir elles pourront être des unités plus fines (quartiers, IRIS, etc.).

Le type canonique est `EntityRef` avec un champ `kind` :
- `"commune"` — entité de niveau commune
- `"infraZone"` — entité infra-communale (ARM, COMD, COMA)

**Toute feature qui affiche une donnée sur une entité doit être pensée entité-centric, pas commune-centric.** Un badge, une coloration carte, un indicateur : tous doivent fonctionner pour n'importe quel type d'entité, quitte à résoudre la donnée via un fallback vers le niveau parent.

## Modèle de granularité futur

Le modèle de granularité est progressif :

```
Commune  →  Arrondissement / InfraZone  →  Quartier (futur)
(pivot)     (actuellement ARM/COMD/COMA)   (IRIS ou découpage local)
```

Les données sont produites au niveau le plus fin disponible. Le runtime remonte vers le niveau parent si nécessaire (voir "Héritage géographique" ci-dessous).

## Héritage géographique (fallback)

Quand une donnée n'existe pas pour une entité donnée, le runtime peut **hériter** de la donnée du niveau parent géographique. Ce comportement est déclaré par le champ `fallbackChain` dans le `meta.json` de chaque agrégat (voir `docs/ARCHITECTURE.md`).

Exemple concret : l'agrégat insécurité est produit au niveau commune. Pour une infraZone (arrondissement), le runtime récupère la valeur de la commune parente via `parentId`. Dans le futur, un agrégat au niveau quartier pourrait fallback vers l'arrondissement puis vers la commune.

Règle : le fallback est toujours déclaratif (dans `meta.json`), jamais implicite dans le code.

## SEO / Navigation (principe)

- La commune reste la page principale.
- Les zones infra enrichissent l'expérience sans "aplatir" le modèle.

## Règle d'or

> La commune est le socle.
> Les zones infra apportent la précision.
> Ne jamais aplatir les données au mauvais niveau.

