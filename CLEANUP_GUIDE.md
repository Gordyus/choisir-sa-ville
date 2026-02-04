# Guide de nettoyage du projet

Ce document liste les actions manuelles à effectuer pour finaliser la migration vers l'architecture statique.

**Date** : Février 2026

---

## ✅ Actions déjà effectuées (automatiquement)

- [x] Réécriture de `AGENTS.md` avec architecture actuelle
- [x] Création de `docs/ARCHITECTURE.md` (nouvelle doc complète)
- [x] Création de `docs/DATA_PIPELINE.md` (documentation pipeline)
- [x] Création de `docs/archive/README.md` (explication archivage)
- [x] Déplacement de `docs/DB_MODEL.md` → `docs/archive/DB_MODEL.md`
- [x] Déplacement de `docs/API_CONTRACT.md` → `docs/archive/API_CONTRACT.md`
- [x] Réécriture complète du `README.md`
- [x] Mise à jour du `package.json` root (scripts simplifiés)
- [x] Création de `MIGRATION_2026_02.md` (ce document)

---

## 🔴 Actions à effectuer MANUELLEMENT

### 1. Supprimer l'ancienne API

```bash
# Windows PowerShell
Remove-Item -Recurse -Force apps\api

# Ou dans l'explorateur Windows :
# Supprimer le dossier apps/api
```

**Vérification** :
```bash
# Ce dossier ne doit plus exister
ls apps/
# Devrait afficher uniquement : web
```

### 2. Supprimer docker-compose.yml

```bash
# Windows PowerShell
Remove-Item docker-compose.yml

# Ou dans l'explorateur Windows :
# Supprimer le fichier docker-compose.yml à la racine
```

**Raison** : La base de données PostgreSQL n'est plus utilisée.

### 3. (Optionnel) Nettoyer .pgdata/

Si le dossier `.pgdata/` existe (créé par docker-compose) :

```bash
# Windows PowerShell
Remove-Item -Recurse -Force .pgdata

# Ou dans l'explorateur Windows :
# Supprimer le dossier .pgdata à la racine
```

### 4. Mettre à jour .gitignore

Vérifier que `.gitignore` contient bien :

```gitignore
# Build outputs
dist/
.next/
out/

# Dependencies
node_modules/

# Cache
.cache/
.turbo/

# Data (généré au build)
apps/web/public/data/*/

# Env
.env
.env.local

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/

# Legacy (si dossier encore présent)
.pgdata/
```

---

## 🧪 Vérifications post-nettoyage

### 1. Structure du projet

```bash
ls apps/
# Devrait afficher uniquement : web

ls packages/
# Devrait afficher uniquement : importer

ls docs/
# Devrait afficher :
# - ARCHITECTURE.md
# - DATA_PIPELINE.md
# - LOCALITY_MODEL.md
# - archive/
# - ... (autres docs actuels)
```

### 2. Builds fonctionnels

```bash
# 1. Typecheck
pnpm typecheck
# Devrait passer sans erreur

# 2. Lint
pnpm lint:eslint
# Devrait passer avec 0 warnings

# 3. Générer les données (si pas déjà fait)
pnpm export:static
# Devrait créer apps/web/public/data/v{date}/

# 4. Build frontend
pnpm build
# Devrait build Next.js sans erreur

# 5. Démarrer le dev
pnpm dev
# Devrait lancer Next.js sur http://localhost:3000
```

### 3. Données statiques présentes

```bash
ls apps/web/public/data/
# Devrait afficher au moins un dossier versionné, ex:
# - current (symlink ou copie)
# - v2026-02-04/

ls apps/web/public/data/current/
# Devrait afficher :
# - manifest.json
# - communes/
# - infra-zones/
```

Si le dossier `data/` est vide, générer les données :
```bash
pnpm export:static
```

---

## 📋 Checklist finale

- [ ] Dossier `apps/api/` supprimé
- [ ] Fichier `docker-compose.yml` supprimé
- [ ] (Optionnel) Dossier `.pgdata/` supprimé
- [ ] `.gitignore` à jour
- [ ] `pnpm typecheck` passe ✅
- [ ] `pnpm lint:eslint` passe ✅
- [ ] `pnpm export:static` génère les données ✅
- [ ] `pnpm build` réussit ✅
- [ ] `pnpm dev` lance l'app ✅
- [ ] Documentation lue : `AGENTS.md`, `docs/ARCHITECTURE.md`

---

## 🎉 Une fois terminé

1. **Commit les changements** :
   ```bash
   git add .
   git commit -m "docs: migration vers architecture statique

   - Réécriture AGENTS.md avec architecture Jamstack
   - Nouvelle documentation (ARCHITECTURE.md, DATA_PIPELINE.md)
   - Archivage ancienne doc (API + DB)
   - Suppression apps/api et docker-compose.yml
   - README mis à jour"
   ```

2. **Push** :
   ```bash
   git push origin main
   ```

3. **Informer l'équipe** :
   - Partager le nouveau `README.md`
   - Faire lire `AGENTS.md` et `docs/ARCHITECTURE.md`
   - Expliquer le nouveau workflow (generate data → dev)

---

## 🆘 En cas de problème

### Les données ne se génèrent pas

```bash
cd packages/importer
pnpm install
pnpm export:static
```

Vérifier la sortie console pour identifier l'erreur (réseau, parsing, etc.).

### Le frontend ne trouve pas les données

Vérifier que `apps/web/public/data/current/` existe et contient :
- `manifest.json`
- `communes/indexLite.json`

Si absent :
```bash
pnpm export:static
```

### Erreurs TypeScript

```bash
pnpm typecheck
```

Si erreurs dans `apps/web`, vérifier que les imports de types sont corrects.

Si erreurs dans `packages/importer`, c'est probablement lié aux dépendances :
```bash
cd packages/importer
pnpm install
```

---

## 📚 Ressources

- **Documentation officielle** : Lire `docs/` (hors `archive/`)
- **Règles projet** : `AGENTS.md`
- **Architecture** : `docs/ARCHITECTURE.md`
- **Pipeline data** : `docs/DATA_PIPELINE.md`

---

**Bon courage ! L'architecture statique est beaucoup plus simple que l'ancienne. 🚀**
