# Feature — Modes d’affichage carto (Layer Display) + Menu “Couches”

**Statut** : Implémenté  
**Implémentation** : Terminée  
**Dernière révision** : 2026-02-05
## Contexte

Le projet **choisir-sa-ville** est une application Jamstack : données statiques versionnées servies par le frontend (Next.js) et consommées côté client. La carte est un **adaptateur MapLibre GL** : elle doit rester **performante, prévisible** et **découplée** des composants UI et de la logique métier.

Cette feature introduit un **sélecteur de modes d’affichage cartographique** (appelé “Layer Display” dans les échanges), afin de basculer entre :

- **Default** : rendu standard à l’arrivée (style du TileServer + labels interactables + polygones d’admin selon zoom).
- Des modes “thématiques” qui mettent en avant un agrégat métier sous forme de **choroplèthe/heatmap** :
  - Prix des loyers
  - Prix d’achat
  - Densité de population
  - Couleur politique
  - **Insécurité (SSMSI)**

Le sélecteur est **exclusivement carto** : il ne pilote pas le panneau de droite et ne modifie pas la sélection d’entité.

---

## Objectifs produit

### Court terme (MVP)

- Donner à l’utilisateur un moyen simple de **changer le “mode de lecture”** de la carte.
- Introduire le mode **Insécurité** :
  - En mode Insécurité, les polygones des communes visibles (si le zoom le permet) sont colorés selon le niveau d’insécurité.
  - Les états d’interaction (`highlight`, `active`) doivent **rester lisibles** sans “casser” la choroplèthe.

### Long terme

- Ajouter progressivement d’autres modes (loyers, achat, densité, politique) en réutilisant **la même architecture**.
- Permettre des sous-options par mode (ex : année, palette, opacité) sans refactor du système.
- Préparer une légende et des contrôles UX additionnels (hors scope MVP).

---

## Principes (non négociables)

- **Pas de backend runtime** : tout mode consomme des fichiers statiques `/public/data/...`.
- **Lazy loading** : on ne charge pas un agrégat tant que le mode correspondant n’est pas activé.
- **Cache multi-niveaux** :
  - cache mémoire (session)
  - cache persistant (IndexedDB si présent dans la stack)
  - cache HTTP long sur fichiers versionnés
- **Pas de fetch sur hover/pan** : aucun spam réseau. Les interactions carte restent locales.
- **Séparation stricte** :
  - UI = composant menu + affichage
  - state = service headless
  - map = binder/adaptateur MapLibre qui applique le style
  - data = loader/caches des métriques (fichiers statiques)

---

## UX / Comportement attendu

### Sélecteur de mode

- Un petit menu (dropdown) “Couches” (ou “Affichage”) placé **dans l’overlay carto**.
- Valeur par défaut : `Default`.
- Le changement de mode :
  - ne modifie pas l’entité sélectionnée
  - ne déclenche aucun changement dans le panneau de droite
  - peut déclencher un **lazy fetch** des données du mode choisi (si non en cache)

### Zoom et visibilité

- Si `zoom < minZoomPolygonesCommunes` : aucun polygone de commune ne s’affiche (comportement déjà présent / attendu).
- MVP : **pas de hint** UX si zoom trop bas.

---

## Architecture — découplage & encapsulation

### Vue d’ensemble (modules)

1) **UI**
- `MapLayerMenu` (composant) : affiche le dropdown, envoie les actions `setMode(...)`.

2) **Service headless (source of truth)**
- `MapDisplayModeService` : stocke le mode courant et notifie les subscribers.
  - Ne dépend ni de React ni de MapLibre.
  - API minimaliste : `getState()`, `setMode(mode)`, `subscribe(listener)`.

3) **Adaptateur carte**
- `MapDisplayBinder` (ou “MapModeBinder”) : écoute le `MapDisplayModeService` et applique les modifications à MapLibre.
  - Responsabilité : **appliquer du style** (paint/layout/filter) et gérer l’activation/désactivation de couches.
  - Ne gère pas les données métier de sélection (c’est le rôle du système de sélection existant).

4) **Accès aux données (métriques)**
- `ModeDataLoader` par agrégat (ex : `insecurityMetrics` déjà existant côté front) :
  - charge `meta.json` + `{year}.json`
  - parse le format tabulaire `columns/rows`
  - expose une structure rapide (ex : `Map<insee, indexGlobal>` et/ou `level`).

### Intégration avec la sélection d’entité (existant)

