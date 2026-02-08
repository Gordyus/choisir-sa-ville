# Fix: Passage aux quintiles standards [80-100]

**Date**: 2026-02-08T20:00  
**Type**: Bug fix / UX improvement  
**Agent**: copilot-minor-medium-developer  
**Validé par**: PO/Architect gatekeeper

## Task

Modifier la fonction `mapIndexToLevel()` pour adopter les quintiles standards (5 niveaux de 20 points chacun) au lieu du mapping déséquilibré actuel qui créait une distribution inéquitable (niveau 4 = 1 seul point [100], niveau 3 = 24 points [75-99]).

## What was done

### 1. Fonction `mapIndexToLevel()` modifiée

**Fichier**: `packages/importer/src/exports/communes/metrics/insecurity/exportMetricsInsecurity.ts`

**Ancien mapping** (déséquilibré):
- Niveau 0: [0-25)   = 25 points
- Niveau 1: [25-50)  = 25 points
- Niveau 2: [50-75)  = 25 points
- Niveau 3: [75-100) = 24 points ⚠️
- Niveau 4: [100]    = 1 point ⚠️ **DÉSÉQUILIBRÉ**

**Nouveau mapping** (quintiles standards):
- Niveau 0: [0-20)   = 20 points
- Niveau 1: [20-40)  = 20 points
- Niveau 2: [40-60)  = 20 points
- Niveau 3: [60-80)  = 20 points
- Niveau 4: [80-100] = 20 points ✅ **ÉQUILIBRÉ**

Aligné sur les standards internationaux (Numbeo Crime Index, ICVS).

### 2. Configuration `INSECURITY_LEVELS` mise à jour

**Fichiers modifiés**:
- `packages/importer/src/exports/shared/insecurityMetrics.ts`
- `apps/web/lib/config/insecurityMetrics.ts`

Mise à jour des descriptions pour refléter les nouveaux ranges:
```typescript
export const INSECURITY_LEVELS = [
    { level: 0, label: "Très faible", description: "Percentile [0-20)" },
    { level: 1, label: "Faible", description: "Percentile [20-40)" },
    { level: 2, label: "Modéré", description: "Percentile [40-60)" },
    { level: 3, label: "Élevé", description: "Percentile [60-80)" },
    { level: 4, label: "Plus élevé", description: "Percentile [80-100]" }
] as const;
```

## Files modified

1. **`packages/importer/src/exports/communes/metrics/insecurity/exportMetricsInsecurity.ts`**
   - Fonction `mapIndexToLevel()` mise à jour avec quintiles standards [80-100]
   - Documentation enrichie avec référence méthodologique

2. **`packages/importer/src/exports/shared/insecurityMetrics.ts`**
   - Constante `INSECURITY_LEVELS` mise à jour avec nouveaux ranges de percentiles

3. **`apps/web/lib/config/insecurityMetrics.ts`**
   - Constante `INSECURITY_LEVELS` synchronisée (config dupliquée frontend)

## Validation

✅ `pnpm typecheck` — **0 errors**  
✅ `pnpm lint:eslint` — **0 warnings**

## Impact attendu

### UX Fix
- **Rouen (indexGlobal: 80.5, rank #2/42 grandes villes)**:
  - Avant: niveau 3 (Élevé) ❌ incohérent avec son rang #2
  - Après: niveau 4 (Plus élevé) ✅ cohérent

### Distribution équilibrée (grandes villes)
- **Avant**: 1/42 au niveau 4 (2.4%) → concentration extrême sur un seul point
- **Après**: 9/42 au niveau 4 (21.4%) → distribution réaliste et informative

### Alignement standards
- Conforme à **Numbeo Crime Index** (quintiles 20-point)
- Conforme à **ICVS** (International Crime Victims Survey)
- Référence: `doc/RESEARCH-security-index-methodologies.md`

## Notes

- **Pas de régénération du dataset** dans ce commit (étape séparée à effectuer après validation)
- La modification est **non-breaking**: même structure de données, seuls les seuils de classification changent
- Les labels de niveaux restent inchangés (compatibilité UI)
- Migration transparente: il suffit de regénérer le dataset pour appliquer les nouveaux seuils

## Next steps

1. Commit du fix
2. Régénération du dataset avec `pnpm importer:build` (étape séparée)
3. Validation des nouvelles distributions sur les grandes villes
