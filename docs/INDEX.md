# Documentation - Index

Bienvenue dans la documentation technique du projet **Choisir sa Ville**.

---

## 📖 Lecture recommandée (dans l'ordre)

### 1. Découverte du projet

1. **[../README.md](../README.md)** - Vue d'ensemble et démarrage rapide
2. **[../AGENTS.md](../AGENTS.md)** - **Règles techniques NON NÉGOCIABLES** (à lire en premier)

### 2. Architecture

3. **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Architecture détaillée du projet
4. **[DATA_PIPELINE.md](./DATA_PIPELINE.md)** - Pipeline de génération de données

### 3. Concepts métier

5. **[LOCALITY_MODEL.md](./LOCALITY_MODEL.md)** - Modèle territorial (communes, zones infra)
6. **[CITY_OSM_INSEE_MAPPING.md](./CITY_OSM_INSEE_MAPPING.md)** - Mapping OSM ↔ INSEE

### 4. Features techniques

7. **[map-label-state-system.md](./map-label-state-system.md)** - Système de labels de carte
8. **[GUIDES.md](./GUIDES.md)** - Guides pratiques divers

---

## 📂 Organisation de la documentation

```
docs/
├── INDEX.md                          (ce fichier)
│
├── ARCHITECTURE.md                   Architecture globale (Jamstack)
├── DATA_PIPELINE.md                  Pipeline de génération de données
├── LOCALITY_MODEL.md                 Modèle territorial
├── CITY_OSM_INSEE_MAPPING.md         Mapping OSM/INSEE
├── map-label-state-system.md         Labels de carte
├── GUIDES.md                         Guides pratiques
│
├── feature/                          Documentation par feature
│   └── (à venir)
│
└── archive/                          Ancienne architecture (référence historique)
    ├── README.md                     Pourquoi ces docs sont archivés
    ├── API_CONTRACT.md               Ancienne API (obsolète)
    └── DB_MODEL.md                   Ancien schéma DB (obsolète)
```

---

## 🎯 Par cas d'usage

### Je veux comprendre l'architecture

➡️ Lire dans l'ordre :
1. [AGENTS.md](../AGENTS.md) - Règles générales
2. [ARCHITECTURE.md](./ARCHITECTURE.md) - Architecture détaillée
3. [DATA_PIPELINE.md](./DATA_PIPELINE.md) - Comment les données sont générées

### Je veux contribuer au frontend

➡️ Lire :
1. [AGENTS.md](../AGENTS.md) - Section "Frontend"
2. [ARCHITECTURE.md](./ARCHITECTURE.md) - Section "apps/web"
3. [map-label-state-system.md](./map-label-state-system.md) - Si travail sur la carte

### Je veux ajouter une nouvelle source de données

➡️ Lire :
1. [DATA_PIPELINE.md](./DATA_PIPELINE.md) - Section "Extension future"
2. Code de `packages/importer/src/exports/`

### Je veux comprendre le modèle territorial

➡️ Lire :
1. [LOCALITY_MODEL.md](./LOCALITY_MODEL.md) - Modèle complet
2. [CITY_OSM_INSEE_MAPPING.md](./CITY_OSM_INSEE_MAPPING.md) - Mapping OSM

### Je veux savoir pourquoi l'API a été supprimée

➡️ Lire :
1. [archive/README.md](./archive/README.md) - Explication de la migration
2. [ARCHITECTURE.md](./ARCHITECTURE.md) - Section "Décisions d'architecture"

---

## 🔍 Index par sujet

### Architecture & Design

- **Jamstack** : [ARCHITECTURE.md](./ARCHITECTURE.md) - Vue d'ensemble
- **Séparation des responsabilités** : [AGENTS.md](../AGENTS.md) - Section 1
- **Patterns** : [ARCHITECTURE.md](./ARCHITECTURE.md) - Section "Patterns d'architecture"

### Données