- La sélection (`highlight`/`active`) reste pilotée par le service de sélection.
- La carte applique déjà les feature-states `highlight`/`active` sur :
  - les labels interactables
  - certains polygones (communes / arrondissements)

**Règle en mode Insécurité** :
- le **remplissage** (fill) du polygone exprime le “niveau” (donnée) ;
- l’état `highlight/active` ne doit modifier que :
  - le style du **label**
  - le style du **contour** du polygone (line) de l’entité

But : conserver une choroplèthe stable et lisible, tout en gardant l’UX d’interaction.

---

## Modèle de données (Insécurité)

### Fichiers

- `communes/metrics/insecurity/meta.json`
- `communes/metrics/insecurity/{year}.json`

### Champs utiles

Dans `{year}.json` (format tabulaire) :
- `insee` (string) : clé commune
- `indexGlobal` (0..100) : rang percentile national (plus grand = plus haut dans la distribution)

### Niveau (UI)

Le niveau UI est un mapping de `indexGlobal` :
- 0–24 : faible
- 25–49 : modéré
- 50–74 : élevé
- 75–100 : très élevé

Remarque : le calcul du niveau doit être identique entre carte et badges UI.

---

## Spécification technique — Mode “Insécurité”

### Couches concernées

- Polygones communes :
  - `fill` : couleur dépend du niveau
  - `line` : couleur dépend du niveau + override `highlight/active` pour l’entité ciblée

### Règles de style (intention)

1) **Rendu de base (donnée)**
- `fill-color` = palette par niveau (4 couleurs)
- `fill-opacity` = valeur constante (ex: 0.18–0.30) ou variant par niveau
- `line-color` = couleur (plus sombre) cohérente avec le niveau
- `line-width` = width “normal” constant

2) **Interaction (feature-state)**
- `highlight/active` ne doit pas altérer `fill-color` (sinon la donnée devient ambiguë).
- `highlight/active` s’applique au `line` (contour) :
  - `highlight` : contour accent (couleur + width)
  - `active` : contour plus fort (couleur + width)

3) **Labels**
- Les labels interactables conservent leur logique :
  - `highlight/active` visibles
  - `hasData` visible (si l’entité a des données dans le dataset statique)

### Chargement data & perf

- `onModeChange(insécurité)` :
  - charger le dataset (dernière année ou année configurée)
  - construire une structure indexée : `Map<insee, indexGlobal|level>`
  - garder en mémoire (session) + persist (IndexedDB si activé)
- `onMoveEnd/onZoomEnd` :
  - **aucun fetch**
  - seulement mise à jour du style (si nécessaire)

---

## Non-objectifs (MVP)

- Pas de légende et pas de “hint” zoom.
- Pas de slider/choix d’année dans le menu (année “courante” seulement).
- Pas de découpages par tuiles/viewport pour les métriques (fichiers nationaux acceptés au début).
- Pas de rendu “raster heatmap” : on reste sur choroplèthe vectorielle via polygones.

---

## Plan d’implémentation (guideline)

1) Définir les **modes** (enum / union type) côté front.
2) Ajouter `MapDisplayModeService` (headless).
3) Ajouter le composant `MapLayerMenu` (overlay carte) et le brancher au service.
4) Ajouter un binder `MapDisplayBinder` :
   - écoute le service de mode
   - applique le style correspondant (default vs insécurité)
5) Ajouter le loader de données insécurité (si pas déjà) et le cache.
6) Implémenter la choroplèthe sur polygones communes en mode insécurité.
7) Vérifier que `highlight/active` n’affecte que label + contour.

---

## Critères d’acceptation

### Fonctionnel

- Un menu “Couches/Affichage” est visible dans l’overlay carte.
- Le mode `Default` restaure le rendu standard.
- Le mode `Insécurité` :
  - colore les polygones communes visibles (si zoom suffisant)
  - n’affiche rien si zoom trop bas (sans hint)
  - conserve l’UX highlight/active sur labels
  - limite highlight/active à l’apparence du contour polygonal (pas le fill)

### Performance

- Changer de mode ne doit pas déclencher de fetch répétés (cache OK).
- Aucun fetch réseau sur hover/pan.
- Un seul chargement par dataset (par année) et réutilisation ensuite.

---

## Risques & points de vigilance

- Taille des fichiers nationaux : parsing JSON et indexation doivent être faits **une seule fois** par mode/année.
- Collision entre styles “donnée” et “interaction” :
  - éviter les overrides qui rendent la choroplèthe ambiguë (fill changeant au hover).
- Cohérence des seuils :
  - le calcul `level` doit être partagé (carte + badge).

