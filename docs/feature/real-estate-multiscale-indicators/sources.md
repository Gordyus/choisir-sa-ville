# Sources de données - Indicateurs immobiliers multi-échelle

**Feature** : `real-estate-multiscale-indicators`  
**Date** : 11 février 2026  
**Scope MVP** : Vente uniquement (loyer en post-MVP)

---

## Source unique (MVP) : DVF géolocalisées

### Identité

**Nom** : Demandes de Valeurs Foncières géolocalisées  
**Producteur** : DGFiP (Direction Générale des Finances Publiques)  
**Diffuseur** : Etalab via data.gouv.fr  
**URL dataset** : https://www.data.gouv.fr/fr/datasets/demandes-de-valeurs-foncieres-geolocalisees/  
**URL fichiers** : `https://files.data.gouv.fr/geo-dvf/latest/csv/{YEAR}/departements/{DEPT}.csv.gz`

### Format

**Type** : CSV gzippé  
**Encodage** : UTF-8  
**Séparateur** : `,` (virgule)  
**Taille** : ~5-50 MB/département/année (gzippé)

### Licence

**Licence Ouverte / Open Licence 2.0** (Etalab)  
**Réutilisation** : Autorisée (commerciale et non-commerciale)  
**Attribution** : Mention "Source : DGFiP - Etalab" recommandée

### Périmètre temporel

**Fenêtre glissante** : ~5 ans (actuellement 2020-2025)  
**Mise à jour** : Semestrielle (avril + octobre)  
**Scope MVP** : 24 mois glissants pour calcul médiane

### Colonnes requises (extraction)

Voir `packages/importer/src/exports/transactions/parseDvfCsv.ts` pour la liste exhaustive.

**Colonnes critiques** :
- `id_mutation` : Identifiant unique de la mutation (acte notarié)
- `date_mutation` : Date de la vente (YYYY-MM-DD)
- `valeur_fonciere` : Prix de vente total (€)
- `code_commune` : Code INSEE commune (5 caractères)
- `numero_voie` : Numéro de voie
- `nom_voie` ou `voie` : Libellé de la voie
- `type_local` : Type de bien (Maison, Appartement, Dépendance, Local)
- `surface_reelle_bati` : Surface habitable (m²)
- `latitude`, `longitude` : Coordonnées géographiques (WGS84)
- `nature_mutation` : Type de mutation (Vente, VEFA, etc.)

### Stratégie de téléchargement

**Implémentation** : `packages/importer/src/exports/transactions/dvfGeoDvfSources.ts`  
**Cache local** : `packages/importer/.cache/`  
**TTL cache** :
- 180 jours pour années complètes (2020-2024)
- 7 jours pour année courante (2025)

**Fonction** : `downloadFile(url, cachePath, ttlDays)`

### Factorisation avec transactions-address-history

**Module partagé** : `packages/importer/src/exports/transactions/dvfSharedParsing.ts` (à créer)

**Fonctions factorisées** :
- `parseDvfMutation(row: CsvRecord): DvfMutation | null` - Parse une ligne CSV DVF
- `computePricePerM2(mutation: DvfMutation): number | null` - Calcule €/m² selon règle projet
- `normalizeMutationAddress(mutation: DvfMutation): AddressKey` - Normalise adresse

**Règles de calcul €/m²** (identiques entre features) :
- **Numérateur** : `valeur_fonciere` (prix total mutation)
- **Dénominateur** : Somme des `surface_reelle_bati` pour lots de type `Maison` ou `Appartement` strictement positives
- **Exclusions** : Dépendances, Sol, Parcelles nues
- **Seuil validité** : Si dénominateur = 0 ou `prix/m²` hors plage [100€ - 20000€] → mutation exclue

### Usage pour real-estate-multiscale-indicators

**Agrégats communaux** :
- Médiane `prix/m²` par commune (fenêtre 24 mois)
- Quartiles Q1, Q3 pour calcul IQR
- Nombre de transactions comparables

**Agrégats hexagonaux** :
- Médiane `prix/m²` par hexagone H3 (résolution 8 ou 9, à définir)
- Nombre de transactions par hexagone
- Seuil minimal : `n >= 3` pour affichage

**Baseline prix** : Médiane communale DVF = baseline (pas d'import INSEE externe)

---

## Sources post-MVP (loyer)

### Option A : CLAMEUR (loyers d'annonce)

**URL probable** : https://www.data.gouv.fr/fr/datasets/carte-des-loyers-indicateurs-de-loyers-dannonce-par-commune/  
**Type** : Loyers d'annonce (pas loyers réels)  
**Biais connu** : +10-15% vs loyers conclus  
**Disclaimer obligatoire** : "Loyers basés sur annonces, peuvent différer des loyers réels"

**Colonnes attendues** :
- `code_insee` : Code commune INSEE
- `loyer_median_m2` : Loyer médian €/m²/mois
- `nb_annonces` : Nombre d'annonces
- `type_bien` : Appartement / Maison

**Seuil qualité** : `nb_annonces >= 10`

### Option B : Observatoire loyers réels (si disponible)

À identifier lors de la phase post-MVP.

---

## Conformité & sécurité

### RGPD

**Aucune donnée personnelle** :
- DVF est anonymisé à la source (pas de noms acheteur/vendeur)
- Seules les données immobilières (prix, surface, type) sont utilisées

### Licence & attribution

**Attribution recommandée** :
- Page "À propos" : "Données DVF © DGFiP - Etalab, Licence Ouverte 2.0"
- Métadonnées dataset : Inclure source dans `meta.json`

---

## Monitoring & qualité

### Métriques build-time recommandées

À logger dans la console lors de `export:static` :
- Nombre de mutations DVF importées (total + par département)
- Nombre de communes avec agrégat calculé
- Nombre de communes éligibles micro
- Nombre d'hexagones générés
- Distribution `n` transactions par hex (min, médiane, p95, max)
- % de mutations exclues (€/m² hors plage, surface manquante, etc.)

### Tests de régression

**Tests unitaires** (recommandés) :
- Parsing DVF : lignes valides/invalides
- Calcul €/m² : cas nominal, edge cases (dépendance seule, surface = 0, etc.)
- Normalisation adresse : cas avec accents, ponctuation, etc.

**Tests d'intégration** :
- Cohérence entre `transactions-address-history` et `real-estate` :
  - Même nombre de communes avec données
  - Médianes dans la même plage (écart < 5% acceptable)
