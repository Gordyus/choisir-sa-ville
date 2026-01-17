# LOCALITY_MODEL.md
## Modèle territorial & usage produit (MVP → évolutions)

Ce document explique **comment le territoire est modélisé**, **pourquoi**, et **comment l’utiliser côté produit**.
Il est destiné aux développeurs, data, et décideurs produit.

---

## 1. Hiérarchie territoriale de référence

Le produit s’appuie sur une hiérarchie **claire, stable et explicable** :

Pays
 └── Région
     └── Département
         └── Commune (niveau garanti partout)
             └── Zone infra-communale (optionnelle)
                 └── Adresse / Point

### Principe fondamental
- **La commune est le niveau pivot**
- Toutes les données peuvent toujours être :
  - stockées
  - agrégées
  - expliquées
au niveau **communal**

---

## 2. Correspondance avec les données INSEE

| INSEE TYPE | Niveau produit | Description |
|----------|---------------|-------------|
| COM | Commune | Ville administrative actuelle |
| ARM | Zone infra-communale | Arrondissements municipaux (Paris, Lyon, Marseille) |
| COMD | Zone infra-communale | Anciennes communes (communes déléguées) |
| COMA | Zone infra-communale | Anciennes communes associées |

### Décision clé
> **COMD, COMA et ARM sont modélisés comme des zones infra-communales**, jamais comme des communes.

---

## 3. Pourquoi les arrondissements (ARM) sont essentiels

### Cas d’usage : recherche de logement à Paris

Pour un utilisateur :
- « Paris » est trop large
- Les différences entre :
  - Paris 11e
  - Paris 16e
  - Paris 18e
sont **majeures** en termes de :
- prix immobilier
- sécurité
- nuisances
- qualité de vie

### Décision produit
- Les **ARM sont des zones de premier ordre**
- Elles peuvent avoir :
  - leurs propres indicateurs
  - leurs propres scores
  - leurs propres pages

Exemples :
- /ville/paris
- /ville/paris/11e-arrondissement

---

## 4. COMD / COMA : zones infra-communales historiques

### Nature
- Héritage de fusions de communes
- Identité locale parfois très forte
- Données parfois disponibles (immobilier, sécurité)

### Exemples
- Annecy-le-Vieux
- Seynod
- Cran-Gevrier

### Décision produit
- Elles sont :
  - **secondaires au MVP**
  - mais **compatibles avec le modèle**
- Elles peuvent être activées :
  - par ville
  - par disponibilité de données

---

## 5. Modèle conceptuel recommandé

### Entité générique : Locality / Zone

```ts
Zone {
  id: string
  type: "COMMUNE" | "ARM" | "COMD" | "COMA"
  inseeCode: string
  parentId?: string      // Commune parente
  name: string
}
```

### Règles
- `COMMUNE` :
  - parent = null
- `ARM`, `COMD`, `COMA` :
  - parent = COMMUNE
- Une zone **n’existe jamais sans commune parente**

---

## 6. Données & agrégation

### Données attachées au bon niveau
- Sécurité :
  - ARM → arrondissement
- Immobilier :
  - ARM ou COMD
- Coût de la vie :
  - souvent COM
- Services publics :
  - COM

### Agrégation vers la commune
Exemples :
- Sécurité de Paris = moyenne pondérée des ARM
- Immobilier d’Annecy = combinaison COM + COMD

### Bénéfice produit
> Les scores sont **explicables**, **crédibles**, et **localement pertinents**.

---

## 7. SEO & navigation

### Pages possibles
- /ville/paris
- /ville/paris/11e-arrondissement
- /ville/annecy/annecy-le-vieux

### Règle SEO
- La commune reste la page principale
- Les zones infra :
  - enrichissent
  - ne cannibalisent pas

---

## 8. Décisions MVP (claires)

### MVP
- Import INSEE :
  - COM dans `commune`
  - ARM / COMD / COMA dans `infra_zone`
- Zones infra :
  - toujours rattach?es ? une commune parente
  - jamais aplaties au niveau commune

### ?volutions
- Sources additionnelles (population, geo, indicateurs)
- Activation s?lective des infra-zones selon les donn?es

---

## 9. Règle d’or

> **Une commune est le socle.  
> Les zones infra apportent la précision.  
> Les données ne doivent jamais être aplaties au mauvais niveau.**

---
