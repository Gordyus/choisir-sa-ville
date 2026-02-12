# Spécification — Historique des transactions à l’adresse (DVF+) — MVP Hérault (34)

**Statut** : ✅ Implémenté (MVP 34) — Multi-lots implémenté (11 fév 2026)
**Date** : 5 février 2026 (mise à jour : 11 février 2026)
**Périmètre MVP** : Département de l’Hérault (34)  
**Architecture** : Jamstack (datasets statiques + Next.js), sans backend applicatif runtime

---

## 1) Contexte & intention produit

L’application vise à aider un utilisateur dans une décision d’achat immobilier en lui permettant de consulter, **à l’échelle d’une adresse**, l’**historique des transactions de vente** associées (date, prix, surface, type…).

Le MVP vise à valider :
- la **lisibilité** d’un affichage “points de transaction” à fort zoom,
- le **parcours** “clic sur un point → panneau de droite → historique complet”,
- la **faisabilité technique** en données statiques (taille, partition, performances),
- un **modèle d’entité** “adresse transactionnelle” (nouvelle entité métier, distincte de la commune).

---

## 2) Objectifs (MVP)

### Objectif utilisateur
À fort zoom, l’utilisateur voit des **points** indiquant des adresses pour lesquelles des transactions sont disponibles. En cliquant sur un point, il obtient dans le panneau de droite la **liste complète** des transactions connues sur cette adresse.

### Objectif produit
Fournir une fonctionnalité “outil de décision” **sans calcul d’estimation** dans le MVP, uniquement l’historique factuel.

### Objectif technique
Produire et servir des données **100% statiques**, versionnées par dataset (`vYYYY-MM-DD`), compatibles avec les conventions existantes :
- build-time via `packages/importer`
- runtime via `apps/web/public/data/current/manifest.json` → `datasetVersion`
- aucune API applicative, aucune DB au runtime

---

## 3) Hors périmètre (MVP)

- Calcul d’indicateurs “prix attendu aujourd’hui”, indices marché, comparables, médianes locales.
- Agrégats “prix par commune” (prévu plus tard).
- Saisie d’adresse / autocomplete / géocodage pour centrer la carte (prévu plus tard).
- Couverture France entière (on se limite au 34).
- Gestion des transactions sans numéro de voie (ignorées au MVP).
- Détection avancée d’adresses “équivalentes” (fusion tolérante) : le regroupement est strict au MVP.

---

## 4) Décisions & hypothèses (MVP)

### Source de données (référence)
- Dataset : **DVF géolocalisées** (Etalab) sur data.gouv.fr  
  Lien de référence (page dataset) : `https://www.data.gouv.fr/datasets/demandes-de-valeurs-foncieres-geolocalisees`
- Fichiers par département et par année : `https://files.data.gouv.fr/geo-dvf/latest/csv/{YEAR}/departements/{DEPT}.csv.gz`
- Couverture : fenêtre glissante de ~5 ans (actuellement 2020 → 2025), mise à jour semestrielle (avril + octobre)

### Décisions fonctionnelles
- **Entité cliquable** : *AdresseTransactionnelle* (un point sur la carte).
- **Historique affiché** : toutes les transactions associées à la même adresse, y compris si plusieurs biens/ventes concernent cette adresse.
- **Filtre biens particuliers** : uniquement `Maison` + `Appartement`.
- **VEFA** : conservée et **taguée** (affichée comme VEFA). Elle n’est pas exclue du listing.
- **Lignes sans numéro de voie** : **ignorées** (pas d’adresse exploitable).

### Décisions techniques
- Source : **DVF géolocalisées Etalab** (iles.data.gouv.fr/geo-dvf), fichiers CSV par département/année.
- Format d’ingestion : **CSV gzippé par département** (table « mutations » à plat), parseable en Node streaming.
- Partitionnement des historiques : par **tuiles WebMercator** (z fixe), pour éviter “1 fichier par commune”.
- MVP carte : **GeoJSON** pour la couche de points (simple à intégrer), avec option future **PMTiles** si nécessaire.
- Coordonnées du point : **dernière vente** (date max) *(décision MVP)*.

### Hypothèses
- DVF+ fournit des champs permettant :
  - filtrage `nature_mutation` et `type_local`,
  - reconstruction d’adresse `numéro + voie` et `code commune (INSEE)`,
  - géolocalisation (lat/lng).
