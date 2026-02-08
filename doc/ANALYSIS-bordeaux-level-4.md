# Analyse: Bordeaux et le Niveau de Classification

**Date**: 2026-02-08  
**Question**: Pourquoi Bordeaux (top 1 des grandes villes) est-elle classée "Élevé" (niveau 3) et non "Plus élevé" (niveau 4) ?

---

## 1. État des Faits

### Données Bordeaux (INSEE 33063, 2024)

| Métrique | Valeur | Contexte |
|----------|--------|----------|
| **Population** | 252,040 habitants | 7ème ville de France |
| **Violences/1000** | 16.3 | Crimes violents |
| **Biens/1000** | 80.1 | Atteintes aux biens |
| **Tranquillité/1000** | 14.7 | Troubles ordre public |
| **Score pondéré** | **38.23** | 0.4×16.3 + 0.35×80.1 + 0.25×14.7 |
| **IndexGlobal** | **99** | Percentile 99 (national, toutes communes) |
| **Level** | **3** | "Élevé" |
| **Rang >100k hab** | **1ère / 42** | Top 1 des grandes villes |

### Classement Top 10 Grandes Villes (>100k habitants)

| Rang | Ville | Population | Score | IndexGlobal | Level |
|------|-------|------------|-------|-------------|-------|
| **1** | **Bordeaux** | 252,040 | **38.23** | **99** | **3** |
| 2 | Le Havre | 110,117 | 36.09 | 99 | 3 |
| 3 | Grenoble | 158,180 | 35.92 | 99 | 3 |
| 4 | Lille | 232,440 | 34.84 | 99 | 3 |
| 5 | Lyon | 515,695 | 33.34 | 98 | 3 |
| 6 | Paris | 2,190,327 | 32.06 | 98 | 3 |
| 7 | Marseille | 862,211 | 29.09 | 98 | 3 |
| 8 | Montpellier | 281,613 | 28.23 | 98 | 3 |
| 9 | Saint-Denis | 140,962 | 27.23 | 97 | 3 |
| 10 | Villeurbanne | 149,019 | 26.96 | 97 | 3 |

**Conclusion factuelle**: Bordeaux **EST** la ville la plus dangereuse parmi les grandes villes françaises (>100k habitants).

---

## 2. Pourquoi Bordeaux Est Niveau 3 et Pas Niveau 4 ?

### Définition Actuelle du Niveau 4

```typescript
{ level: 4, label: "Plus élevé", description: "indexGlobal 100" }
```

Le niveau 4 est **réservé à indexGlobal = 100 exactement** (percentile maximum absolu).

### Les 22 Communes Niveau 4

| INSEE | Commune | Population | Score | Contexte |
|-------|---------|------------|-------|----------|
| 95527 | Villiers-le-Bel | 2,899 | 434.99 | Banlieue parisienne |
| 50353 | Montmartin-en-Graignes | 30 | 303.34 | **30 habitants!** |
| 59195 | Englefontaine | 606 | 143.41 | Petite commune Nord |
| 52384 | Vignory | 118 | 136.43 | Village Haute-Marne |
| ... | ... | ... | ... | ... |
| 52519 | Cunel | 47 | 59.57 | 47 habitants |

**Observation critique**: Les 22 communes niveau 4 ont **toutes moins de 6,000 habitants**. La majorité a moins de 500 habitants.

---

## 3. Le Problème: Biais de Taille de Population

### Exemple Extrême

**Montmartin-en-Graignes (50353)**: 30 habitants
- Si 9 faits de délinquance dans l'année
- Taux = 9 / 30 × 1000 = **300 pour 1000**
- **10× le taux de Bordeaux** (30 vs 300)

### Impact du Calcul sur Taux/1000

| Population | 1 fait divers | 5 faits | 10 faits |
|------------|---------------|---------|----------|
| 30 hab | 33.3/1000 | 166.7/1000 | 333.3/1000 |
| 500 hab | 2.0/1000 | 10.0/1000 | 20.0/1000 |
| 100,000 hab | 0.01/1000 | 0.05/1000 | 0.1/1000 |

Les **petites populations amplifient mécaniquement les taux**, créant un **biais structurel** dans le classement percentile national.

---

## 4. Comparaison avec Méthodologie Externe

### Hypothèses sur ville-data.com

Le site "ville-data.com" classe probablement Bordeaux "top 1" car il utilise:
1. **Filtre taille minimale**: Seulement villes >10,000 ou >100,000 habitants
2. **Classement par catégorie**: Séparation petites/moyennes/grandes villes
3. **Données INSEE brutes**: Pas de pondération 40/35/25
4. **Année différente**: Peut-être 2023 ou 2022

**Notre méthodologie actuelle**:
- **Percentile national**: Toutes les 34,875 communes ensemble (30 habitants → 2,190,327 habitants)
- **Pondération**: 40% violences, 35% biens, 25% tranquillité
- **Année**: 2024
- **Niveau 4**: Réservé au top absolu (indexGlobal = 100)

---

## 5. Options de Correction

### Option A: Élargir le Niveau 4 (indexGlobal ≥ 99)

**Changement**:
```typescript
{ level: 3, label: "Élevé", description: "indexGlobal 75–98" },
{ level: 4, label: "Plus élevé", description: "indexGlobal 99–100" }
```

