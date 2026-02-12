# Task — Historique transactions : afficher les ventes multi-lots par mutation (vue cohérente)

**Statut** : ✅ Implémenté  
**Date validation** : 11 février 2026  
**Date implémentation** : 11 février 2026

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

Modèle de données validé (primitives uniquement) :

```ts
type MutationSummary = {
  mutationId: string;
  date: string; // YYYY-MM-DD
  priceEurTotal: number;
  housingCount: number;
  housingSurfaceM2Total: number | null;
  dependencyCount: number;
  parcelCount: number;
  lots?: TransactionLot[]; // détail optionnel conservé
};

type TransactionLot = {
  typeLocal: "Maison" | "Appartement" | "Dépendance" | "Sol";
  surfaceM2: number | null;
  isVefa: boolean;
};
```

**Note** : Les champs dérivés (`compositionLabel`, `isGroupedSale`, `isComplexSale`, `pricePerM2Habitable`) ne sont PAS exportés dans les données statiques. Ils sont calculés au runtime via des helpers de formatage (séparation data/UI).

### Runtime web (UI)

- Le panneau droit liste `mutations[]` (et non plus des lignes brutes).
- Option "Voir le détail" (repliable) pour exposer les composants d'une mutation sans surcharger la lecture.
- Le wording doit expliciter qu'il s'agit d'une vente groupée quand applicable.

**Helpers de formatage runtime** (`apps/web/lib/data/transactions/mutationFormatters.ts`) :
- `buildMutationCompositionLabel(mutation): string` - ex: "2 appartements (110 + 35 m²), dépendance(s), 41 parcelles"
- `computePricePerM2(mutation): number | null` - calcule le prix/m² si pertinent, sinon null
- `isMutationGrouped(mutation): boolean` - détermine si badge "Vente groupée" s'applique
- `isMutationComplex(mutation): boolean` - détermine si badge "Vente complexe" s'applique

## Compatibilité avec la spec existante

Cette task complète `docs/feature/transactions-address-history/spec.md` sur le point actuellement listé en backlog :
- `Déduplication “lots” vs “bien” (cas d’acte multi-lots).`

Sections à mettre à jour lors de l'implémentation :
- modèle runtime (`TransactionLine` -> ajout d'un niveau `Mutation`)
- pipeline agrégation/déduplication
- rendu panneau droit (historique par mutation)

## Critères d'acceptation

### Build-time (packages/importer)
1. Le champ `id_mutation` est extrait du CSV DVF dans `parseDvfCsv.ts`.
2. L'agrégation par mutation se fait APRÈS la déduplication des lignes brutes.
3. Les données exportées contiennent uniquement des primitives (`MutationSummary` sans champs dérivés).
4. Les données détaillées (lots) sont conservées dans `lots?: TransactionLot[]`.

### Runtime web
5. Pour `319 RUE GEORGES AURIC, Montpellier`, l'historique affiche **une seule entrée de mutation** pour l'acte concerné, pas deux transactions "indépendantes".
6. Cette entrée expose un résumé de composition généré par `buildMutationCompositionLabel()` (ex: "2 appartements (110 + 35 m²), dépendances, 41 parcelles").
7. Un badge "Vente groupée" ou "Vente complexe" est affiché selon la logique définie dans les helpers.
8. Le `prix total` est toujours visible ; `€/m²` n'est affiché que si `computePricePerM2()` retourne une valeur non-null.

### Architecture
9. Aucun backend runtime ajouté ; architecture Jamstack inchangée.
10. Aucune violation de la séparation des couches (data/UI).

## Décisions architecture (validation PO/Architect)

### Séparation primitives de données vs formatage UI

**Principe validé** : Les données exportées par l'importer (build-time) contiennent **uniquement des primitives calculables de manière déterministe**. Les labels, badges et formatages sont calculés au runtime dans la couche UI.

**Rationnel** : Si demain la logique de badge évolue (ex: "Vente groupée" seulement si `housingCount > 2`), il ne faut pas regénérer les datasets. Le build-time reste idempotent et déterministe.

### Ordre d'agrégation

L'agrégation par mutation se fait **APRÈS** la déduplication existante (par ligne DVF brute), pas avant. Cela évite de perdre des lots distincts qui auraient été dédupliqués trop tôt.

### Extraction `id_mutation`

**Condition obligatoire** : Le champ `id_mutation` doit être extrait du CSV DVF dans `parseDvfCsv.ts` (actuellement manquant).

**Fallback** : Si `id_mutation` est absent (lignes DVF anciennes pré-2018), utiliser une clé composite déterministe : `${date}|${priceEur}|${inseeCode}|${addressKey}`. Inclure l'heure si disponible dans DVF.

**Dette technique identifiée** : Certaines mutations anciennes peuvent être split si la clé composite est insuffisante. Logger un warning si `id_mutation` est absent pour > X% des lignes.

### Conservation du détail brut

Les données détaillées (lots, dépendances, parcelles) restent dans l'export statique via le champ `lots?: TransactionLot[]` ou un fichier séparé `-detailed.json` si le poids pose problème.

### Calcul prix/m² conditionnel

Le prix/m² est affiché uniquement si **tous** les lots de la mutation sont de type `Maison` ou `Appartement` (pas de dépendance, pas de sol) ET que `housingSurfaceM2Total > 0`. Sinon : `null` (affichage UI : "Prix/m² non pertinent").

---

## Hors périmètre

- Inférence juridique avancée de la nature exacte de chaque lot.
- Reconstitution parfaite de la ventilation de prix par lot.
- Changement du parcours carte (points, sélection, bundle loading) hors adaptation du contenu affiché.
