# Guide de contribution

Merci de votre intérêt pour **Choisir sa Ville** ! 🎉

Ce guide vous aidera à contribuer efficacement au projet.

---

## 📖 Avant de commencer

### Lecture obligatoire

1. **[README.md](./README.md)** - Vue d'ensemble du projet
2. **[AGENTS.md](./AGENTS.md)** - **Règles techniques NON NÉGOCIABLES** ⚠️
3. **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - Architecture détaillée
4. **[docs/LOCALITY_MODEL.md](./docs/LOCALITY_MODEL.md)** - Modèle territorial

### Comprendre l'architecture

Le projet utilise une **architecture statique (Jamstack)** :
- Données générées au build depuis sources publiques (INSEE, etc.)
- Next.js sert les fichiers JSON statiques
- Aucun backend API, aucune base de données en runtime

**Important** : Lire [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) pour bien comprendre.

---

## 🚀 Configuration de l'environnement

### Prérequis

- **Node.js** ≥ 22
- **pnpm** ≥ 10
- **Git**
- Un éditeur de code (VS Code recommandé)

### Installation

```bash
# 1. Fork le repo sur GitHub
# Cliquer sur "Fork" en haut à droite

# 2. Cloner votre fork
git clone https://github.com/VOTRE_USERNAME/choisir-sa-ville.git
cd choisir-sa-ville

# 3. Ajouter le repo upstream
git remote add upstream https://github.com/votre-org/choisir-sa-ville.git

# 4. Installer les dépendances
pnpm install

# 5. Générer les données statiques (obligatoire au premier lancement)
pnpm export:static

# 6. Lancer le dev
pnpm dev
```

Ouvrir http://localhost:3000

---

## 🔄 Workflow de contribution

### 1. Créer une branche

```bash
# Toujours partir de main à jour
git checkout main
git pull upstream main

# Créer une branche descriptive
git checkout -b feat/nom-de-la-feature
# ou
git checkout -b fix/description-du-bug
```

**Convention de nommage** :
- `feat/...` : Nouvelle fonctionnalité
- `fix/...` : Correction de bug
- `docs/...` : Documentation uniquement
- `refactor/...` : Refactoring sans changement de comportement
- `test/...` : Ajout ou modification de tests
- `chore/...` : Tâches de maintenance (deps, config, etc.)

### 2. Développer

```bash
# Lancer le dev en mode watch
pnpm dev

# Dans un autre terminal, typecheck en continu
pnpm typecheck --watch
```

**Respecter les règles de [AGENTS.md](./AGENTS.md)** :
- TypeScript strict
- camelCase partout (code, JSON, types)
- Séparation stricte : selection / data / map / ui
- Aucune logique métier dans les composants React

### 3. Vérifications avant commit

```bash
# Typecheck (obligatoire, 0 erreur)
pnpm typecheck

# Lint (obligatoire, 0 warning)
pnpm lint:eslint

# Tests (si existants)
pnpm test
```

**Tous ces checks doivent passer** avant de commit.

### 4. Commit

```bash
git add .
git commit -m "feat: description courte de la fonctionnalité"
```

**Convention de messages** :
```
<type>: <description courte>

<description détaillée optionnelle>

<footer optionnel: breaking changes, issues fermées, etc.>
```

**Types** :
- `feat` : Nouvelle fonctionnalité
- `fix` : Correction de bug
- `docs` : Documentation
- `style` : Formatage (pas de changement de code)
- `refactor` : Refactoring
- `test` : Tests
- `chore` : Maintenance

**Exemples** :
```bash
# Simple
git commit -m "feat: ajoute recherche par nom de commune"

# Avec description
git commit -m "fix: corrige le cache IndexedDB qui ne s'invalidait pas

Le cache ne vérifiait pas la version du dataset.
Maintenant, on compare la version dans manifest.json."

# Breaking change
git commit -m "refactor!: renomme EntityRef.code en EntityRef.inseeCode

BREAKING CHANGE: EntityRef.code est maintenant EntityRef.inseeCode
pour clarifier qu'il s'agit du code INSEE."
```

### 5. Push et Pull Request

```bash
# Push sur votre fork
git push origin feat/nom-de-la-feature

# Créer une Pull Request sur GitHub
# Aller sur votre fork → "Compare & pull request"
```

**Template de PR** :

```markdown
## Description

<!-- Décrivez la modification -->

## Type de changement

- [ ] Bug fix
- [ ] Nouvelle fonctionnalité
- [ ] Breaking change
- [ ] Documentation

## Checklist

- [ ] J'ai lu AGENTS.md
- [ ] `pnpm typecheck` passe
- [ ] `pnpm lint:eslint` passe (0 warnings)
- [ ] Tests ajoutés/mis à jour (si applicable)
- [ ] Documentation mise à jour (si applicable)
- [ ] Mon code respecte les conventions du projet

## Tests

<!-- Comment tester cette PR ? -->

## Screenshots (si UI)

<!-- Screenshots avant/après si modification UI -->
```

---

## 📝 Standards de code

### TypeScript

```typescript
// ✅ BON
interface UserProfile {
  inseeCode: string;
  name: string;
  population: number | null;
}

async function getCommune(code: string): Promise<CommuneData | null> {
  // ...
}

// ❌ MAUVAIS
interface user_profile {  // snake_case interdit
  code: any;  // any interdit
}

function getCommune(code) {  // typage manquant
  // ...
}
```

### React

