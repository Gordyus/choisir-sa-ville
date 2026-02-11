# Spécification — Indicateurs immobiliers multi-échelle (commune + hexagones)

**Statut** : ✅ Validé (prêt implémentation)  
**Date** : 11 février 2026 (validation finale)  
**Validation PO/Architect** : 11 février 2026  
**Périmètre MVP** : France (selon couverture DVF)  
**Architecture** : Jamstack (datasets statiques + Next.js), sans backend applicatif runtime

**Scope MVP** : Vente uniquement (DVF observé). Loyer reporté post-MVP (voir `roadmap-loyers.md`).

---

## 1) Contexte & intention produit

Les indicateurs immobiliers à l'échelle commune sont utiles, mais trop grossiers dans les communes hétérogènes.
L'objectif est d'ajouter un mode cartographique immobilier plus fin :
- vue **macro** à l'échelle commune,
- vue **micro** à l'échelle hexagonale (zoom fort),
- en conservant des garde-fous de qualité.

**Source unique (MVP)** : DVF géolocalisées (ventes observées), déjà importé pour la feature `transactions-address-history`.

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

### 4.1 Source unique (MVP)

**DVF géolocalisées** (ventes observées, build-time)  
**URL** : `https://files.data.gouv.fr/geo-dvf/latest/csv/{YEAR}/departements/{DEPT}.csv.gz`  
**Import** : Déjà implémenté pour feature `transactions-address-history` via `packages/importer/src/exports/transactions/dvfGeoDvfSources.ts`  
**Réutilisation** : Module partagé `dvfSharedParsing.ts` (parsing + calcul €/m² factorisé)

### 4.2 Principes de fiabilité et factorisation

