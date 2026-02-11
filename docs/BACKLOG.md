# Backlog technique

> Liste centralisée des tâches techniques planifiées, en cours, ou terminées.  
> Pour les features produit, voir les specs dans `docs/feature/`.

---

## ✅ Terminé

### Refactor `downloadSources` vers un record nommé

- **Scope** : `packages/importer` uniquement
- **Résumé** : Remplacement des 5 constantes `DEFAULT_*_URL` par un objet `SOURCE_URLS` avec clés nommées et retour `Record<SourceKey, SourceMeta>`.
- **Fichiers** : `constants.ts`, `exportDataset.ts`
- **Date** : Terminé (anciennement `specs/todo-A`)

### Agrégat insécurité SSMSI (importer + UI)

- **Scope** : `packages/importer` + `apps/web`
- **Résumé** : Import données SSMSI (Parquet), calcul 3 taux thématiques + indice global pondéré, badge niveau + coloration carte.
- **Dépendance** : Refactor `downloadSources` (terminé)
- **Fichiers** : `exportMetricsInsecurity.ts`, `inspectSsmsi.ts`, `ssmsiToGroups.v1.json`, hooks frontend, badge, carte
- **Date** : Terminé (anciennement `specs/todo-B`)

---

## 🔜 Planifié

### Factorisation parsing DVF partagé

- **Scope** : `packages/importer`
- **Résumé** : Créer `dvfSharedParsing.ts` pour mutualiser le parsing CSV DVF entre transactions et indicateurs immobiliers.
- **Spec** : `docs/feature/real-estate-indicators/spec.md` (section 13)
- **Priorité** : Requis avant implémentation real-estate indicators

### Mutations multi-lots DVF

- **Scope** : `packages/importer` + `apps/web`
- **Résumé** : Regroupement des lignes DVF par `id_mutation`, affichage cohérent dans le panneau historique.
- **Spec** : `docs/feature/transactions-address-history/task/mutations-multi-lots.md`
- **Priorité** : Après stabilisation transactions V1

---

## 📋 Idées / investigation

_Rien pour le moment. Ajouter ici les pistes techniques non encore validées._