```typescript
// ✅ BON - Logique séparée
function CommuneDetails() {
  const { active } = useSelection();
  const { data, loading } = useCommune(active?.inseeCode ?? null);
  
  if (loading) return <Spinner />;
  if (!data) return <EmptyState />;
  
  return <CommuneCard data={data} />;
}

// ❌ MAUVAIS - Logique métier dans le composant
function CommuneDetails() {
  const [data, setData] = useState(null);
  
  useEffect(() => {
    fetch(`/api/communes/${code}`)  // Logique d'accès données
      .then(r => r.json())
      .then(setData);
  }, [code]);
  
  // Calculs métier complexes ici...
  const population = data.population * 1.5; // ❌
  
  return <div>...</div>;
}
```

### Naming

```typescript
// ✅ BON
const communeData: CommuneData = { inseeCode: "75056", ... };
const departmentCode = "75";

// ❌ MAUVAIS
const commune_data = { insee_code: "75056", ... };  // snake_case
const deptCode = "75";  // abréviation non standard
```

---

## 🧪 Tests

### Quand écrire des tests ?

**Obligatoire** pour :
- Logique métier critique (`SelectionService`, calculateurs, etc.)
- Utilitaires complexes (normalization, parsing, etc.)
- Providers de données

**Optionnel** pour :
- Composants UI simples (présentation)
- Configuration

### Structure des tests

```typescript
// lib/selection/__tests__/selectionService.test.ts

import { describe, it, expect } from 'vitest';
import { createSelectionService } from '../selectionService';

describe('SelectionService', () => {
  it('should set highlighted entity', () => {
    const service = createSelectionService();
    const entity = { kind: 'commune', inseeCode: '75056' };
    
    service.setHighlighted(entity);
    
    expect(service.getState().highlighted).toEqual(entity);
  });
  
  it('should notify listeners on change', () => {
    const service = createSelectionService();
    const listener = vi.fn();
    
    service.subscribe(listener);
    service.setActive({ kind: 'commune', inseeCode: '75056' });
    
    expect(listener).toHaveBeenCalledWith({
      type: 'active',
      entity: { kind: 'commune', inseeCode: '75056' },
      previous: null
    });
  });
});
```

**À venir** : Configuration Vitest pour le projet.

---

## 📚 Documentation

### Quand mettre à jour la doc ?

**Obligatoire** si votre PR :
- Ajoute une nouvelle fonctionnalité
- Change l'architecture
- Modifie le workflow de développement
- Change les conventions

**Fichiers à mettre à jour** :
- `README.md` : Si workflow de dev change
- `AGENTS.md` : Si règles techniques changent
- `docs/ARCHITECTURE.md` : Si architecture change
- `CHANGELOG.md` : Toujours (à la merge)

### Comment documenter

```markdown
# ✅ BON - Clair, avec exemples

## SelectionService

Service headless pour gérer l'état de sélection.

### Usage

\`\`\`typescript
import { getSelectionService } from '@/lib/selection';

const service = getSelectionService();
service.setActive({ kind: 'commune', inseeCode: '75056' });
\`\`\`

### API

- `getState()`: Retourne l'état actuel
- `setActive(entity)`: Sélectionne une entité
- `subscribe(listener)`: Écoute les changements


# ❌ MAUVAIS - Vague, pas d'exemple

## SelectionService

Gère la sélection.
```

---

## 🐛 Rapporter un bug

### Avant de créer une issue

1. Vérifier que le bug n'est pas déjà reporté
2. Reproduire le bug de manière consistante
3. Collecter les informations (browser, OS, version, etc.)

### Template d'issue bug

```markdown
## Description

<!-- Description claire du bug -->

## Steps to reproduce

1. Aller sur '...'
2. Cliquer sur '...'
3. Voir l'erreur

## Comportement attendu

<!-- Ce qui devrait se passer -->

## Comportement actuel

<!-- Ce qui se passe réellement -->

## Screenshots

<!-- Si applicable -->

## Environnement

- OS: [e.g. Windows 11]
- Browser: [e.g. Chrome 120]
- Version: [e.g. 0.2.0]

## Logs console

\`\`\`
<!-- Coller les erreurs console -->
\`\`\`
```

---

## 💡 Proposer une fonctionnalité

### Template d'issue feature

```markdown
## Problème à résoudre

<!-- Quel problème cette feature résout-elle ? -->

## Solution proposée

<!-- Décrivez la solution que vous imaginez -->

## Alternatives considérées

<!-- Autres solutions envisagées -->

## Contexte additionnel

<!-- Mockups, références, etc. -->
```

---

## 🎨 Guidelines UI/UX

### Design system

- **Components** : shadcn/ui uniquement
- **Styling** : Tailwind CSS core utilities
- **Icons** : Lucide React
- **Fonts** : System fonts (pas de custom fonts pour l'instant)

### Accessibilité

- Labels sur tous les inputs
- Alt text sur les images
- Contraste suffisant (WCAG AA minimum)
- Navigation clavier

### Responsive

- Mobile-first
- Breakpoints Tailwind : `sm`, `md`, `lg`, `xl`, `2xl`
- Test sur mobile/tablet/desktop

---

## ❓ Questions ?

- **Documentation** : Voir [docs/INDEX.md](./docs/INDEX.md)
- **Issues** : https://github.com/votre-org/choisir-sa-ville/issues
- **Discussions** : https://github.com/votre-org/choisir-sa-ville/discussions

---

## 📜 Code of Conduct

### Nos valeurs

- **Respect** : Soyez respectueux envers tous les contributeurs
- **Bienveillance** : Feedback constructif, jamais destructif
- **Collaboration** : On construit ensemble
- **Ouverture** : Accueil des nouvelles idées

### Comportements inacceptables

- Harcèlement, discrimination
- Trolling, insultes
- Spam, promotion non sollicitée

### Signalement

Contacter les mainteneurs via [CONTACT] si vous observez un comportement inapproprié.

---

**Merci de contribuer à Choisir sa Ville ! 🚀**
