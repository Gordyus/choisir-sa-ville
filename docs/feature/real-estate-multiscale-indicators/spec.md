# Spécification — Indicateurs immobiliers multi-échelle (commune + hexagones)

**Statut** : Draft  
**Date** : 10 février 2026  
**Périmètre MVP** : France (selon couverture des sources)  
**Architecture** : Jamstack (datasets statiques + Next.js), sans backend applicatif runtime

---

## 1) Contexte & intention produit

Les indicateurs immobiliers à l'échelle commune sont utiles, mais trop grossiers dans les communes hétérogènes.
L'objectif est d'ajouter un mode cartographique immobilier plus fin :
- vue **macro** à l'échelle commune,
- vue **micro** à l'échelle hexagonale (zoom fort),
- en conservant des garde-fous de qualité.

Le projet conserve en parallèle :
- les prix DVF (observés, build-time),
- un import INSEE des prix immobiliers communaux (garde-fou / baseline),
- un import INSEE des loyers communaux (baseline loyers).

---

## 2) Objectifs (MVP)

### Objectif utilisateur
Consulter une carte immobilière plus précise que la commune, avec une lecture claire selon le zoom :
- zoom faible/moyen : indicateur communal,
- zoom fort (cible : `z >= 12`) : indicateur micro en hexagones, quand pertinent.

### Objectif produit
Ajouter un nouveau mode cartographique “Immobilier” sans casser les modes existants (`default`, `insecurity`), avec un sélecteur interne :
- `Vente`,
- `Loyer`.

### Objectif technique
Rester 100% statique :
- build-time dans `packages/importer`,
- runtime via fichiers versionnés sous `apps/web/public/data/{datasetVersion}`,
- résolution de version via `/data/current/manifest.json`.

---

## 3) Hors périmètre (MVP)

- Estimation notariale individualisée à l'adresse.
- Couches simultanées “vente + loyer” superposées.
- Modèles ML avancés.
- API backend runtime.

---

## 4) Sources & décisions de données

### 4.1 Sources obligatoires

1. **DVF géolocalisées** (ventes, micro-spatial).  
2. **INSEE prix immobiliers communaux** (baseline / garde-fou).  
3. **INSEE loyers communaux** (baseline loyers).

### 4.2 Principes de fiabilité

- Le prix de vente micro provient des transactions (DVF) agrégées.
- Le loyer reste ancré sur la source loyers officielle communale.
- Le micro-loyer (si affiché) est une **estimation spatialisée** explicitement taguée comme telle.
- Les mutations multi-lots complexes suivent la règle de regroupement par mutation (cf. feature transactions-address-history) pour éviter les biais.

---

## 5) Modèle fonctionnel d'affichage

### 5.1 Mode cartographique

Nouveau mode `realEstate` avec sélecteur :
- `metric = sale` (prix vente €/m2),
- `metric = rent` (loyer €/m2/mois).

### 5.2 Règle d'échelle

- `zoom < 12` : affichage communal uniquement.
- `zoom >= 12` : affichage hexagonal sur les zones pertinentes.
- Si une zone n'a pas assez de données micro, fallback visuel vers la couche commune.

### 5.3 Pertinence micro (hexagones)

Un hexagone est colorable uniquement si les seuils qualité sont atteints :
- Vente : `nSalesComparable >= 3` sur fenêtre glissante 24 mois.
- Loyer estimé : `nSalesComparable >= 3` + baseline loyer commune disponible.

Un territoire communal est “éligible micro” si :
- `nSalesComparableCommune >= 20` sur 24 mois, ou
- dispersion intra-commune élevée (`IQR / median >= 0.25`).

---

## 6) Indicateurs calculés

### 6.1 Vente (observé)

- `saleMedianPerM2Commune` (DVF comparables).
- `saleMedianPerM2Hex` (DVF comparables).
- `saleInseeBaselinePerM2Commune`.
- `saleGapVsInseePct = (saleMedianPerM2Commune - saleInseeBaselinePerM2Commune) / saleInseeBaselinePerM2Commune`.

### 6.2 Loyer

- `rentBaselinePerM2Commune` (INSEE/observatoire).
- `rentEstimatedPerM2Hex` (proxy spatial), formule MVP :
  - `rentEstimatedHex = rentBaselineCommune * (saleHex / saleCommune)^alpha`
  - `alpha` configurable (valeur initiale recommandée : `0.6`).

Le loyer hexagonal doit être labellisé `estimé`.

### 6.3 Méthode €/m2 vente

