# Progressive City Display (MapLibre Text Size Expression)

**Statut** : Implémenté  
**Implémentation** : Terminée  
**Dernière révision** : 2026-02-11

---

## Vue d'ensemble

Le système d'affichage progressif des communes est implémenté via **une expression MapLibre de taille de texte dynamique** (`text-size`) qui varie selon :
- Le **niveau de zoom**
- La **population de la commune**

Les communes avec `text-size: 0` sont effectivement masquées par MapLibre (pas de rendu).

**Principe** : Plus le zoom est élevé, plus on affiche de communes. Au sein d'un niveau de zoom, les grandes villes ont un texte plus large.

---

## Implémentation

### Fichier source

`apps/web/lib/map/layers/communeLabelsVector.ts`

### Approche technique

- **Type de couche** : `symbol` (labels vectoriels)
- **Source de données** : `commune-labels.mbtiles` (tuiles vectorielles générées depuis `indexLite.json`)
- **Propriété clé** : `text-size` définie par une expression MapLibre `["step", ["zoom"], ...]`
- **Critère de visibilité** : Propriété `population` de chaque feature

### Seuils de visibilité par zoom

| Niveau de zoom | Seuil de population | Description |
|----------------|---------------------|-------------|
| **z0–5** | > 300,000 | Mégapoles uniquement (Paris, Lyon, Marseille, etc.) |
| **z6–7** | > 50,000 | Grandes villes |
| **z8–9** | > 10,000 | Villes moyennes |
| **z10–11** | > 2,000 | Petites villes |
| **z12+** | Toutes | Villages inclus |

### Tailles de texte par population

Au sein de chaque niveau de zoom, la taille du texte varie selon la population :

| Population | Taille texte (z12+) |
|------------|---------------------|
| < 5,000 | 14px (villages) |
| 5,000–99,999 | 14px |
| 100,000–299,999 | 16px |
| ≥ 300,000 | 20px (mégapoles) |

---

## Code source (extrait)

```typescript
const TEXT_SIZE_EXPRESSION: ExpressionSpecification = [
    "step", ["zoom"],
    // z0-5: Only megacities (> 300k)
    ["step", ["coalesce", ["get", "population"], 0],
        0,        // pop < 300k: hidden
        300000, 20
    ],
    // z6-7: Major cities (> 50k)
    6, ["step", ["coalesce", ["get", "population"], 0],
        0,        // pop < 50k: hidden
        50000, 14,
        100000, 16,
        300000, 20
    ],
    // ... (autres niveaux de zoom)
];
```

**Note critique** : Utilisation de `"step"` (pas `"interpolate"`) au niveau racine pour éviter l'interpolation de zoom qui casserait les seuils de population entre niveaux.

---

## Intégration dans le pipeline

### Appel depuis `stylePipeline.ts`

```typescript
// Step 7: Inject custom commune labels vector layer
injectCommuneLabelsVector(style, {
    tileJsonUrl: `${window.location.origin}/tiles/commune-labels.json`,
    sourceLayer: "commune_labels"
});
```

### Position dans la pile de couches

Le layer `commune_labels` est **inséré avant** `place_label_other` (labels OSM d'arrondissements) pour garantir le bon ordre de rendu (z-index).

---

## Génération des tuiles

**Source** : `indexLite.json` (données communes)  
**Format de sortie** : `commune-labels.mbtiles` (MBTiles vectoriel)  
**Propriétés exposées** :
- `insee` (code INSEE, utilisé comme `promoteId` pour feature-state)
- `name` (nom de la commune)
- `population` (nombre d'habitants)

> ⚠️ **TODO** : Documenter le script de génération MBTiles (voir `docs/BACKLOG.md`)

---

## Interactions

### Feature-state supportés

Le layer supporte les états interactifs via `feature-state` :
- `hasData` : la commune a des données disponibles (couleur verte)
- `highlight` : survol (couleur jaune)
- `active` : sélection/clic (couleur orange)

### Couleurs de texte

Définies dans `entityVisualStateColors.ts` :
```typescript
"text-color": [
    "case",
    ["boolean", ["feature-state", "active"], false],
    ENTITY_STATE_COLORS.active,
    ["boolean", ["feature-state", "highlight"], false],
    ENTITY_STATE_COLORS.highlight,
    ["boolean", ["feature-state", "hasData"], false],
    ENTITY_STATE_COLORS.hasData,
    ENTITY_STATE_COLORS.noData
]
```

---

## Différences avec la spec d'origine

| Spec d'origine | Implémentation réelle |
|----------------|----------------------|
| Algorithme JavaScript de sélection de villes | Expression MapLibre native (GPU-side) |
| Budget de villes (50–3000) | Pas de budget global, seuils de population |
| Grid cells + priorityScore | Collision MapLibre native (`text-allow-overlap: false`) |
| Zoom hysteresis + stickiness | Seuils fixes, pas d'hystérésis |
| Calcul runtime JS | Aucun calcul JS, tout déclaratif |

**Avantages de l'approche implémentée** :
- ✅ **Simplicité** : pas de code runtime complexe
- ✅ **Performance** : rendu GPU natif MapLibre
- ✅ **Déterminisme** : comportement prévisible basé population
- ✅ **Maintenance** : expression déclarative dans un seul fichier

---

## Tests de validation

### Comportement attendu

1. **z0–5** : Seules les mégapoles (Paris, Lyon, Marseille, etc.) visibles
2. **z6–7** : Ajout des grandes villes (Bordeaux, Nantes, Strasbourg, etc.)
3. **z8–9** : Ajout des villes moyennes (Béziers, Annecy, etc.)
4. **z10–11** : Ajout des petites villes (> 2k hab)
5. **z12+** : Tous les villages visibles

### Cas limites

- Communes sans population → `text-size: 0` (masquées) via `["coalesce", ["get", "population"], 0]`
- Collision de labels → gérée par MapLibre (`text-allow-overlap: false`, `text-padding: 3`)
- Tri des labels → `symbol-sort-key: ["-", ["coalesce", ["get", "population"], 0]]` (grandes villes au-dessus)

---

## Références

- **Code source** : `apps/web/lib/map/layers/communeLabelsVector.ts`
- **Pipeline d'intégration** : `apps/web/lib/map/stylePipeline.ts` (step 7)
- **Couleurs d'état** : `apps/web/lib/map/layers/entityVisualStateColors.ts`