**Impact**:
- Bordeaux passerait en niveau 4 ✅
- Le Havre, Grenoble, Lille passeraient aussi en niveau 4 (indexGlobal 99)
- Total communes niveau 4: ~70 au lieu de 22

**Avantages**:
- Bordeaux reconnue comme "Plus élevé" (cohérent avec perception)
- Les 4 villes les plus dangereuses distinguées
- Changement simple (1 ligne de config)

**Inconvénients**:
- Dilue le sens de "Plus élevé" (n'est plus "top absolu")
- Petites communes avec scores exceptionnels (300-400) mélangées avec Bordeaux (38)

---

### Option B: Classement par Catégorie de Taille

**Changement**:
- Petites communes (<10,000 hab): percentile calculé uniquement sur cette catégorie
- Moyennes communes (10k-100k): idem
- Grandes villes (>100k): idem

**Impact**:
- Bordeaux serait niveau 4 dans sa catégorie (top 1 / 42)
- Chaque commune comparée à ses "pairs" de taille similaire
- Élimination du biais taille population

**Avantages**:
- Comparaison légitime (Bordeaux vs Lyon, pas vs commune de 30 hab)
- Résout le biais structurel
- Plus juste conceptuellement

**Inconvénients**:
- **Complexe techniquement**: Nécessite 3 indexGlobal différents par commune
- Impact data schema: ajout de `populationCategory` + `indexGlobalCategory`
- Impact UI: affichage/explication plus complexe
- **Hors scope actuel**: changement architectural majeur

---

### Option C: Conserver Système Actuel + Transparence

**Changement**: Aucun code, seulement documentation/UI

**Ajouts**:
1. **Badge UI**: Afficher "1ère ville >100k hab" pour Bordeaux
2. **Tooltip**: Mentionner le rang dans la catégorie de taille
3. **FAQ**: Expliquer clairement le biais taille population
4. **Metadata**: Ajouter `rankInCategory` dans l'export

**Avantages**:
- Aucun changement technique risqué
- Transparence maximale
- Bordeaux reconnue comme top 1 (sans changer le niveau)

**Inconvénients**:
- Le niveau 4 reste inaccessible aux grandes villes
- Peut sembler "incohérent" que Bordeaux soit niveau 3

---

## 6. Recommandation

### Recommandation Immédiate: **Option A** (Élargir Niveau 4 à ≥99)

**Justification**:
1. **Changement minimal**: 1 ligne de config
2. **Impact contrôlé**: Seulement ~70 communes (au lieu de 22)
3. **Perception correcte**: Bordeaux (top 1 grandes villes) reconnue comme "Plus élevé"
4. **Aucun risque architectural**

**Code change**:
```typescript
// apps/web/lib/config/insecurityMetrics.ts
export const INSECURITY_LEVELS = [
    { level: 0, label: "Très faible", description: "indexGlobal 0–24" },
    { level: 1, label: "Faible", description: "indexGlobal 25–49" },
    { level: 2, label: "Modéré", description: "indexGlobal 50–74" },
    { level: 3, label: "Élevé", description: "indexGlobal 75–98" },        // ← CHANGED
    { level: 4, label: "Plus élevé", description: "indexGlobal 99–100" }  // ← CHANGED
];

// packages/importer/src/exports/communes/metrics/insecurity/exportMetricsInsecurity.ts
function mapIndexToLevel(indexGlobal: number | null): number {
    if (indexGlobal === null || !Number.isFinite(indexGlobal)) return 0;
    if (indexGlobal < 25) return 0;
    if (indexGlobal < 50) return 1;
    if (indexGlobal < 75) return 2;
    if (indexGlobal < 99) return 3;  // ← CHANGED (was < 100)
    return 4;
}
```

**Impact communes**:
- Niveau 4 avant: 22 communes (indexGlobal = 100)
- Niveau 4 après: ~70 communes (indexGlobal 99-100)
- Bordeaux, Le Havre, Grenoble, Lille: niveau 3 → 4

---

### Recommandation Long Terme: **Option B** (Classement par Catégorie)

À planifier pour une version ultérieure (v2):
1. Ajouter `populationCategory` au schéma de données
2. Calculer 3 indexGlobal séparés (petites/moyennes/grandes)
3. UI: afficher le niveau **dans la catégorie** + rang national
4. Résout définitivement le biais taille population

---

## 7. Conclusion

**Le calcul actuel est mathématiquement correct**, mais souffre d'un **biais structurel**:
- Bordeaux **EST** la ville la plus dangereuse >100k habitants (score 38.23)
- Bordeaux **a un indexGlobal de 99** (percentile 99 national)
- Bordeaux **est niveau 3** car le niveau 4 est réservé à indexGlobal = 100 exactement

**Le niveau 4 est monopolisé par de très petites communes** avec des taux/1000 explosifs (biais mécanique).

**Solution recommandée**: Élargir niveau 4 à indexGlobal ≥99 pour reconnaître les 4 villes les plus dangereuses (Bordeaux, Le Havre, Grenoble, Lille) sans refonte architecturale.

**Validation nécessaire**: Consulter PO/Architect gatekeeper pour approuver le changement de seuil.