- Numérateur : valeur foncière mutation.
- Dénominateur : surface habitable logement (maisons/appartements) strictement positive.
- Exclure dépendances/sol/parcelles du dénominateur.
- Si non comparable : exclure des agrégats micro.

---

## 7) Code couleur (décision MVP)

### 7.1 Vente (absolu)

Palette séquentielle bleue (bas -> haut) :
- `#EAF2FF`
- `#C7DCFF`
- `#93BEFF`
- `#5B95F5`
- `#2F6FD6`
- `#1B4B99`

### 7.2 Loyer (absolu)

Palette séquentielle verte (bas -> haut) :
- `#EAF8EF`
- `#CBEED8`
- `#9FDEB8`
- `#68C993`
- `#39AA70`
- `#1F7A4D`

### 7.3 Écart à baseline (optionnel MVP+)

Palette divergente centrée sur 0 :
- bleu = en dessous de la baseline,
- neutre = proche baseline,
- rouge = au-dessus.

---

## 8) Sorties statiques (datasets)

Sous `apps/web/public/data/{datasetVersion}/real-estate/` :

1. `communes.json`  
   - entrée par commune :
   - `insee`, `saleMedianPerM2`, `saleInseeBaselinePerM2`, `rentBaselinePerM2`, `qualityFlags`.

2. `hex/{metric}/z{bundleZ}/{x}/{y}.json`  
   - `metric` dans `{sale, rent}`.
   - cellules hex visibles + valeurs + score qualité.

3. `meta.json`  
   - période temporelle,
   - seuils de qualité,
   - `alpha`,
   - palettes,
   - bornes de classes.

Le pipeline doit référencer tous ces fichiers dans les manifests versionnés.

---

## 9) Pipeline build-time (packages/importer)

Commande inchangée :
`pnpm --filter @choisir-sa-ville/importer export:static`

Étapes MVP :
1. Charger DVF + sources INSEE (prix + loyers).
2. Construire les agrégats communaux vente + loyers baseline.
3. Identifier les communes éligibles micro.
4. Calculer les agrégats hexagonaux vente.
5. Calculer les loyers hex estimés (si baseline dispo).
6. Écrire `communes.json`, bundles hex, `meta.json`.
7. Mettre à jour `manifest.json` dataset + `current`.

---

## 10) Runtime web (apps/web)

### 10.1 État d'affichage

- Étendre `displayModeService` avec `realEstate`.
- Ajouter un état `realEstateMetric` : `sale | rent`.

### 10.2 Couches MapLibre

- Couche commune (fill) active jusqu'à `z < 12`.
- Couche hex (fill) active pour `z >= 12`.
- Respect strict des événements projet pour traitements viewport :
  - `moveend`
  - `zoomend`

### 10.3 Légende / UI

- Indiquer clairement :
  - métrique (`Vente` ou `Loyer`),
  - unité (`€/m2` ou `€/m2/mois`),
  - statut `estimé` pour le loyer hex,
  - niveau de fiabilité (faible/moyen/fort).

---

## 11) Contraintes de performance

- Aucun calcul lourd de statistiques au runtime.
- Runtime = lecture datasets statiques + application de styles.
- Bundles hex localisés (viewport-friendly), pas de chargement national massif.
- Budget cible : interaction fluide pan/zoom sur desktop et mobile.

---

## 12) Critères d'acceptation (MVP)

1. Le mode `realEstate` est disponible en plus de `default` et `insecurity`.
2. Le sélecteur `Vente | Loyer` fonctionne sans rechargement de page.
3. `zoom < 12` : affichage communal ; `zoom >= 12` : affichage micro hex quand éligible.
4. Les communes/hex avec données insuffisantes ne sont pas colorées comme données fiables.
5. Les imports INSEE prix immo + loyers sont présents dans le pipeline et versionnés dans les datasets.
6. Le loyer micro est explicitement indiqué comme estimation.
7. Aucun backend runtime n'est introduit.

---

## 13) Risques & garde-fous

- Risque de confusion “mesuré vs estimé” pour loyers :
  - garde-fou : badge `estimé` + tooltip méthodo.
- Risque de bruit statistique en zones peu liquides :
  - garde-fou : seuils `n` minimaux + fiabilité.
- Risque de divergence forte avec baseline INSEE :
  - garde-fou : conserver baseline importée et traçable, et exposer l'écart.

---

## 14) Backlog post-MVP

- Calibration empirique de `alpha` par département/typologie.
- Ajout d'une couche optionnelle “écart à baseline”.
- Ajout de segmentation (maison/appartement, meublé/non meublé si source disponible).
- Évaluation d'un format vector tiles/PMTiles pour montée en charge.