- La densité de points dans le 34 reste acceptable en GeoJSON pour un MVP (sinon bascule PMTiles).
 - Si DVF+ propose plusieurs formats (CSV/GPKG/SQL), le MVP démarre sur CSV ; la bascule vers SQL (PostgreSQL/PostGIS) est un sujet post-MVP.

---

## 5) Parcours utilisateur (MVP)

### 5.1. Parcours “exploration map-first”
1. L’utilisateur zoome sur une zone du département 34.
2. À partir d’un **zoom minimum**, des points apparaissent (adresses avec historique).
3. L’utilisateur clique sur un point.
4. Le panneau de droite affiche :
   - l’adresse (libellé),
   - la liste des transactions : date, prix, surface, type, badge VEFA si applicable.

### 5.2. Comportements UI attendus
- Changement de sélection : le panneau passe par `loading` puis `ready` ou `missing/error`.
- Scroll si la liste est longue.
- Optionnel MVP : survol = mise en évidence (`highlight`), clic = sélection (`active`).

---

## 6) Règles métier : définition de “même adresse”

### 6.1. Regroupement strict (MVP)
Une adresse est définie par la clé :

`addressKey = "{inseeCode}|{streetNumber}|{streetNameNormalized}"`

avec :
- `inseeCode` : code commune INSEE (5 caractères).
- `streetNumber` : numéro de voie (ex: `12`, `12B` si présent).
- `streetNameNormalized` : libellé voie normalisé (uppercase, sans accents, espaces/punctuations normalisés).

### 6.2. Conséquences acceptées au MVP
- Variations de libellé → possible duplication de points.
- Cas complexes (bis/ter, entrées multiples) non résolus finement au MVP.

### 6.3. Transactions incluses dans l’historique
Pour une adresse, on inclut toutes les lignes répondant aux filtres :
- `type_local` ∈ {`Maison`, `Appartement`}
- `nature_mutation` ∈ {`Vente`, `Vente en l’état futur d’achèvement`} (VEFA)
- `streetNumber` présent (sinon ignore)
- coords présentes et finies (sinon ignore)

---

## 7) Modèle de données (runtime)

### 7.1. Extension de `EntityRef` (selection domain)
Dans `apps/web/lib/selection/types.ts`, ajouter une nouvelle variante :

```ts
type EntityRef =
  | { kind: "commune"; inseeCode: string }
  | { kind: "infraZone"; id: string }
  | { kind: "transactionAddress"; id: string; bundleZ: number; bundleX: number; bundleY: number };
```

Notes :
- `id` = identifiant stable et compact dérivé de `addressKey`.
- `bundleZ/X/Y` = coordonnées du fichier bundle à charger au clic.

### 7.2. Types de rendu “historique”
```ts
type TransactionLine = {
  date: string;          // YYYY-MM-DD
  priceEur: number;
  typeLocal: "Maison" | "Appartement";
  surfaceM2?: number;
  isVefa: boolean;
};

type TransactionAddressHistory = {
  id: string;
  label: string;         // ex: "12 RUE DE LA PAIX, Montpellier"
  lat: number;
  lng: number;
  transactions: TransactionLine[];
};
```

---

## 8) Sorties statiques (datasets)

### 8.1. Emplacement
Sous `apps/web/public/data/{datasetVersion}/transactions/`

### 8.2. Couche points (MVP)
- `addresses.geojson`
  - `FeatureCollection<Point>`
  - Feature `id` = `addressId`
  - `properties` minimales :
    - `id` : `addressId`
    - `z`, `x`, `y` : coordonnées du bundle
    - `n` : nombre de transactions (optionnel pour style)

### 8.3. Bundles d’historiques
- `bundles/z{bundleZ}/{x}/{y}.json`
  - JSON objet : `{ [addressId]: TransactionAddressHistory }`

### 8.4. Versioning & manifest (obligatoire)
- Le pipeline doit ajouter ces nouveaux chemins à `files[]` dans :
  - `apps/web/public/data/{datasetVersion}/manifest.json`
  - `apps/web/public/data/current/manifest.json`
- Le runtime résout la version via `/data/current/manifest.json` (même logique que `communesIndexLite`).

---

## 9) Pipeline build-time (packages/importer)

### 9.0. Format d’entrée (CSV) — champs requis
Le MVP ingère la table CSV “mutations” issue de DVF open data (DVF+). L’importeur doit être robuste aux variations mineures de nommage de colonnes, mais doit, au minimum, pouvoir dériver les champs logiques suivants :

