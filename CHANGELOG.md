# Changelog

Toutes les modifications notables du projet sont documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

---

## [Unreleased]

### Added

#### DVF Transaction History (Hérault)
- **Transaction points sur la carte** (zoom ≥14) pour le département de l'Hérault (34)
- **Points interactifs de première classe** : highlight au survol (bordure blanche élargie) + état active au clic (couleur orange, taille agrandie)
- **Panneau d'historique** : affichage des ventes immobilières par adresse avec date, prix, type de bien, surface, badge VEFA
- **Pattern bundles z15** : partitionnement des données par tuiles WebMercator pour performance optimale
- **hasData automatique** pour les sources propres (commune-labels-vector, arr_municipal, transaction-addresses)

#### URL Synchronization
- **Synchronisation viewport** : état de la carte (centre + zoom) sauvegardé dans les query parameters `?view=lat,lng,zoom`
- **Restauration d'état** : la carte revient à la position exacte au chargement de la page via l'URL
- **Pattern immutable** : évite la réinitialisation de la carte lors des mises à jour d'URL

### Fixed
- React keys dans la liste de transactions utilisent maintenant une clé composite unique au lieu de l'index
- Limitation AbortSignal dans le cache manifest documentée
- Map viewport state restauré depuis URL au chargement

### Changed
- Transaction layer feature-state nécessite Feature.id au niveau GeoJSON (le générateur doit set id field)

---

#### Package `@choisir-sa-ville/shared`

Création d'un package interne dédié aux **configurations et constantes métier** partagées entre `packages/importer` et `apps/web`.

**Contenu**:
- `src/config/insecurityMetrics.ts` — Configuration des catégories d'insécurité, niveaux de risque, et seuils de population

**Bénéfices**:
- ✅ Élimination de la duplication de configuration (Single Source of Truth)
- ✅ Type-safety garantie entre importer et web
- ✅ Maintenabilité améliorée (modification en un seul endroit)

**Migration**:
- `packages/importer/src/exports/shared/insecurityMetrics.ts` → déplacé vers `packages/shared/src/config/`
- `apps/web/lib/config/insecurityMetrics.ts` → supprimé (duplication éliminée)
- Imports mis à jour: `@choisir-sa-ville/shared/config/insecurity-metrics`

### BREAKING CHANGES

#### Indice de Sécurité: Classification par Taille de Population

L'indice de sécurité (insécurité) adopte désormais une classification par taille de population 
conforme aux standards internationaux (ONU-ICVS, classements homicides, littérature scientifique).

**Changements schéma JSON**:
- `indexGlobal` renommé en `indexGlobalNational`
- `level` renommé en `levelNational`
- Nouveaux champs: `populationCategory`, `indexGlobalCategory`, `levelCategory`, `rankInCategory`
- Taux exprimés en "pour 100,000 hab" au lieu de "pour 1,000" (×100)

**Impact utilisateur**:
- Badge affiche désormais le niveau **dans la catégorie de taille** (petites/moyennes/grandes)
- Comparaisons légitimes entre communes de tailles similaires
- Bordeaux (1ère ville >100k hab) correctement classée niveau 4

**Migration**:
- Dataset version: `v2026-02-08` (nouvelle structure)
- Frontend: Mise à jour automatique via hook `useInsecurityMetrics`

**Référence**: `specs/security-index-population-classification.md`

#### Fix: Adoption des Quintiles Standards pour le Mapping de Niveaux

**Changement méthodologique**:
- Fonction `mapIndexToLevel()` modifiée pour utiliser les quintiles standards (5 × 20 points)
- Ancien mapping asymétrique: [0-25, 25-50, 50-75, 75-99, 100]
- Nouveau mapping équilibré: [0-20, 20-40, 40-60, 60-80, 80-100]

**Justification**:
- Alignement sur Numbeo Crime Index (standard international grand public)
- Méthodologie académique (quintiles ICVS, standards ONU)
- Meilleure UX: Rouen #2/42 désormais niveau 4 (était 3 avec ancien mapping)

**Impact**:
- ~21% des grandes villes obtiennent niveau 4 (9/42) au lieu de 2.4% (1/42)
- Distribution plus équilibrée sur les 5 niveaux
- Top 9 grandes villes niveau 4: Bordeaux, Rouen, Grenoble, Lille, Lyon, Paris, Marseille, Montpellier, Saint-Denis

**Référence**: Validé par PO/Architect gatekeeper, conforme doc/RESEARCH-security-index-methodologies.md

### En cours de développement

- Recherche par nom de commune
- Détails complets des communes (métriques)
- Filtres de base

---

## [0.2.0] - 2026-02-04

