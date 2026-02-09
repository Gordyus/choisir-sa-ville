# @choisir-sa-ville/shared

Package interne contenant les **configurations et constantes métier** partagées entre :
- `packages/importer` (pipeline batch, build-time)
- `apps/web` (Next.js, runtime)

## Structure

- `src/config/insecurityMetrics.ts` — Configuration des catégories, niveaux et seuils de population pour l'indice de sécurité (SSMSI)

## Règles

- **Aucune logique exécutable runtime/build-time** (pas de fetch, pas de DOM, pas de Node.js APIs)
- **Types et constantes uniquement**
- **Immuable** : toute modification doit être validée par le PO/Architect gatekeeper
- **Versionné** : toute modification breaking nécessite mise à jour de l'importer ET du web

## Usage

```typescript
// Dans packages/importer/
import { INSECURITY_CATEGORIES } from "@choisir-sa-ville/shared/config/insecurity-metrics";

// Dans apps/web/
import { POPULATION_CATEGORIES } from "@choisir-sa-ville/shared/config/insecurity-metrics";
```
