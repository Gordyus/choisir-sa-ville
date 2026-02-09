# Construction des polygones des communes françaises

Ce document décrit **la procédure exacte utilisée dans le projet** pour construire les
polygones des communes françaises, depuis les sources officielles jusqu’à leur intégration
dans les tuiles vectorielles.

Cette procédure est volontairement **sobre, robuste et reproductible**.

---

## 1. Objectif

Construire un jeu de **polygones fiables et stables** pour toutes les communes françaises afin de :
- disposer de limites administratives correctes
- alimenter les tuiles vectorielles (MBTiles)
- servir de base aux index spatiaux
- rester indépendant des variations OSM

Contraintes principales :
- cohérence INSEE
- géométries valides
- licence compatible usage web
- aucune logique produit intégrée

---

## 2. Source des données

### Source retenue
- **IGN – ADMIN EXPRESS**
- Niveau : **communes**
- Format source : Shapefile / GeoPackage
- Référence officielle : INSEE

### Pourquoi ne pas utiliser OSM pour les communes
- limites parfois incomplètes ou imprécises
- multipolygones cassés
- incohérences entre frontières et codes INSEE

ADMIN EXPRESS garantit :
- exhaustivité
- stabilité temporelle
- cohérence administrative nationale

---

## 3. Extraction initiale

Depuis ADMIN EXPRESS :
- extraction exclusive des entités de niveau *commune*
- exclusion volontaire :
  - régions
  - départements
  - EPCI
  - autres niveaux administratifs

### Propriétés conservées
- `INSEE_COM`
- `NOM_COM`

Toutes les autres propriétés sont supprimées immédiatement.

---

## 4. Normalisation géométrique

### 4.1 Projection

Toutes les données sont reprojetées en **EPSG:4326 (WGS84)**.

```bash
ogr2ogr -t_srs EPSG:4326 communes_raw.geojson communes_admin_express.shp
```

---

### 4.2 Correction des géométries

ADMIN EXPRESS peut contenir :
- self-intersections
- anneaux mal orientés
- géométries invalides

Correction systématique :

```bash
ogr2ogr -makevalid communes_valid.geojson communes_raw.geojson
```

Cette étape est **obligatoire** avant toute étape de tiling.

---

## 5. Cas particuliers

### Communes multipolygones
- îles
- territoires discontinus

➡️ conservées telles quelles  
➡️ aucun dissolve ou recalcul de centroid

---

### Communes nouvelles / déléguées
- conservation stricte du niveau INSEE
- aucune fusion logique
- la sémantique est gérée au niveau applicatif

---

## 6. Simplification

Aucune simplification agressive n’est appliquée avant le tiling.

Raisons :
- Tippecanoe applique déjà une simplification progressive par zoom
- une simplification trop forte casse :
  - les enclaves
  - les frontières fines
  - les communes littorales

Si simplification :
- uniquement légère
- seuil conservateur
- jamais destructive

---

## 7. Nettoyage final des propriétés

Avant export final :

Propriétés **strictement conservées** :

```json
{
  "insee": "34172",
  "name": "Montpellier"
}
```

Tout le reste est supprimé :
- codes postaux
- population
- métadonnées IGN
- champs temporaires

Les polygones sont volontairement **neutres et minimalistes**.

---

## 8. Génération du fichier communes.geojson

Résultat :
- `communes.geojson`
- 1 feature = 1 commune INSEE
- géométrie valide
- propriétés minimales

Ce fichier est utilisé pour :
- la génération des tuiles vectorielles
- la construction des index spatiaux
- le fallback de résolution (jamais primaire)

---

## 9. Intégration dans les MBTiles

La couche est intégrée telle quelle dans Tippecanoe :

```bash
--layer=communes:communes.geojson
```

Aucun enrichissement n’est appliqué à ce stade :
- pas de promoteId
- pas de logique produit
- pas de style

---

## 10. Rôle des polygones dans l’architecture actuelle

Avec l’architecture actuelle du projet :

- les labels OSM sont le déclencheur principal d’interaction
- la résolution se fait par :
  - nom normalisé
  - proximité (indexLite)
- les polygones servent uniquement :
  - de fallback
  - de désambiguïsation
  - de support géographique fiable

Ils ne sont **jamais** la source de labels ni le moteur principal d’interaction.

---

## 11. Invariants (à ne pas casser)

- géométries officielles IGN
- cohérence INSEE
- aucune logique produit dans les polygones
- neutralité maximale
- compatibilité Tippecanoe / MapLibre

---

## 12. Résumé du pipeline

```
IGN ADMIN EXPRESS
   ↓
Extraction communes
   ↓
Reprojection EPSG:4326
   ↓
Correction des géométries (-makevalid)
   ↓
Nettoyage des propriétés
   ↓
communes.geojson
   ↓
Tippecanoe → couche communes
```

---

## 13. Conclusion

Cette procédure garantit :
- des polygones stables et fiables
- une indépendance vis-à-vis d’OSM
- une intégration propre dans les tuiles vectorielles
- une architecture claire et maintenable sur le long terme