### 🚀 Migration majeure : Architecture statique (Jamstack)

Cette version marque une **refonte complète de l'architecture** :
- Abandon de l'API backend (Fastify + PostgreSQL)
- Adoption d'une approche statique pure (données JSON + Next.js)

### Added

- **Pipeline de génération de données** (`packages/importer`)
  - Téléchargement automatique depuis INSEE et La Poste
  - Parse et normalisation des CSV
  - Génération de JSON optimisés (format colonnes compressées)
  - Cache local des téléchargements
  - Versioning automatique des datasets

- **Documentation complète**
  - `AGENTS.md` : Règles techniques réécrites pour architecture actuelle
  - `docs/ARCHITECTURE.md` : Architecture détaillée avec diagrammes
  - `docs/DATA_PIPELINE.md` : Documentation du pipeline de données
  - `docs/INDEX.md` : Index de la documentation
  - `CLEANUP_GUIDE.md` : Guide de nettoyage post-migration

- **Cache côté client**
  - IndexedDB via `CachedEntityDataProvider`
  - TTL 7 jours
  - Versioning des données

- **SelectionService headless**
  - Service de sélection découplé (0 deps UI/Map)
  - Pattern Observable
  - Support highlight + active states

- **EntityDataProvider abstraction**
  - Interface abstraite pour l'accès aux données
  - `StaticFilesEntityDataProvider` : lit depuis `/data/{version}/`
  - `CachedEntityDataProvider` : décorateur avec cache IndexedDB
  - Hooks React : `useEntity`, `useCommune`, `useInfraZone`

- **Spatial indexes**
  - Index en mémoire pour communes et infra-zones
  - Recherche par nom normalisé
  - Résolution spatiale pour désambiguïsation

### Changed

- **Architecture complète**
  - Données générées au build (vs runtime DB queries)
  - Next.js sert fichiers statiques (vs API endpoints)
  - Cache client-side (vs cache serveur)

- **Scripts npm**
  - `pnpm dev` : lance uniquement le frontend
  - `pnpm export:static` : génère les données statiques
  - Suppression de `build:deps` (packages obsolètes)

- **Documentation**
  - Archivage de l'ancienne doc (API + DB) dans `docs/archive/`
  - README complètement réécrit
  - Nouvelle structure de documentation

### Removed

- **API backend** (`apps/api/`)
  - Fastify server
  - Routes `/api/areas/suggest`, `/api/health`, etc.
  - Dépendances : Kysely, Fastify

- **Base de données PostgreSQL**
  - Schema SQL
  - Migrations
  - `docker-compose.yml`
  - Package `@choisir-sa-ville/db` (jamais créé)

- **Package core** (`packages/core/`)
  - Jamais créé, références supprimées

### Migration Guide

Voir `CLEANUP_GUIDE.md` pour les étapes manuelles de nettoyage.

### Breaking Changes

⚠️ **Cette version n'est PAS rétro-compatible avec v0.1.x**

- Aucun endpoint API disponible
- Aucune base de données runtime
- Les données doivent être générées avant le build frontend

---

## [0.1.0] - 2025-XX-XX

### Added

- **Frontend Next.js initial**
  - Carte interactive MapLibre
  - Composants shadcn/ui
  - Layout de base (header, footer)

- **Backend API Fastify** (obsolète depuis v0.2.0)
  - Routes de base
  - Connexion PostgreSQL
  - Endpoints health check

- **Modèle territorial**
  - Définition de la hiérarchie (Pays → Région → Département → Commune → Infra-zone)
  - Types INSEE (COM, ARM, COMD, COMA)
  - Documentation `LOCALITY_MODEL.md`

- **Tooling**
  - Monorepo pnpm workspaces
  - TypeScript strict
  - ESLint configuration

### Notes

Cette version utilisait une architecture API + PostgreSQL qui a été **abandonnée** en v0.2.0.

Voir `docs/archive/` pour la documentation de cette architecture.

---

## Format des versions

- **Major (X.0.0)** : Changements incompatibles (breaking changes)
- **Minor (0.X.0)** : Nouvelles fonctionnalités compatibles
- **Patch (0.0.X)** : Corrections de bugs

### Labels de changelog

- `Added` : Nouvelles fonctionnalités
- `Changed` : Modifications de fonctionnalités existantes
- `Deprecated` : Fonctionnalités bientôt supprimées
- `Removed` : Fonctionnalités supprimées
- `Fixed` : Corrections de bugs
- `Security` : Corrections de vulnérabilités

---

## Liens

- [Repository](https://github.com/votre-org/choisir-sa-ville)
- [Issues](https://github.com/votre-org/choisir-sa-ville/issues)
- [Documentation](./docs/INDEX.md)
