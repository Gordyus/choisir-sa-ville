# TODO A — Refactor `downloadSources` vers un record nommé

**Statut** : Prêt à implémenter
**Scope** : `packages/importer` uniquement — refactor pur, zéro nouveau comportement.
**Agent recommandé** : `dev-minor-change-implementer`

---

## Scope et objectif

Remplacer les cinq constantes individuelles et le tuple typé par `as` cast dans `downloadSources` par un objet `SOURCE_URLS` avec des clés nommées et un retour `Record<SourceKey, SourceMeta>`. Le pipeline doit produire un output bitwise identique après le refactor.

---

## Fichiers à modifier

### 1. `packages/importer/src/exports/constants.ts`

**Lignes concernées** : 1–10 (tout le fichier, 5 constantes).

**Ce qui change** :
- Supprimer les 5 constantes individuelles (`DEFAULT_SOURCE_URL`, `DEFAULT_REGION_SOURCE_URL`, `DEFAULT_DEPARTMENT_SOURCE_URL`, `DEFAULT_POSTAL_SOURCE_URL`, `DEFAULT_POPULATION_REFERENCE_SOURCE_URL`).
- Les remplacer par un objet `SOURCE_URLS` déclaré `as const`, avec les clés suivantes :

| Clé | URL actuelle (constante supprimée) |
|---|---|
| `communes` | `DEFAULT_SOURCE_URL` |
| `regions` | `DEFAULT_REGION_SOURCE_URL` |
| `departments` | `DEFAULT_DEPARTMENT_SOURCE_URL` |
| `postal` | `DEFAULT_POSTAL_SOURCE_URL` |
| `populationRef` | `DEFAULT_POPULATION_REFERENCE_SOURCE_URL` |

- Exporter le type `SourceKey = keyof typeof SOURCE_URLS`.

### 2. `packages/importer/src/exports/exportDataset.ts`

**Lignes concernées** :
- Lignes 9–15 : imports des 5 constantes → importer `SOURCE_URLS` uniquement.
- Lignes 93–102 : fonction `downloadSources` — reécrire pour itérer sur `SOURCE_URLS` et retourner un `Record<SourceKey, SourceMeta>`.
- Lignes 31–38 : usages `sources[0]`…`sources[4]` → deviennent `sources.communes`, `sources.regions`, `sources.departments`, `sources.postal`, `sources.populationRef`.
- Ligne 68 : appel à `writeManifest({ ..., sources })` — le type `ManifestPayload.sources` est `SourceMeta[]`. Il faut passer `Object.values(sources)` à la place.

**Correspondance index → clé** (pour éviter erreur de mapping) :

| Index actuel | Clé nouvelle | Usage dans `main()` |
|---|---|---|
| `sources[0]` | `sources.communes` | `parseCsvFile(sources.communes.filePath)` |
| `sources[1]` | `sources.regions` | `parseCsvFile(sources.regions.filePath)` |
| `sources[2]` | `sources.departments` | `parseCsvFile(sources.departments.filePath)` |
| `sources[3]` | `sources.postal` | `parseCsvFile(sources.postal.filePath)` |
| `sources[4]` | `sources.populationRef` | `readZipEntryText(sources.populationRef.filePath, ...)` |

---

## Acceptance criteria

1. `pnpm typecheck` passe avec 0 erreur.
2. `pnpm lint:eslint` passe avec 0 warning.
3. Aucun fichier `.ts` hors de `packages/importer/src/exports/` n'est touché.
4. Le type `SourceKey` est exporté depuis `constants.ts` et utilisable par les modules futurs (ex : ajout de la clé `ssmsi` dans le Task B).
5. Le pipeline `export:static` produit un output structurellement identique (mêmes fichiers, même manifest) après le refactor.
6. Aucune constante individuelle `DEFAULT_*` ne reste dans `constants.ts`.

---

## Justification du choix d'agent

`dev-minor-change-implementer` : le changement est localisé à deux fichiers dans un seul package, ne touche aucune couche frontend, ne nécessite aucune décision architecturale. C'est un renommage structuré avec une correspondance 1:1 explicite. Le seul point de vigilance (conversion `Record` vers `SourceMeta[]` pour `writeManifest`) est documenté ci-dessus.
