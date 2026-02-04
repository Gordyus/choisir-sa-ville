# Agrégat **insécurité / délinquance** (SSMSI) — communes × année

## Objectif

Générer, au **build time** via `packages/importer`, des indicateurs d’insécurité au **niveau commune × année**, à partir de la base officielle **SSMSI** (Ministère de l’Intérieur), puis les exporter dans le **dataset statique versionné** servi par `apps/web` (`apps/web/public/data/vYYYY-MM-DD/...`).

Cet agrégat est conçu pour être :
- **statique** (aucun backend runtime),
- **reproductible** (download → compile → export),
- **déterministe** (tri stable, arrondis stables),
- **conservateur** (catégories non mappées exclues des totaux),
- **documenté** (provenance + méthodologie + mapping versionné).

## Source officielle (entrée)

Ressource Parquet (URL stable, à utiliser telle quelle) :
- `https://www.data.gouv.fr/api/1/datasets/r/98fd2271-4d76-4015-a80c-bcec329f6ad0`

Libellé ressource (référence produit) :
- “COM - Base statistique communale de la délinquance enregistrée par la police et la gendarmerie nationales (fichier parquet)”

Licence attendue :
- “Licence Ouverte / Etalab” (à confirmer via métadonnées data.gouv au moment de l’implémentation).

## Jointure population (normalisation)

### Source population (convention repo)

Le repo produit la population au build time depuis la référence INSEE ZIP :
- `DEFAULT_POPULATION_REFERENCE_SOURCE_URL` (voir `packages/importer/src/exports/constants.ts`)
- fichier ZIP lu : `donnees_communes.csv`
- colonne population : première valeur trouvée parmi `pmun`, `ptot`, `population` (voir `buildPopulationByInsee` dans `packages/importer/src/exports/exportDataset.ts`)

La population est ensuite utilisée pour alimenter :
- `apps/web/public/data/{datasetVersion}/communes/indexLite.json` (colonne `population`)
- et, par dérivation si nécessaire, via les enfants INSEE (communes associées/déléguées, etc.) dans `packages/importer/src/exports/communes/exportIndexLite.ts`.

### Hypothèse importante

La référence population INSEE est **une photographie** (pas nécessairement annuelle). Les taux SSMSI “par année” sont donc, par défaut, normalisés par **la même population de référence** (limitation à documenter dans `meta.json`).

### Formule de taux

Pour une commune `c` et une année `y` :
- `ratePer1000 = (facts / population) * 1000`
- arrondi : **1 décimale** (ex: `14.2`)

## Indicateurs (sortie)

3 taux thématiques sont calculés pour chaque commune et chaque année :
- `violencesPersonnesPer1000`
- `securiteBiensPer1000`
- `tranquillitePer1000`

Unité (champ `unit`) :
- `faits pour 1000 habitants`

## Mapping SSMSI → groupes (exigence critique)

### Problème

Le Parquet SSMSI contient des catégories d’infractions (codes / libellés / nomenclatures) dont les colonnes et valeurs peuvent évoluer. Un mapping “en dur” est risqué.

### Approche attendue

1) **Étape de découverte** (“inspect”) qui :
   - liste les **colonnes** et **types**,
   - affiche un échantillon des valeurs distinctes utiles au mapping (codes/libellés),
   - aide à identifier la (ou les) colonnes fiables servant de clé de mapping.

2) **Mapping versionné** dans le code importer, sous forme de JSON, par exemple :
- `packages/importer/src/exports/communes/metrics/insecurity/mapping/ssmsiToGroups.v1.json`

Contraintes mapping :
- clés et noms **camelCase** (convention repo),
- mapping **conservateur** : si doute → laisser “unmapped”.

3) Agrégation :
   - sommer les “facts” uniquement pour les catégories **mappées** dans un des 3 groupes,
   - laisser de côté les catégories “unmapped” (exclues des totaux),
   - produire un rapport (console + section dans `meta.json`) : nombre de lignes non mappées + top catégories.

### Guideline de démarrage (à affiner)

- **violencesPersonnes** : violences physiques, violences sexuelles, agressions, vols avec violence (si distingué)
- **securiteBiens** : cambriolages, vols sans violence, vols de véhicules, vols dans véhicules
- **tranquillite** : dégradations / destructions / incendies volontaires (si présent)

## Export statique (convention repo)

### Pourquoi ce format