- **Localisation**
  - `inseeCode` (code commune INSEE, 5 chars) — ex: `code_commune`, `code_commune_insee`, `commune_code`
  - `lat`, `lng` — ex: `latitude`, `longitude`, `lat`, `lon`
- **Adresse**
  - `streetNumber` — ex: `numero_voie`, `no_voie`
  - `streetName` (libellé voie) — ex: `voie`, `nom_voie`, éventuellement composition `type_voie + voie`
- **Transaction**
  - `date` — ex: `date_mutation`
  - `priceEur` — ex: `valeur_fonciere`
  - `natureMutation` — ex: `nature_mutation` (pour taguer VEFA)
  - `typeLocal` — ex: `type_local`
  - `surfaceM2` (optionnel) — ex: `surface_reelle_bati`

Règle MVP : si `streetNumber` est absent/vide, la ligne est ignorée.

### 9.1. Commande
`pnpm --filter @choisir-sa-ville/importer export:static`

### 9.2. Étapes (décision complète)
1. **Téléchargement** DVF géolocalisées par département/année via downloadFile() (cache packages/importer/.cache/, TTL 180 jours pour années complètes, 7 jours pour année courante). Le relancement ne re-télécharge pas les fichiers déjà en cache.
2. **Parsing CSV streaming** de chaque fichier annuel, extraction des colonnes minimales nécessaires.
   - département 34,\n   - type_local Maison/Appartement/Dépendance/Sol (types étendus depuis 11 fév 2026),\n   - nature_mutation Vente/VEFA,\n   - `id_mutation` (champ DVF officiel pour identifier l'acte notarié),\n   - `streetNumber` requis,
   - `lat/lng` requis et finies,
   - suppression de toute colonne non nécessaire à l’affichage.
4. **Normalisation adresse** :
   - normaliser le libellé voie,
   - construire `addressKey`,
   - dériver `addressId` (hash stable).
5. **Agrégation** :
   - accumuler `transactions[]` par `addressId`,
   - définir `lat/lng` de l’adresse = coords de la dernière vente (date max),
   - construire `label` d’affichage (sans info personnelle).
6. **Déduplication** : clé composite date|prix|type|surface pour éliminer les doublons inter-années.
7. **Partitionnement bundles** :
   - calculer `(bundleZ, bundleX, bundleY)` depuis `lat/lng` (WebMercator),
   - écrire l’entrée dans le bon bundle.
8. **Exports** :
   - `addresses.geojson`,
   - `bundles/...`.
9. **Manifest** :
   - ajouter tous les fichiers produits à `files[]`.

### 9.3. Zoom de bundle (MVP)
- `bundleZ = 15`

Rationnel : navigation/clics à fort zoom → bundles localisés, taille maîtrisée.

---

## 10) Runtime web : lecture données transactions

### 10.1. Résolution datasetVersion
La lecture suit le pattern existant (cf. `apps/web/lib/data/communesIndexLite.ts`) :
- fetch `/data/current/manifest.json`
- lire `datasetVersion`
- fetch `/data/{datasetVersion}/transactions/...`

### 10.2. Loader bundles
Créer un module dédié (ex: `apps/web/lib/data/transactions/transactionBundles.ts`) :
- `fetchTransactionBundle(bundleZ, bundleX, bundleY, signal?)`
  - retourne la map `{ [addressId]: TransactionAddressHistory }`
- `getTransactionHistory(ref: { id, bundleZ, bundleX, bundleY }, signal?)`
  - charge le bundle, puis renvoie `bundle[id]` ou `null`

### 10.3. Caching (MVP)
Cache mémoire simple :
- cache des bundles déjà chargés (clé = `z/x/y + datasetVersion`)
- déduplication des requêtes concurrentes (pattern similaire à `StaticFilesEntityDataProvider.fetchWithDedup`)

---

## 11) Intégration MapLibre (apps/web)

### 11.1. Ajout du layer points
Dans `apps/web/components/vector-map.tsx` après `map.once("load")` :
- `map.addSource("transactionAddresses", { type: "geojson", data: /data/{version}/transactions/addresses.geojson })`
- `map.addLayer({ id: "transaction-addresses", type: "circle", source: "transactionAddresses", minzoom: 14, ... })`

### 11.2. Interaction clic (règle “label-first” respectée)
Dans `apps/web/lib/map/mapInteractionService.ts`, sur `click` :
1. `queryRenderedFeatures(point, { layers: [labelLayerId] })` (comportement actuel)
2. Si aucune entité “label” résolue, faire :
   - `queryRenderedFeatures(point, { layers: ["transaction-addresses"] })`
   - si hit : construire `{ kind: "transactionAddress", id, bundleZ, bundleX, bundleY }` à partir des `properties`
3. `EntityStateService.setActive(ref)` pour déclencher l’UI panneau droit.

### 11.3. Highlight/active visuel des points (optionnel MVP)
Deux options, décision MVP :
- **Option A (simple)** : pas de feature-state, uniquement un style statique + panneau droit au clic.
- **Option B (cohérente)** : appliquer `feature-state` (`highlight`/`active`) sur la source GeoJSON, en réutilisant le vocabulaire strict existant.

---

## 12) Panneau droit : affichage historique

### 12.1. Rendu
Dans `apps/web/components/right-panel-details-card.tsx` :
- Si `activeEntity.kind === "transactionAddress"` :
  - charger l’historique via le loader bundles,
  - afficher :
    - titre : “Transactions à cette adresse”
    - sous-titre : libellé adresse
    - liste transactions triées par date décroissante :
      - date
      - prix (format FR)
      - surface (si dispo) + calcul `prix/m²` (si surface > 0)
      - type (Maison/Appartement)
      - badge `VEFA` si `isVefa`

### 12.2. États UI
- `idle` : aucune sélection active
- `loading` : chargement bundle/historique
- `ready` : historique affiché
- `missing` : ref non trouvé dans bundle (ou bundle 404)
- `error` : erreur réseau/parsing non abort

---

## 13) Contraintes de performance & poids (budgets MVP)

### 13.1. Carte
- Points affichés uniquement à partir de `minzoom = 14` pour réduire le bruit.
- Objectif : interaction fluide (pan/zoom) sans freeze.

### 13.2. Bundles
- Objectif : un clic charge un bundle “local” de taille raisonnable (cible indicative : < 500 KB compressé).
- Si trop gros : augmenter `bundleZ` (plus fin) ou passer à un index “addressId → bundle” séparé.

### 13.3. Futur (si nécessaire)
- Remplacer GeoJSON par PMTiles (vector tiles) pour l’affichage des points, sans changer les bundles d’historiques.

---

## 14) Sécurité, privacy & conformité (MVP)

- Aucune donnée personnelle exportée/affichée (noms acheteur/vendeur, notaire, entreprise, etc.).
- Champs exportés limités à l’aide à la décision :
  - date, prix, surface, type, VEFA.
- Le libellé adresse est une **adresse postale** (déjà présente dans DVF+) ; on l’assume dans le cadre d’un produit “immobilier” mais on garde le minimum (pas d’identifiants d’acteurs).

---

## 15) Tests & critères d’acceptation

### 15.1. Tests pipeline (recommandés)
Ajouter des tests unitaires (si un harness existe) ou un script de validation automatisée :
- normalisation des voies,
- construction `addressKey` / `addressId` stable,
- filtrage (Maison/Appartement, Vente/VEFA, numéro requis),
- partition `(z/x/y)` correct,
- cohérence : `addresses.geojson` pointe vers des bundles existants.

### 15.2. Critères d’acceptation MVP
- `export:static` génère :
  - `transactions/addresses.geojson`
  - des bundles sous `transactions/bundles/...`
  - des entrées correspondantes dans `manifest.json` (version + current)
- Sur la carte (34) :
  - des points apparaissent à fort zoom
  - clic sur un point : panneau droit affiche l’historique complet, VEFA taguée
- Lignes sans numéro : ne génèrent ni point ni historique.

---

## 16) Sujets en suspens / backlog (post-MVP)

### Produit
- Saisie d’adresse (autocomplete) + “flyTo” sur la carte.
- Indicateurs d’aide à la décision :
  - comparables locaux,
  - index de marché “prix attendu aujourd’hui”,
  - détection de prix extrêmes et explications.
- Agrégats par commune (prix moyen/médian, évolution…).

### Données
- Regroupement d’adresse “tolérant” (résoudre variations de libellé, bis/ter, etc.).
- Gestion des transactions sans numéro (rues) avec UX dédiée (à éviter si trop bruité).
- Déduplication “lots” vs “bien” (cas d’acte multi-lots).

### Technique
- Bascule PMTiles pour la couche de points.
- Stratégie de compression/hosting (brotli/gzip) et budgets de taille.
- Observabilité build-time : métriques (nb adresses, distribution nb transactions/adresse, tailles bundles p95).
