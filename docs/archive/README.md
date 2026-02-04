# Archive - Ancienne architecture

**Date d'archivage** : Février 2026

---

## Contexte

Ces documents décrivent l'**ancienne architecture** du projet, qui utilisait :
- API backend (Fastify)
- Base de données PostgreSQL
- Packages `@choisir-sa-ville/db` et `@choisir-sa-ville/core`

Cette architecture a été **abandonnée** en faveur d'une approche **statique (Jamstack)** :
- Données JSON générées au build (packages/importer)
- Next.js sert les fichiers statiques
- Cache IndexedDB côté client
- Aucun backend, aucune base de données en runtime

---

## Documents archivés

### DB_MODEL.md
Décrit le schéma PostgreSQL de l'ancienne architecture.

**Tables** : `commune`, `infra_zone`, `region`, `department`, `commune_postal_code`

**Raison de l'abandon** : Complexité inutile pour des données publiques qui changent peu. L'approche statique est plus simple, plus rapide et moins coûteuse.

### API_CONTRACT.md
Décrit les endpoints de l'API Fastify.

**Routes** : `/api/health`, `/api/areas/suggest`, etc.

**Raison de l'abandon** : Pas besoin d'API pour servir des données statiques. Next.js + cache IndexedDB suffisent.

---

## Architecture actuelle

Voir la **nouvelle documentation** :
- `../ARCHITECTURE.md` : Vue d'ensemble complète
- `../DATA_PIPELINE.md` : Pipeline de génération de données
- `../../AGENTS.md` : Règles techniques du projet

---

## Pourquoi ce changement ?

### Avantages de l'approche statique

✅ **Performance** : CDN, pas de latence DB  
✅ **Simplicité** : Pas de backend à maintenir  
✅ **Coût** : Hosting statique très bon marché  
✅ **Scalabilité** : CDN scale infiniment  
✅ **Offline-first** : IndexedDB permet usage offline  

### Inconvénients acceptés

❌ Pas de personnalisation temps réel  
❌ Mise à jour des données = re-build + re-deploy  

**Décision** : Ces inconvénients sont acceptables pour un MVP avec données publiques qui changent peu (quelques fois par an).

---

## Migration technique

L'ancienne architecture a été supprimée :
- ❌ `apps/api/` → Supprimé
- ❌ `packages/db/` → N'a jamais été créé
- ❌ `packages/core/` → N'a jamais été créé
- ❌ `docker-compose.yml` (PostgreSQL) → Supprimé

La nouvelle architecture conserve :
- ✅ `packages/importer/` → Pipeline de génération de données
- ✅ `apps/web/` → Application Next.js

---

## Pour référence historique uniquement

Ces documents sont conservés pour comprendre l'évolution du projet, mais **ne doivent pas être utilisés** pour le développement actuel.

Si vous voulez contribuer au projet, lisez la **documentation actuelle** dans `docs/` (hors `docs/archive/`).
