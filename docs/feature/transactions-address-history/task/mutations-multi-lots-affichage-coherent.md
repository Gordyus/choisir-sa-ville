# Task — Historique transactions : afficher les ventes multi-lots par mutation (vue cohérente)

## Problème observé

Sur certaines adresses, l'UI affiche plusieurs "transactions" qui correspondent en réalité à une seule vente notariée multi-lots.

Cas concret remonté :
- Adresse : `319 RUE GEORGES AURIC, Montpellier`
- Même date et même valeur foncière réutilisée sur plusieurs lignes (ex: 110 m² et 35 m²)
- Mutation contenant de nombreuses passerelles cadastrales (ex: `34172000OK0252` ... `34172000OK0018`, ~41 références)

Conséquence :
- L'utilisateur comprend "2 ventes distinctes" alors qu'il s'agit d'un seul acte.
- Le `prix/m²` affiché peut devenir trompeur si dépendances/sol/parcelles sont inclus dans le prix global.

## Objectif

Rendre l'affichage lisible et juste pour l'utilisateur final, tout en conservant la granularité DVF complète pour des analyses avancées futures.

## Décision produit/technique

### 1) Unité d'affichage par défaut = mutation

Dans le panneau d'historique, une ligne affichée doit représenter une **mutation** (acte de vente), pas une ligne brute DVF.

Règle de regroupement :
1. Clé principale : `id_mutation`
2. Fallback si `id_mutation` absent : clé composite déterministe (`date_mutation + valeur_fonciere + adresse_normalisee + code_commune`)

### 2) Conserver le détail complet en données exportées

Le pipeline doit garder les lignes détaillées (lots, dépendances, sol, passerelles cadastrales) dans l'export statique pour usage ultérieur.

### 3) Affichage simplifié + explicite

Pour chaque mutation affichée :
- `date`
- `valeur_fonciere_totale`
- `composition` (ex: `2 appartements (110 + 35 m²), dépendance(s), 41 parcelles`)
- badge : `Vente groupée` / `Vente complexe` si multi-lots hétérogène

Ne pas afficher la liste brute des 41 passerelles en vue principale.

### 4) Règle de `prix/m²`

- Afficher `prix total` de mutation dans tous les cas.
- Calculer `€/m²` uniquement si pertinent :
  - dénominateur = somme des surfaces habitables logement (`Maison`/`Appartement`) strictement positives
  - ne pas inclure dépendances/sol/parcelles dans le dénominateur
- Si mutation hétérogène ou surface exploitable insuffisante : afficher `€/m² non pertinent (vente multi-lots)`.

## Portée d'implémentation attendue

### Données (importer)

- Construire une vue agrégée par adresse :
  - `mutations[]` (résumé UI)
  - avec conservation d'un lien vers le détail brut
- Conserver l'export détaillé des composants de mutation (lots, dépendances, parcelles) dans les données statiques.

Suggestion de modèle (indicatif) :

```ts
type AddressMutationSummary = {
  mutationId: string;
  date: string; // YYYY-MM-DD
  priceEurTotal: number;
  isGroupedSale: boolean;
  isComplexSale: boolean;
  housingCount: number;
  housingSurfaceM2?: number;
  dependencyCount: number;
  parcelCount: number;
  compositionLabel: string;
  pricePerM2Habitable?: number; // absent si non pertinent
};
```

### Runtime web (UI)

- Le panneau droit liste `mutations[]` (et non plus des lignes brutes).
- Option "Voir le détail" (repliable) pour exposer les composants d'une mutation sans surcharger la lecture.
- Le wording doit expliciter qu'il s'agit d'une vente groupée quand applicable.

## Compatibilité avec la spec existante

Cette task complète `docs/feature/transactions-address-history/spec.md` sur le point actuellement listé en backlog :
- `Déduplication “lots” vs “bien” (cas d’acte multi-lots).`

Sections à mettre à jour lors de l'implémentation :
- modèle runtime (`TransactionLine` -> ajout d'un niveau `Mutation`)
- pipeline agrégation/déduplication
- rendu panneau droit (historique par mutation)

## Critères d'acceptation

1. Pour `319 RUE GEORGES AURIC, Montpellier`, l'historique affiche **une seule entrée de mutation** pour l'acte concerné, pas deux transactions "indépendantes".
2. Cette entrée expose un résumé de composition (logements, dépendances, parcelles), avec badge `Vente groupée` ou `Vente complexe`.
3. Le `prix total` est toujours visible ; `€/m²` n'est affiché que si la règle de pertinence est satisfaite.
4. Les données détaillées (dont passerelles cadastrales) restent présentes dans les exports statiques.
5. Aucun backend runtime ajouté ; architecture Jamstack inchangée.

## Hors périmètre

- Inférence juridique avancée de la nature exacte de chaque lot.
- Reconstitution parfaite de la ventilation de prix par lot.
- Changement du parcours carte (points, sélection, bundle loading) hors adaptation du contenu affiché.
