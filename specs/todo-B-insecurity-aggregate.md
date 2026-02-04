# TODO B — Agrégat insécurité SSMSI (importer + UI)

**Statut** : Prêt à implémenter (après Task A)
**Scope** : `packages/importer` (pipeline) + `apps/web` (badge + coloration carte)
**Agent recommandé** : `dev-feature-implementer`

---

## Scope et objectif

Importer les données de délinquance communales (SSMSI, Ministère de l'Intérieur, format Parquet), calculer 3 taux thématiques + 1 indice global pondéré, exporter dans le dataset statique, puis afficher un badge de niveau sur les cards d'entité et offrir une coloration des polygones sur la carte.

La spec de référence sur les données brutes et le modèle de zone-level est : `specs/zone-safety-insecurity-index-spec.md`. Ce TODO B concerne l'agrégat commune-level qui alimente cette spec en amont.

---

## Dépendances

- **Task A doit être complété avant de démarrer Task B.** La clé `ssmsi` sera ajoutée dans `SOURCE_URLS` (défini dans Task A).

---

## Découpage en sous-étapes

Les étapes sont numérotées dans l'ordre d'exécution. Les dépendances entre elles sont notées.

### B1 — Ajout des dépendances Parquet dans `packages/importer`

**Fichier** : `packages/importer/package.json`

Ajouter en `dependencies` :
- `hyparquet` (dernière version stable)
- `hyparquet-compressors` (dernière version stable)

Justification : pure JS, ESM natif, pas de dépendances natives — décision validée en amont.

**Dépendance** : aucune (peut être fait en parallèle avec B2).

---

### B2 — Script d'inspection du Parquet SSMSI

**Fichier** : `packages/importer/src/exports/communes/metrics/insecurity/inspectSsmsi.ts`

Script CLI ponctuel (pas intégré au pipeline) qui :
- télécharge le Parquet via `downloadFile(url, { cacheTtlMs: 90 * 24 * 60 * 60 * 1000 })` (TTL 3 mois)
- liste les colonnes + types
- affiche un échantillon des valeurs distinctes sur les colonnes de catégorie d'infraction
- oriente la rédaction du mapping v1

Output : console uniquement. Ce script n'écrit aucun fichier dans le dataset.

**Dépendance** : B1 (hyparquet doit être installé).

---

### B3 — Mapping versionné `ssmsiToGroups.v1.json`

**Fichier** : `packages/importer/src/exports/communes/metrics/insecurity/mapping/ssmsiToGroups.v1.json`

Fichier JSON versionné déclarant, pour chaque catégorie d'infraction identifiée en B2, son appartenance à l'un des 3 groupes :

| Groupe | Contenu typique |
|---|---|
| `violencesPersonnes` | Violences physiques, agressions, violences sexuelles, vols avec violence |
| `securiteBiens` | Cambriolages, vols sans violence, vols de véhicules, vols dans véhicules |
| `tranquillite` | Dégradations, destructions, incendies volontaires, incivilités |

Catégories non identifiables ou ambiguës : classées en `unmapped` (exclues des totaux). Approche **conservateur**.

Toutes les clés en camelCase (convention repo).

**Dépendance** : B2 (les valeurs distinctes sont connues).

---

### B4 — Module `exportMetricsInsecurity.ts`

**Fichier** : `packages/importer/src/exports/communes/metrics/insecurity/exportMetricsInsecurity.ts`

Ce module :
1. Télécharge le Parquet SSMSI via `downloadFile(url, { cacheTtlMs: 90 * 24 * 60 * 60 * 1000 })`.
2. Parse avec `hyparquet`.
3. Lit le mapping `ssmsiToGroups.v1.json`.
4. Pour chaque commune × année : sommer les faits par groupe mappé, produire les 3 taux (`ratePer1000 = facts / population * 1000`, arrondi à 1 décimale).
5. Calcule l'indice global (voir section "Formule de l'indice global" ci-dessous).
6. Valide les sorties (pas de taux négatif, population > 0 si taux non-null).
7. Écrit :
   - `communes/metrics/insecurity/meta.json` (inclut `geoLevel: "commune"`, `fallbackChain: []`, rapport unmapped)
   - `communes/metrics/insecurity/{year}.json` pour chaque année disponible

Population de référence : utiliser le même `populationByInsee` produit par le pipeline principal (passé en paramètre).

**Dépendance** : B1, B3.

---

### B5 — Intégration dans `exportDataset.ts`

**Fichier** : `packages/importer/src/exports/exportDataset.ts`

- Ajouter la clé `ssmsi` dans `SOURCE_URLS` (dans `constants.ts`, après Task A).
- Appeler `exportMetricsInsecurity` depuis `main()`, après les exports existants.
- Ajouter les fichiers produits dans `files[]` pour le manifest.

**Dépendance** : Task A complété, B4.

---

### B6 — Badge niveau insécurité sur les cards d'entité (frontend)

**Couche** : `components/`
**Dépendance côté data** : un hook dans `lib/data/` qui charge `communes/metrics/insecurity/{year}.json` et expose les valeurs pour une entité donnée.

Le badge affiche un niveau parmi 4 :

| Niveau | Couleur suggérée |
|---|---|
| Faible | vert |
| Modéré | jaune/ambre |
| Élevé | orange |
| Très élevé | rouge |

Le badge doit fonctionner pour **toute entité** (commune, infraZone, futur quartier) — voir section "Notion d'entité" ci-dessous.

Composant : shadcn/ui badge avec variant par niveau. Tailwind pour les couleurs.

**Dépendance** : B4 (données disponibles dans le dataset).

---

### B7 — Coloration des polygones selon le niveau (carte)

**Couche** : `lib/map/`

Option (toggle UI dans `components/`) pour activer la coloration des polygones communes selon leur niveau d'insécurité global. Quand activée :
- les polygones sont colorés selon la même palette que le badge (faible → très élevé)
- les entités sans donnée restent avec la couleur par défaut

Implémentation : injection de style conditionnel sur la couche polygone communes, driven par les données chargées côté data. Le binder (`EntityGraphicsBinder`) n'est pas concerné — c'est une couche de style statique sur les polygones, pas un feature-state.

Cleanup obligatoire : si le toggle est désactivé, les styles sont réinitialisés.

**Dépendance** : B4, B6.

---

## Familles d'insécurité et formule de l'indice global

### Les 3 familles (taux par 1000 habitants)

| Famille | Clé de sortie | Contenu |
|---|---|---|
| Sécurité des personnes | `violencesPersonnesPer1000` | Violences physiques, agressions, violences sexuelles |
| Sécurité des biens | `securiteBiensPer1000` | Cambriolages, vols sans violence, vols de véhicules |
| Tranquillité publique | `tranquillitePer1000` | Dégradations, destructions, incivilités |

### Indice global — agrégation pondérée

L'indice global est une moyenne pondérée des 3 taux, normalisée en [0..100] par rang percentile national (cohérent avec `zone-safety-insecurity-index-spec.md` section 6.3).

**Poids proposés** (basés sur les conventions des enquêtes victimisation françaises, ex. ECSV, et la relative stabilité statistique des catégories) :

| Famille | Poids |
|---|---|
| Sécurité des personnes | 0.40 |
| Sécurité des biens | 0.35 |
| Tranquillité publique | 0.25 |

Justification :
- Les violences contre les personnes sont le critère le plus significatif pour la qualité de vie perçue selon les enquêtes victimisation françaises.
- Les vols et cambriolages sont très parlants pour les habitants mais moins graves statistiquement.
- Les incivilités impactent la perception quotidienne mais sont moins corrélées au sentiment d'insécurité fort.

**Formule** :
```
scoreRaw = 0.40 * violencesPersonnesPer1000
         + 0.35 * securiteBiensPer1000
         + 0.25 * tranquillitePer1000

indexGlobal = round(100 * percentile_rank(scoreRaw, distribution_nationale))
```

Si une famille est `null` pour une commune : elle est exclue du calcul et les poids restants sont renormalisés (somme = 1). Si les 3 familles sont `null`, l'indice global est `null`.

La colonne de sortie dans `{year}.json` est `indexGlobal` (entier 0–100).

---

## Niveaux d'affichage et seuils

### Approche proposée : percentiles nationaux

Les seuils sont définis sur la distribution nationale de `indexGlobal` pour chaque année. Cette approche est cohérente avec la spec `zone-safety-insecurity-index-spec.md` (qui utilise déjà le percentile rank) et évite les seuils absolus qui deviendraient obsolètes avec l'évolution des données.

| Niveau | Plage `indexGlobal` | Interprétation |
|---|---|---|
| Faible | 0–24 | Quartile inférieur — insécurité below average |
| Modéré | 25–49 | Médiane inférieure |
| Élevé | 50–74 | Médiane supérieure |
| Très élevé | 75–100 | Quartile supérieur |

Ces seuils sont baked dans le calcul au build time (pas de calcul percentile au runtime). Le fichier `meta.json` documente les seuils utilisés pour chaque année.

---

## Notion d'entité — contrainte architecturale

Le badge et la coloration carte sont conçus en dehors de toute hypothèse "commune-only". Le hook de données doit accepter un `EntityRef` générique. Aujourd'hui les données sont au niveau commune — pour une infraZone, le runtime récupère la valeur de la commune parente via `parentId`. Dans le futur (quartiers, IRIS), le même pattern s'applique avec un `fallbackChain` déclaré dans `meta.json`.

Ce pattern est documenté dans `docs/LOCALITY_MODEL.md` (section "Héritage géographique") et dans `docs/ARCHITECTURE.md` (section "`meta.json` et fallbackChain").

---

## Docs à mettre à jour

- `docs/ARCHITECTURE.md` — fichiers par niveau géo, pattern `meta.json`
- `docs/LOCALITY_MODEL.md` — notion d'entité générique, héritage géographique
- `docs/feature/communes-metrics-insecurity-ssmsi.md` — familles, indice global, niveaux, UX
- `docs/DATA_PIPELINE.md` — ajout de `communes/metrics/insecurity/` dans la structure de sortie

---

## Justification du choix d'agent

`dev-feature-implementer` : ce TODO couvre une feature complète validée architecturalement, touchant deux packages et plusieurs couches (`lib/data/`, `lib/map/`, `components/`). Les décisions produit (poids, seuils, familles) sont prises dans ce document. L'agent doit se reporter à la spec approuvée et implémenter sans décision architecturale supplémentaire.
