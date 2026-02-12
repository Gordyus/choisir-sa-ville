# Documentation – Index

> Table des matières complète de la documentation projet.  
> Chaque spec indique son statut : **Draft** | **Validé** | **Implémenté** | **Abandonné**

---

## Guides projet (racine)

| Fichier | Rôle |
|---------|------|
| [`README.md`](../README.md) | Vue d'ensemble du projet |
| [`AGENTS.md`](../AGENTS.md) | Règles techniques non négociables (source de vérité) |
| [`CLAUDE.md`](../CLAUDE.md) | Référence rapide pour agents IA |
| [`CONTRIBUTING.md`](../CONTRIBUTING.md) | Guide de contribution |
| [`CHANGELOG.md`](../CHANGELOG.md) | Historique des versions |

## Vision & Stratégie

| Fichier | Rôle |
|---------|------|
| [`VISION_PRODUIT.md`](VISION_PRODUIT.md) | Vision produit, personas, modèle économique, objectifs rentabilité (🟡 Draft) |
| [`PRIORISATION.md`](PRIORISATION.md) | Priorisation features MVP, planning 6 semaines, métriques succès |

---

## Architecture & patterns techniques

| Fichier | Sujet |
|---------|-------|
| [`architecture/overview.md`](architecture/overview.md) | Vue d'ensemble Jamstack, couches, diagrammes |
| [`architecture/data-pipeline.md`](architecture/data-pipeline.md) | Pipeline de génération des datasets statiques |
| [`architecture/locality-model.md`](architecture/locality-model.md) | Modèle territorial (commune pivot, infraZones) |
| [`architecture/entity-graphics-binding.md`](architecture/entity-graphics-binding.md) | Binding entités ↔ carte (feature-state) |
| [`architecture/map-label-state.md`](architecture/map-label-state.md) | Système d'états labels MapLibre |
| [`architecture/map-url-sync.md`](architecture/map-url-sync.md) | Synchronisation URL ↔ état carte |

---

## Métriques

| Fichier | Sujet | Statut |
|---------|-------|--------|
| [`metrics/insecurity.md`](metrics/insecurity.md) | Insécurité SSMSI (3 familles + indice global) | ✅ Implémenté |

---

## Features

| Feature | Spec | Statut | Implémentation |
|---------|------|--------|----------------|
| **Modes d'affichage carto** | [`feature/display-modes-layer-menu/spec.md`](feature/display-modes-layer-menu/spec.md) | ✅ Implémenté | Terminée |
| **Progressive City Display** | [`feature/city-visibility/spec.md`](feature/city-visibility/spec.md) | ✅ Implémenté | Terminée |
| **Transactions DVF** | [`feature/transactions-address-history/spec.md`](feature/transactions-address-history/spec.md) | ✅ Implémenté | Terminée (MVP 34 + multi-lots) |
| **Indicateurs immobiliers** | [`feature/real-estate-multiscale-indicators/spec.md`](feature/real-estate-multiscale-indicators/spec.md) | Validé | Non commencée |
| **City Visibility** | [`feature/city-visibility/spec.md`](feature/city-visibility/spec.md) | ✅ Implémenté | Terminée |
| **Search + Travel** | [`feature/search-travel/spec.md`](feature/search-travel/spec.md) | Draft | Non commencée |
| **Political Color** | [`feature/political-color/spec.md`](feature/political-color/spec.md) | Draft | Non commencée |
| **Service Routing Backend** | [`feature/routing-service/spec.md`](feature/routing-service/spec.md) | Draft | Non commencée |
| **Métriques Communes Étendues** | [`feature/commune-metrics-extended/spec.md`](feature/commune-metrics-extended/spec.md) | Draft | Non commencée |
| **Recherche Multi-Critères** | [`feature/multi-criteria-search/spec.md`](feature/multi-criteria-search/spec.md) | Draft | Non commencée |

---

## Backlog technique

| Fichier | Rôle |
|---------|------|
| [`BACKLOG.md`](BACKLOG.md) | Tâches techniques planifiées, en cours, terminées |

---

## Archive

`archive/` contient la documentation historique :

- `API_CONTRACT.md`, `DB_MODEL.md` — ancienne architecture API/DB (abandonnée)
- `security-index-population-classification.md` — spec implémentée de classification par taille de population
- `FEATURE-2026-02-08-population-classification-COMPLETE.md` — rapport de complétion
- `work-logs/` — journaux d'implémentation (display modes, insecurity, etc.)
