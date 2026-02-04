# Choisir sa ville

Application web pour comparer et sélectionner des zones géographiques en France selon des critères objectifs (population, loyers, accessibilité, qualité de vie, etc.).

**Architecture** : Jamstack (données statiques + Next.js)  
**Statut** : MVP en développement

---

## 🎯 Objectif

Aider à choisir où vivre en France en fournissant :
- Vue cartographique interactive de toutes les communes françaises
- Données objectives et comparables (INSEE, open data)
- Métriques par zone (population, logement, sécurité, accessibilité)
- Comparaison multi-zones

---

## 🏗️ Architecture

### Principe

Le projet utilise une **architecture statique complète** :

**Build time** :
- `packages/importer` télécharge les données publiques (INSEE, La Poste, etc.)
- Parse, normalise et génère des fichiers JSON optimisés
- Exporte vers `apps/web/public/data/{version}/`

**Runtime** :
- Next.js sert les données statiques via HTTP
- Cache IndexedDB côté client (TTL 7 jours)
- Aucun backend API, aucune base de données

### Structure du monorepo

```
choisir-sa-ville/
├── packages/
│   └── importer/           # Pipeline de génération de données statiques
│
├── apps/
│   └── web/                # Application Next.js (frontend)
│       └── public/data/    # Données JSON statiques versionnées
│
├── docs/                   # Documentation technique
├── specs/                  # Spécifications fonctionnelles
└── AGENTS.md               # Règles techniques du projet
```

---

## 🚀 Démarrage rapide

### Prérequis

- **Node.js** ≥ 22
- **pnpm** ≥ 10

### Installation

```bash
# 1. Cloner le repo
git clone https://github.com/votre-org/choisir-sa-ville.git
cd choisir-sa-ville

# 2. Installer les dépendances
pnpm install
```

### Première utilisation

```bash
# 1. Générer les données statiques (obligatoire au premier lancement)
pnpm --filter @choisir-sa-ville/importer export:static

# 2. Lancer le frontend en mode développement
pnpm --filter @choisir-sa-ville/web dev
```

Ouvrir http://localhost:3000

### Développement quotidien

```bash
# Frontend uniquement (si données déjà générées)
pnpm --filter @choisir-sa-ville/web dev

# Régénérer les données (si sources ont changé)
pnpm --filter @choisir-sa-ville/importer export:static
```

### Build de production

```bash
# Build du frontend
pnpm --filter @choisir-sa-ville/web build

# Start en mode production
pnpm --filter @choisir-sa-ville/web start
```

---

## 📚 Documentation

### Documentation principale

- **[AGENTS.md](./AGENTS.md)** : Règles techniques du projet (à lire en premier)
- **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** : Architecture détaillée
- **[docs/DATA_PIPELINE.md](./docs/DATA_PIPELINE.md)** : Pipeline de génération de données
- **[docs/LOCALITY_MODEL.md](./docs/LOCALITY_MODEL.md)** : Modèle territorial (communes, infra-zones)

### Spécifications fonctionnelles

- `specs/map-city-visibility-spec.md` : Visibilité des villes sur la carte
- `specs/search-travel-spec.md` : Recherche et calcul d'itinéraires
- `specs/zone-aggregates-framework-spec.md` : Framework d'agrégats par zone
- `specs/zone-rent-aggregate-spec.md` : Agrégat loyers
- `specs/zone-safety-insecurity-index-spec.md` : Indice de sécurité

### Archive

- `docs/archive/` : Ancienne architecture (API + PostgreSQL, abandonnée)

---

## 🛠️ Stack technique

### Frontend (apps/web)

- **Framework** : Next.js 15 (React, App Router)
- **Styling** : Tailwind CSS + shadcn/ui
- **Cartographie** : MapLibre GL JS
- **Cache** : IndexedDB (Dexie.js sous le capot)
- **State management** : Service headless custom (SelectionService)

### Data pipeline (packages/importer)

- **Runtime** : Node.js 22+
- **Parsing** : csv-parse, unzipper
- **Sources** : INSEE, La Poste, autres open data

### Outils

- **Package manager** : pnpm (workspaces)
- **Linting** : ESLint + TypeScript ESLint
- **Type checking** : TypeScript strict mode
- **Validation** : Zod

---

## 📦 Packages

### `packages/importer`

Pipeline de génération de données statiques.

**Commande** :
```bash
pnpm --filter @choisir-sa-ville/importer export:static
```

**Sortie** :
```
apps/web/public/data/v2026-02-04/
├── manifest.json
├── communes/indexLite.json
├── communes/{dept}/{inseeCode}.json
├── infra-zones/indexLite.json
└── ...
```

**Sources** :
- INSEE : communes, départements, régions, populations
- La Poste : codes postaux + coordonnées GPS

Voir [docs/DATA_PIPELINE.md](./docs/DATA_PIPELINE.md) pour plus de détails.

### `apps/web`

Application frontend Next.js.

**Structure** :
```
apps/web/
├── app/                    # Next.js App Router
├── components/             # Composants React
├── lib/                    # Logique métier
│   ├── selection/          # Service de sélection (headless)
│   ├── data/               # Providers de données + cache
│   ├── map/                # Adaptateur MapLibre
│   └── config/             # Configuration
└── public/data/            # Données statiques (générées par importer)
```

---

## 🧪 Tests

```bash
# Typecheck (tous les packages)
pnpm typecheck

# Lint (tous les packages)
pnpm lint:eslint
```

**Note** : Tests unitaires à venir pour la logique critique (SelectionService, EntityDataProvider, etc.)

---

## 🤝 Contribution

### Avant de commencer

1. Lire [AGENTS.md](./AGENTS.md) : règles techniques du projet
2. Lire [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) : comprendre l'architecture
3. Lire [docs/LOCALITY_MODEL.md](./docs/LOCALITY_MODEL.md) : comprendre le modèle territorial

### Workflow

1. Créer une branche depuis `main`
2. Développer en respectant les règles de `AGENTS.md`
3. Vérifier :
   ```bash
   pnpm typecheck       # Pas d'erreurs TypeScript
   pnpm lint:eslint     # 0 warnings
   ```
4. Commit avec message clair et atomique
5. Créer une Pull Request

### Conventions

- **Commits** : Messages clairs, atomiques, en français ou anglais
- **Code** : TypeScript strict, camelCase partout
- **Composants** : Séparation stricte UI / logique
- **Tests** : Requis pour la logique critique

---

## 📄 Licence

À définir (MIT ou autre licence open source).

---

## 🗺️ Roadmap

### MVP (en cours)

- [x] Architecture statique (Jamstack)
- [x] Pipeline de génération de données (INSEE + La Poste)
- [x] Carte interactive (MapLibre)
- [x] Sélection de communes
- [x] Cache IndexedDB
- [ ] Recherche par nom
- [ ] Détails communes (métriques de base)
- [ ] Filtres simples

### V1

- [ ] Métriques avancées (loyers, sécurité, QoL)
- [ ] Comparaison multi-zones
- [ ] Export / partage
- [ ] URL state (deep linking)
- [ ] Zones infra-communales (ARM)

### Future

- [ ] Personnalisation utilisateurs
- [ ] Contributions communautaires
- [ ] Données temps réel (si pertinent)

---

## 📞 Contact

- **Issues** : https://github.com/votre-org/choisir-sa-ville/issues
- **Discussions** : https://github.com/votre-org/choisir-sa-ville/discussions

---

**Développé avec ❤️ pour faciliter le choix du lieu de vie en France.**