- Le prix de vente micro provient des transactions DVF agrégées (même méthodologie que `transactions-address-history`).
- **Baseline prix** = médiane DVF communale calculée (pas d'import INSEE externe).
- Les mutations multi-lots complexes suivent la règle de regroupement par mutation (cf. feature transactions-address-history) pour éviter les biais.
- **Factorisation obligatoire** : Le parsing DVF et le calcul €/m² doivent être partagés entre `transactions-address-history` et `real-estate` via un module commun.

---

## 5) Modèle fonctionnel d'affichage

### 5.1 Mode cartographique

Nouveau mode `realEstate` (MVP : vente uniquement).

**Post-MVP** : Ajout sélecteur `metric` :
- `metric = sale` (prix vente €/m²),
- `metric = rent` (loyer €/m²/mois, voir `roadmap-loyers.md`).

### 5.2 Règle d'échelle

- `zoom < 12` : affichage communal uniquement.
- `zoom >= 12` : affichage hexagonal sur les zones pertinentes.
- Si une zone n'a pas assez de données micro, fallback visuel vers la couche commune.

### 5.3 Pertinence micro (hexagones)

Un hexagone est colorable uniquement si les seuils qualité sont atteints :
- **Vente** (MVP) : `nSalesComparable >= 3` sur fenêtre glissante 24 mois.

Un territoire communal est "éligible micro" si :
- `nSalesComparableCommune >= 20` sur 24 mois, OU
- dispersion intra-commune élevée (`IQR / median >= 0.25`).

### 5.4 Statut architectural des hexagones

**Décision** : Les hexagones H3 sont des **artefacts de visualisation uniquement**, pas des entités du modèle territorial.

**Rationnel** :
- Le modèle territorial (`LOCALITY_MODEL.md`) définit `EntityRef.kind` = `"commune" | "infraZone"` | `"transactionAddress"`.'
- Les hexagones ne sont **ni des communes, ni des infrazones, ni des adresses**.
- Ils sont un maillage géographique transversal pour visualisation de données agrégées.

**Implications** :
1. **Non-cliquables** : Pas d'extension de `SelectionService` pour hexagones (violation modèle territorial).
2. **Tooltip uniquement** : Infobulle sur hover affiche indicateur sans modifier sélection.
3. **Click-through** : Le clic sur hexagone résout l'entité label sous-jacente (commune ou infrazone).
4. **Pas de routage** : Pas d'URL `/hex/{hexId}` (seulement `/commune/{insee}` ou `/infrazone/{code}`).

**Cohérence avec insecurity mode** :
- Même pattern que mode `insecurity` : hexagones affichent données, mais entités restent communes + infraZones.

---

## 6) Indicateurs calculés

### 6.1 Vente (observé DVF)

- `saleMedianPerM2Commune` (DVF comparables agrégés par commune).
- `saleMedianPerM2Hex` (DVF comparables agrégés par hexagone H3).
- `saleGapVsBaselinePct = (saleMedianPerM2Commune - saleMedianPerM2National) / saleMedianPerM2National` (optionnel : écart vs médiane nationale).

**Note** : La baseline est calculée à partir de DVF (médiane communale), pas importée depuis une source INSEE externe.

### 6.2 Méthode €/m² vente

- Numérateur : valeur foncière mutation.
- Dénominateur : surface habitable logement (maisons/appartements) strictement positive.
- Exclure dépendances/sol/parcelles du dénominateur.
- Si non comparable : exclure des agrégats micro.
- **Factorisation** : Même méthode que `transactions-address-history` (module partagé `dvfSharedParsing.ts`).

---

## 7) Code couleur (MVP : vente uniquement)

### 7.1 Vente (palette séquentielle neutre)

Palette progressive bleu clair → bleu foncé (6 classes) pour éviter confusion sémantique avec mode `insecurity` :
- `#E3F2FD` (bas - prix faibles)
- `#BBDEFB`
- `#90CAF9`
- `#42A5F5`
- `#1E88E5`
- `#1565C0` (haut - prix élevés)

**Rationnel** :
- Palette neutre progressive sans connotation "bon/mauvais"
- Accessible WCAG AA (contraste suffisant sur fond blanc)
- Différenciée de la palette insécurité (rouge/orange/vert)

**Seuils de classes** : Définis au build-time dans `meta.json` (quartiles nationaux ou départementaux selon calibration).

### 7.2 Loyer (réservé post-MVP)

Post-MVP : Palette à définir lors de l'ajout de la métrique loyer (commune + hexagones).

### 7.3 Écart à baseline (optionnel post-MVP)

Palette divergente centrée sur 0 (optionnel pour affichage écart vs médiane nationale) :
- bleu = en dessous de la baseline,
- neutre = proche baseline,
- rouge = au-dessus.

---

## 8) Sorties statiques (datasets)

Sous `apps/web/public/data/{datasetVersion}/real-estate/` :

1. `communes.json`  
   - Entrée par commune : `{ insee, saleMedianPerM2, nSales, qualityLevel }`
   - `qualityLevel` : "low" (< 10 ventes/24 mois), "medium" (10-30), "high" (> 30)

2. `hex/sale/z{bundleZ}/{x}/{y}.json`  
   - MVP : vente uniquement
   - Cellules hex visibles + valeurs + score qualité
   - Post-MVP : ajouter `hex/rent/` après implémentation métrique loyer

3. `meta.json`  
   - Période temporelle (fenêtre glissante 24 mois)
   - Seuils de qualité (`nMin`, `nEligibleCommune`, `iqrThreshold`)
   - Palette (`classes`, `colors`)
   - Bornes de classes (quartiles/déciles)

Le pipeline doit référencer tous ces fichiers dans les manifests versionnés.

---

## 9) Pipeline build-time (packages/importer)

Commande inchangée :
`pnpm --filter @choisir-sa-ville/importer export:static`

Étapes MVP :
1. **Charger DVF** : Réutiliser `dvfGeoDvfSources.ts` (déjà implémenté pour `transactions-address-history`).
2. **Parser DVF** : Factoriser via module partagé `dvfSharedParsing.ts` (parsing + calcul €/m²).
3. **Construire agrégats communaux vente** : Médiane, quartiles, nb transactions par commune.
4. **Identifier communes éligibles micro** : `nSales >= 20` ou `IQR/median >= 0.25`.
5. **Calculer agrégats hexagonaux vente** : Pour communes éligibles, agréger par hexagone H3.
   - **Résolution H3** : **Niveau 8** (par défaut, configurable via `packages/shared/src/config/realEstateConfig.ts`).
   - Rationnel niveau 8 : ~0.74 km² par hexagone, compromis granularité/performance.
   - Configuration : `H3_RESOLUTION_HEXAGONS = 8` (modifiable sans changement code, permet A/B testing résolutions 7-9).
6. **Écrire datasets** : `communes.json`, `hex/sale/z{bundleZ}/{x}/{y}.json`, `meta.json`.
7. **Mettre à jour manifests** : `manifest.json` dataset + `current`.

**Post-MVP** : Ajouter étapes import source loyers + calcul loyers commune/hex.

---

## 10) Runtime web (apps/web)

### 10.1 État d'affichage

- Étendre `displayModeService` avec mode `realEstate`.
- MVP : Pas de sélecteur métrique (vente uniquement).
- Post-MVP : Ajouter état `realEstateMetric : "sale" | "rent"`.

### 10.2 Couches MapLibre

- Couche commune (fill) active jusqu'à `z < 12`.
- Couche hex (fill) active pour `z >= 12`.
- **Règles d'interaction** :
  - Les hexagones sont **non-cliquables** (pas de `queryRenderedFeatures` sur le layer hex).
  - Le clic résout toujours l'entité label sous-jacente (commune/infraZone) via le layer labels.
  - **Infobulle au survol** : `mousemove` sur layer hex → affiche tooltip avec :
    - Prix médian (€/m²)
    - Nombre de transactions (24 mois)
    - Niveau de fiabilité (Faible < 10 / Moyen 10-30 / Fort > 30)
- Respect strict des événements projet pour traitements viewport :
  - `moveend`
  - `zoomend`
  - **AbortController obligatoire** pour annulation requests au changement de viewport

### 10.3 Légende / UI

- Indiquer clairement :
  - Métrique : `Vente` (€/m²)
  - Niveau de fiabilité : basé sur nombre de transactions
  - Période : fenêtre glissante 24 mois
- Post-MVP : Ajouter sélecteur `Vente | Loyer` avec indication "Estimé" pour loyers hex.

---

## 11) Contraintes de performance

- Aucun calcul lourd de statistiques au runtime.
- Runtime = lecture datasets statiques + application de styles.
- Bundles hex localisés (viewport-friendly), pas de chargement national massif.
- Budget cible : interaction fluide pan/zoom sur desktop et mobile.

---

## 12) Critères d'acceptation (MVP)

1. Le mode `realEstate` est disponible en plus de `default` et `insecurity`.
2. MVP : Vente uniquement (pas de sélecteur métrique au MVP).
3. `zoom < 12` : affichage communal ; `zoom >= 12` : affichage micro hex quand éligible.
4. Les communes/hex avec données insuffisantes ne sont pas colorées (ou colorées avec opacité réduite + badge "Faible fiabilité").
5. Le parsing DVF est factorisé avec `transactions-address-history` (module partagé `dvfSharedParsing.ts`).
6. Les hexagones sont **non-cliquables** (clic résout entité label).
7. Infobulle au survol des hexagones affiche : prix médian, nb transactions, niveau fiabilité.
8. Aucun backend runtime n'est introduit (architecture Jamstack inchangée).

---

## 13) Risques & garde-fous

- Risque de bruit statistique en zones peu liquides :
  - garde-fou : seuils `n` minimaux + niveau fiabilité affiché.
- Risque de sur-interprétation données hexagones (granularité apparente forte) :
  - garde-fou : tooltip explicite niveau fiabilité + nb transactions.
- Risque de confusion "baseline nationale" :
  - garde-fou : baseline = médiane DVF calculée et traçable dans `meta.json` (pas importée source externe).

---

## 14) Backlog post-MVP

**Métrique loyer** (priorité haute - voir `roadmap-loyers.md`) :
- Import source CLAMEUR 2025 (loyers d'annonce commune-level)
- Ajout sélecteur `Vente | Loyer`
- Disclaimer UI obligatoire (loyers annonces vs réels)
- Loyers hexagones = valeur commune nearest (pas de formule proxy)

**Évolutions qualité données** :
- Segmentation type logement (maison/appartement)
- Ajout couche "écart à baseline" (optionnel)
- Évaluation vector tiles/PMTiles si montée en charge

**Backlog-loyers complet** : Voir `docs/feature/real-estate-multiscale-indicators/roadmap-loyers.md`