- **Pipeline de génération** : [DATA_PIPELINE.md](./DATA_PIPELINE.md)
- **Sources** : [DATA_PIPELINE.md](./DATA_PIPELINE.md) - Section "Sources de données"
- **Format de sortie** : [DATA_PIPELINE.md](./DATA_PIPELINE.md) - Section "Format de sortie"
- **Cache** : [ARCHITECTURE.md](./ARCHITECTURE.md) - Section "Provider Pattern"

### Frontend

- **Next.js** : [AGENTS.md](../AGENTS.md) - Section "Frontend"
- **Composants** : [ARCHITECTURE.md](./ARCHITECTURE.md) - Section "apps/web"
- **SelectionService** : [ARCHITECTURE.md](./ARCHITECTURE.md) - Section "Service de sélection"
- **EntityDataProvider** : [ARCHITECTURE.md](./ARCHITECTURE.md) - Section "Provider Pattern"

### Carte

- **MapLibre** : [AGENTS.md](../AGENTS.md) - Section "Règles carte MapLibre"
- **Labels** : [map-label-state-system.md](./map-label-state-system.md)
- **Interactions** : [ARCHITECTURE.md](./ARCHITECTURE.md) - Section "Spatial Resolution"

### Modèle territorial

- **Hiérarchie** : [LOCALITY_MODEL.md](./LOCALITY_MODEL.md)
- **Types INSEE** : [LOCALITY_MODEL.md](./LOCALITY_MODEL.md) - Section "Types"
- **Zones infra** : [LOCALITY_MODEL.md](./LOCALITY_MODEL.md) - Section "Infra-zones"

### Développement

- **Workflow** : [README.md](../README.md) - Section "Démarrage rapide"
- **Scripts** : [README.md](../README.md) - Section "Développement quotidien"
- **Contribution** : [README.md](../README.md) - Section "Contribution"
- **Tests** : [README.md](../README.md) - Section "Tests"

---

## 🆕 Changelog documentation

### Février 2026

- ✅ Migration vers architecture statique (Jamstack)
- ✅ Réécriture complète de `AGENTS.md`
- ✅ Création de `ARCHITECTURE.md`
- ✅ Création de `DATA_PIPELINE.md`
- ✅ Archivage de l'ancienne doc (API + DB)
- ✅ Mise à jour du `README.md`

### Archives

Voir [archive/README.md](./archive/README.md) pour l'historique de l'ancienne architecture.

---

## 📝 Contribuer à la documentation

### Principes

1. **Clarté** : Expliquer simplement, avec exemples
2. **Structure** : Sections, sous-sections, listes
3. **Code** : Blocs de code avec langage spécifié
4. **Mise à jour** : Tenir à jour avec le code
5. **Liens** : Cross-références entre documents

### Ajouter une nouvelle page

1. Créer le fichier `.md` dans `docs/` ou `docs/feature/`
2. Ajouter une entrée dans ce fichier (INDEX.md)
3. Ajouter un lien depuis les documents pertinents
4. Commit avec message clair

### Modifier une page existante

1. Vérifier que la modification est cohérente avec le code
2. Mettre à jour les cross-références si nécessaire
3. Ajouter une entrée dans "Changelog documentation" si changement majeur

---

## ❓ Questions fréquentes

### Où est la documentation de l'API ?

L'API a été supprimée. Voir [archive/README.md](./archive/README.md) pour comprendre pourquoi.

### Où est la documentation de la base de données ?

Aucune base de données n'est utilisée. Les données sont statiques (JSON). Voir [DATA_PIPELINE.md](./DATA_PIPELINE.md).

### Comment ajouter une nouvelle métrique ?

Voir [DATA_PIPELINE.md](./DATA_PIPELINE.md) - Section "Extension future > Nouvelles métriques".

### Comment tester en local ?

Voir [README.md](../README.md) - Section "Démarrage rapide".

### Les règles techniques sont où ?

**[AGENTS.md](../AGENTS.md)** - À lire en premier !

---

## 📞 Support

- **Issues** : https://github.com/votre-org/choisir-sa-ville/issues
- **Discussions** : https://github.com/votre-org/choisir-sa-ville/discussions

---

**Dernière mise à jour** : Février 2026
