# Synchronisation URL de la carte

## Fonctionnalité

La position (centre) et le niveau de zoom de la carte MapLibre sont automatiquement synchronisés avec l'URL du navigateur via un query parameter.

## Format

**Query parameter** : `?view={lat},{lng},{zoom}`

**Exemple** : `/?view=48.8566,2.3522,12` (Paris au zoom 12)

## Comportement

### Au chargement de la page

- Si le paramètre `?view=...` est présent et valide → la carte s'initialise à cette position
- Si le paramètre est absent ou invalide → fallback sur la position par défaut (centre de la France, zoom 5)

### Pendant la navigation

- À chaque événement `moveend` ou `zoomend` de MapLibre, l'URL est mise à jour automatiquement
- Utilise `window.history.replaceState()` pour éviter de polluer l'historique du navigateur
- Précision :
  - Latitude/Longitude : 4 décimales (~11 mètres)
  - Zoom : 2 décimales

## Validation

Les valeurs sont validées avant d'être appliquées :
- **Latitude** : entre -90 et 90
- **Longitude** : entre -180 et 180
- **Zoom** : entre 0 et 22

## Cas d'usage

### Partage d'URL

Un utilisateur peut copier l'URL de la page et la partager avec quelqu'un d'autre. La personne qui ouvre le lien verra exactement la même vue de la carte.

```
https://choisir-sa-ville.local/?view=43.6047,1.4442,13
```

### Marque-page

L'utilisateur peut ajouter un marque-page pour revenir à une vue spécifique de la carte.

### Deep linking

Les liens externes peuvent pointer directement vers une zone géographique spécifique.

## Architecture

### Fichiers modifiés

- **`apps/web/lib/map/urlState.ts`** - Utilitaires de parsing/formatting
  - `parseViewFromURL()` - Parse les query params en coordonnées
  - `formatViewForURL()` - Formate les coordonnées en query param

- **`apps/web/components/vector-map.tsx`** - Composant carte principal
  - Lecture des query params au mount avec `useSearchParams()`
  - Synchronisation URL sur `moveend`/`zoomend`

### Intégration avec Next.js

- Utilise `useSearchParams()` de `next/navigation` (App Router)
- Compatible avec le mode client-side ("use client" component)
- Pas de re-render Next.js lors de la mise à jour URL

## Limitations

- **Pas de synchronisation de la sélection** : seule la position/zoom est synchronisée, pas l'entité sélectionnée (active)
- **Pas de support browser back/forward** : les boutons précédent/suivant du navigateur ne mettent pas à jour la carte (nécessiterait un listener `popstate` - hors scope)

## Évolutions futures possibles

- Ajouter `?entity=commune:75056` pour synchroniser aussi l'état de sélection
- Ajouter un debounce optionnel pour limiter les mises à jour URL
- Gérer les événements `popstate` pour supporter browser back/forward
- Ajouter un bouton "Partager" qui copie l'URL dans le presse-papier