Les exports “métriques communes” existants utilisent un format **tabulaire compressé** :
```json
{ "columns": ["insee", "..."], "rows": [["01001", ...], ...] }
```
Ce format est stable, compact, et adapté au chargement frontend.

### Emplacement des fichiers

L’agrégat doit être exporté **dans le dataset versionné**, et référencé dans le manifest :

- `apps/web/public/data/{datasetVersion}/communes/metrics/insecurity/meta.json`
- `apps/web/public/data/{datasetVersion}/communes/metrics/insecurity/{year}.json`

Le pointeur runtime reste :
- `apps/web/public/data/current/manifest.json` → contient `datasetVersion` + `files[]`

### Schéma `{year}.json` (adapté aux conventions)

```json
{
  "year": 2023,
  "unit": "faits pour 1000 habitants",
  "source": "Ministère de l’Intérieur – SSMSI (base communale de la délinquance enregistrée)",
  "generatedAtUtc": "2026-02-04T12:34:56.000Z",
  "columns": [
    "insee",
    "population",
    "violencesPersonnesPer1000",
    "securiteBiensPer1000",
    "tranquillitePer1000"
  ],
  "rows": [
    ["01001", 860, 1.2, 4.7, null],
    ["01002", 270, null, null, null]
  ]
}
```

Notes :
- Les communes sont triées par `insee` croissant (ordre lexicographique, codes sur 5 caractères).
- `population` est la population de référence (voir “Jointure population”).
- Une valeur `null` indique “pas de donnée SSMSI exploitable / pas de mapping / pas de population”.

### Schéma `meta.json` (adapté aux conventions)

```json
{
  "source": "Bases statistiques communales de la délinquance enregistrée - SSMSI",
  "license": "Licence Ouverte / Etalab",
  "unit": "faits pour 1000 habitants",
  "yearsAvailable": [2021, 2022, 2023],
  "generatedAtUtc": "2026-02-04T12:34:56.000Z",
  "methodology": "Agrégation communale par catégorie, normalisée par population INSEE de référence (cf. populationReference).",
  "inputs": {
    "ssmsiParquetUrl": "https://www.data.gouv.fr/api/1/datasets/r/98fd2271-4d76-4015-a80c-bcec329f6ad0",
    "ssmsiResourceId": "98fd2271-4d76-4015-a80c-bcec329f6ad0",
    "populationReference": {
      "inseeZipUrl": "(DEFAULT_POPULATION_REFERENCE_SOURCE_URL)",
      "zipEntry": "donnees_communes.csv",
      "fieldsTried": ["pmun", "ptot", "population"],
      "note": "Population non annuelle : taux par année normalisés avec une population de référence."
    }
  },
  "mapping": {
    "mappingFile": "ssmsiToGroups.v1.json",
    "unmapped": {
      "rows": 0,
      "top": [
        { "key": "UNKNOWN_CATEGORY", "rows": 0 }
      ]
    }
  }
}
```

## Déterminisme & qualité

Exigences de déterminisme :
- tri stable des communes (`insee` asc)
- tri stable des années (`year` asc)
- arrondi stable **à 1 décimale** pour les taux

Validations minimales avant écriture des fichiers finaux :
- `yearsAvailable` non vide
- pas de “facts” négatifs (si la colonne existe)
- pas de taux négatifs
- si un taux est non-null : `population > 0`
- checks de structure JSON (présence des champs et colonnes attendues)

## Cache & “force download” (convention repo)

Le downloader existant (`packages/importer/src/exports/shared/downloadFile.ts`) met en cache dans :
- `packages/importer/.cache/`

Le nom du fichier cache commence par un hash de l’URL, suivi du basename de l’URL.
Pour “forcer” un re-téléchargement de la ressource SSMSI, supprimer le fichier cache correspondant (exemple PowerShell, à adapter selon le nom exact présent sur la machine) :
- `Get-ChildItem packages\\importer\\.cache | Where-Object Name -match \"98fd2271\" | Remove-Item -Force`

## Intégration au pipeline

Le pipeline existant est orchestré par :
- `packages/importer/src/exports/exportDataset.ts` via `pnpm --filter @choisir-sa-ville/importer export:static`

L’intégration attendue de cet agrégat :
- téléchargement SSMSI ajouté aux sources du manifest versionné,
- export des fichiers `communes/metrics/insecurity/...`,
- ajout des nouveaux chemins dans `files[]` du manifest.

