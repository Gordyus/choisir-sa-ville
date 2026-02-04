# Pipeline de génération de données (packages/importer)

## Commande

```bash
pnpm --filter @choisir-sa-ville/importer export:static
```

## Sorties (structure réelle)

Le pipeline produit une version datée (timezone Europe/Paris) :

```
apps/web/public/data/
├── current/
│   └── manifest.json
└── vYYYY-MM-DD/
    ├── manifest.json
    ├── communes/
    │   ├── indexLite.json
    │   ├── postalIndex.json
    │   └── metrics/
    │       ├── core.json
    │       └── housing.json
    └── infraZones/
        └── indexLite.json
```

`current/manifest.json` est le **pointeur** utilisé au runtime : il contient `datasetVersion` et la liste des fichiers.

## Sources

Voir `packages/importer/src/exports/constants.ts`.

Le pipeline télécharge (avec cache local `packages/importer/.cache/`) :
- INSEE COG (communes / régions / départements)
- source codes postaux (data.gouv)
- références population (INSEE ZIP)

## Entrée du pipeline

`packages/importer/src/exports/exportDataset.ts` orchestre :
- téléchargement
- parsing CSV/ZIP
- mapping + normalisation
- export des fichiers (index/metrics)
- écriture des manifests (`vYYYY-MM-DD/manifest.json` + `current/manifest.json`)

## Ajouter une métrique

1. Créer un exporter dans `packages/importer/src/exports/communes/` (ex: `exportMetricsX.ts`)
2. L’appeler depuis `exportDataset.ts`
3. Ajouter un consommateur côté web (ex: nouveau module dans `apps/web/lib/data/`)
4. Documenter le nouveau fichier dans `docs/DATA_PIPELINE.md` + `docs/ARCHITECTURE.md`

