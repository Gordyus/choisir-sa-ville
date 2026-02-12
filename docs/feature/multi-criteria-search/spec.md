# Spécification — Recherche Multi-Critères (UI + Scoring Engine)

**Statut** : Draft  
**Date** : 12 février 2026  
**Implémentation** : Non commencée  
**Dépendances** : `routing-service`, `commune-metrics-extended`

---

## 1) Contexte & intention produit

Les utilisateurs cherchant un logement (location ou achat) doivent **jongler entre 50 onglets** (leboncoin, SeLoger, carte, temps trajet Google Maps, données sécurité...).

**Problème** : Pas d'outil CRM personnel pour centraliser la recherche avec critères multiples.

**Solution** : Interface de recherche guidée permettant de :
1. Définir critères objectifs (temps trajet, budget, cadre de vie)
2. Obtenir **scoring communes** (0-100)
3. Afficher résultats sur carte + table triée
4. Explorer détails commune avant de chercher annonces

---

## 2) Objectifs

### Objectif utilisateur

**Persona location** :
> "Je cherche une location proche Montpellier, temps trajet travail maman ≤ 45min (lundi 8h30), travail papa ≤ 30min, quartier tranquille, plutôt maison 3 pièces, campagne."

**Persona achat** :
> "Je veux acheter une maison 4 pièces dans l'Hérault, budget 350 000€ max, à 30min de Montpellier en voiture, commune sécurisée, pas trop isolée."

**Besoin commun** : Outil qui **synthétise et filtre** au lieu de multiplier les sources.

### Objectif produit

**MVP** : Valider hypothèse "recherche multi-critères avec temps trajet spécifique = valeur ajoutée décisive".

**Métrique clé** : % utilisateurs utilisant recherche guidée vs exploration libre.

**Objectif** : > 60% utilisateurs préfèrent recherche guidée (après onboarding).

### Objectif technique

**Architecture** :
- UI React (Next.js App Router)
- Scoring engine **client-side** (pas de backend calcul)
- Intégration `SelectionService` (highlight résultats sur carte)
- Appel backend routing pour critère temps trajet

---

## 3) Hors périmètre (MVP)

- ❌ Sauvegarde recherches (localStorage ou backend)
- ❌ Multi-profils (couple avec 2 lieux travail différents → 1 seul profil MVP)
- ❌ Comparaison adresses candidates (CRM avancé)
- ❌ Alertes email (nouvelle annonce matching critères)
- ❌ Partage recherche (URL avec critères sérialisés)
- ❌ Historique recherches
- ❌ Suggestions basées IA (communes similaires)
- ❌ Export résultats CSV/PDF

---

## 4) Décisions & hypothèses

### Parcours utilisateurs

**3 parcours proposés** :

1. **Exploration libre** (actuel)
   - Carte interactive sans critères
   - Clic commune → détails
   - Public : curieux, découverte

2. **Recherche location** (nouveau)
   - Formulaire critères location
   - Scoring + résultats
   - Public : locataires cherchant logement

3. **Recherche achat** (nouveau)
   - Formulaire critères achat
   - Scoring + résultats
   - Public : acheteurs cherchant résidence principale/secondaire

**Différence location vs achat** :
| Critère | Location | Achat |
|---------|----------|-------|
| Budget | Loyer max/mois (futur OLL) | Prix achat max |
| Horizon temps | Court terme (<1 an) | Long terme (>5 ans) |
| Pondération temps trajet | Plus élevée (40%) | Moyenne (30%) |
| Critères secondaires | Proximité services | Évolution prix (futur) |

**MVP** : Formulaires identiques sauf labels ("Budget location" vs "Budget achat").

---

### Critères de recherche MVP

**4 critères obligatoires** (décidés avec PO) :

#### 1. Temps de trajet (P0)

**UI** :
- Champ adresse destination (autocomplete géocodage)
- Sélecteur jour semaine (lundi-vendredi)
- Sélecteur heure (6h-22h, pas 30min)
- Slider durée max (0-90 min)

**Exemple** :
```
📍 Destination : "12 Rue de Rivoli, Paris"
📅 Jour : Lundi
🕐 Heure départ : 8h30
⏱️ Durée max : 45 min
```

**Logique** :
- Appel backend `/api/routing/matrix`
- Filtrage communes : `travelTime > maxDuration` → exclus
- Scoring : distance normalisée (0 min = 100 pts, 90 min = 0 pts)

**Cas multi-destinations** (post-MVP) :
- 2 adresses (travail maman + papa)
- Logique : somme pondérée ou contrainte max sur chaque

---

#### 2. Sécurité / Tranquillité (P0)

**UI** :
- Slider "Niveau tranquillité minimum" (1-5 étoiles)
- Label : "Éviter zones très criminogènes"

**Exemple** :
```
🛡️ Tranquillité min : ⭐⭐⭐⭐ (niveau 4/5)
```

**Logique** :
- Métrique SSMSI existante (niveau 0-4, 0 = sécurisé)
- Filtrage : `securityLevel > (5 - selected)` → exclus
- Scoring : niveau normalisé (0 = 100 pts, 4 = 0 pts)

---

#### 3. Budget immobilier (P0)

**UI** :
- **Location** : Slider "Loyer max" (300-3000€/mois)
- **Achat** : Slider "Prix max" (50 000-2 000 000€)

**Exemple** :
```
💰 Budget achat max : 350 000 €
```

**Logique MVP** :
- Utiliser médiane prix DVF comme proxy loyer (OLL post-MVP)
- Filtrage : `medianPrice > maxBudget` → exclus
- Scoring : prix normalisé inversé (bas prix = 100 pts, haut prix = 0 pts)

**Note** : DVF = prix achat, pas loyer. Approximation acceptable MVP.

---

#### 4. Cadre de vie (P1)

**UI** :
- Toggle "Ville" / "Campagne" / "Indifférent"

**Exemple** :
```
🏞️ Cadre : Campagne
```

**Logique** :
- Métrique densité INSEE (`urban` / `rural`)
- Filtrage strict : si "Ville" → `density != "urban"` exclus
- Scoring : booléen (match = 100 pts, no match = 0 pts)

---

### Pondération critères

**Scoring pondéré** (configurable futur, hardcodé MVP) :

| Critère | Poids location | Poids achat |
|---------|----------------|-------------|
| Temps trajet | 40% | 30% |
| Sécurité | 30% | 30% |
| Budget | 20% | 30% |
| Cadre de vie | 10% | 10% |

**Formule** :
```
Score = (
  travel_score × 0.4 +
  security_score × 0.3 +
  budget_score × 0.2 +
  density_score × 0.1
) × 100
```

**Normalisation** : Chaque critère = 0.00-1.00 avant pondération.

**Exemple** :
```
Commune Béziers :
- Temps trajet : 25 min → score 0.72 (25/90 inversé)
- Sécurité : niveau 2 → score 0.50 (2/4 inversé)
- Budget : 220k (max 350k) → score 0.85
- Densité : urbain (recherche urbain) → score 1.00

Score final = 0.72×0.4 + 0.50×0.3 + 0.85×0.2 + 1.00×0.1
            = 0.288 + 0.150 + 0.170 + 0.100
            = 0.708 × 100 = 71/100
```

---

## 5) Workflow utilisateur

### Parcours recherche (happy path)

```
1. [Landing page]
   ↓ Clic "Commencer une recherche"
   
2. [Sélection parcours]
   - "Je cherche une location" → /recherche/location
   - "Je cherche à acheter" → /recherche/achat
   - "Exploration libre" → / (carte actuelle)
   
3. [Formulaire critères]
   📍 Adresse travail : [autocomplete]
   📅 Jour : [select]
   🕐 Heure : [select]
   ⏱️ Durée max : [slider]
   🛡️ Tranquillité : [slider]
   💰 Budget : [slider]
   🏞️ Cadre : [toggle]
   
   [Bouton "Lancer la recherche"]
   
4. [Calcul]
   - Loading spinner "Calcul temps trajet..." (3-5s)
   - Appel backend routing
   - Scoring client-side
   
5. [Résultats]
   - Carte : communes colorées par score (vert → rouge)
   - Table : top 50 communes triées par score
   - Colonnes : Nom, Score, Temps trajet, Prix médian, Sécurité
   - Clic ligne → highlight carte + panneau détail
   
6. [Exploration détails]
   - Clic commune carte ou table → RightPanelDetailsCard
   - Affichage métriques complètes
   - Lien vers annonces (leboncoin, SeLoger) — externe MVP
```

---

## 6) UI — Wireframes & composants

### Page `/recherche/selection`

**Wireframe** :
```
┌─────────────────────────────────────────────────┐
│ Navbar (logo + liens)                            │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌─────────────────────────────────────────┐    │
│  │  Trouvez votre logement idéal           │    │
│  │  Choisissez votre parcours              │    │
│  └─────────────────────────────────────────┘    │
│                                                  │
│  ┌──────────────┐  ┌──────────────┐             │
│  │ 🏠 Location  │  │ 🏡 Achat      │             │
│  │              │  │              │             │
│  │ [Commencer] │  │ [Commencer]  │             │
│  └──────────────┘  └──────────────┘             │
│                                                  │
│  ┌──────────────────────────────────┐           │
│  │ 🗺️ Exploration libre              │           │
│  │ Découvrir sans critères          │           │
│  │ [Explorer la carte]              │           │
│  └──────────────────────────────────┘           │
│                                                  │
└─────────────────────────────────────────────────┘
```

---

### Page `/recherche/location` (ou `/achat`)

**Wireframe** :
```
┌─────────────────────────────────────────────────┐
│ Navbar (← Retour)                                │
├─────────────────────────────────────────────────┤
│ 📝 Définissez vos critères — Location           │
├─────────────────────────────────────────────────┤
│                                                  │
│ ┌─────────────────────────────────────────────┐ │
│ │ 📍 Temps de trajet                          │ │
│ │                                             │ │
│ │ Destination : [Autocomplete adresse]       │ │
│ │ Jour : [Select lundi-vendredi]             │ │
│ │ Heure départ : [Select 6h-22h]             │ │
│ │ Durée maximum : [Slider 0-90 min] 45 min   │ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│ ┌─────────────────────────────────────────────┐ │
│ │ 🛡️ Sécurité / Tranquillité                  │ │
│ │                                             │ │
│ │ Niveau minimum : [Slider 1-5] ⭐⭐⭐⭐        │ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│ ┌─────────────────────────────────────────────┐ │
│ │ 💰 Budget                                    │ │
│ │                                             │ │
│ │ Loyer max : [Slider 300-3000€] 1 200 €     │ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│ ┌─────────────────────────────────────────────┐ │
│ │ 🏞️ Cadre de vie                             │ │
│ │                                             │ │
│ │ [Toggle] Ville | Campagne | Indifférent    │ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│         [Lancer la recherche]                    │
│                                                  │
└─────────────────────────────────────────────────┘
```

---

### Page `/recherche/resultats`

**Layout** :
- **Gauche (50%)** : Carte MapLibre
  - Communes colorées par score (gradient vert → jaune → rouge)
  - Hover commune → tooltip score + nom
  - Clic commune → highlight + détail panneau

- **Droite (50%)** : Table résultats + détail
  - Top : Table triée par score (top 50)
  - Bottom : `RightPanelDetailsCard` (quand commune sélectionnée)

**Wireframe** :
```
┌──────────────────────┬──────────────────────┐
│                      │ 🏆 Résultats (156)   │
│                      ├──────────────────────┤
│                      │ Nom | Score | Temps  │
│                      ├──────────────────────┤
│      CARTE           │ Béziers | 71 | 25min │
│                      │ Sète | 68 | 32min    │
│   (communes          │ Agde | 64 | 40min    │
│    colorées)         │ ...                  │
│                      ├──────────────────────┤
│                      │ [Commune sélectionnée]│
│                      │ Détails...           │
│                      │                      │
└──────────────────────┴──────────────────────┘
```

---

## 7) Architecture technique

### Composants React

**Nouveau fichier** : `apps/web/app/recherche/`

```
recherche/
├── page.tsx                     # Sélection parcours (location/achat/libre)
├── location/
│   ├── page.tsx                 # Formulaire critères location
│   └── resultats/
│       └── page.tsx             # Résultats + carte
├── achat/
│   ├── page.tsx                 # Formulaire critères achat
│   └── resultats/
│       └── page.tsx             # Résultats + carte
└── components/
    ├── SearchForm.tsx           # Formulaire critères (partagé)
    ├── SearchResults.tsx        # Table résultats
    ├── SearchMap.tsx            # Carte avec communes scorées
    └── CriteriaInput/
        ├── TravelTimeInput.tsx
        ├── SecurityInput.tsx
        ├── BudgetInput.tsx
        └── DensityInput.tsx
```

---

### Scoring engine

**Nouveau fichier** : `apps/web/lib/search/scoringEngine.ts`

```typescript
export type SearchCriteria = {
  travelTime?: {
    destination: { lat: number; lng: number; label: string };
    dayOfWeek: "monday" | "tuesday" | ... ;
    departureTime: string; // "08:30"
    maxDuration: number; // minutes
  };
  security?: {
    minLevel: number; // 1-5
  };
  budget?: {
    maxPrice: number; // euros
  };
  density?: {
    preference: "urban" | "rural" | "any";
  };
};

export type ScoredCommune = {
  codeInsee: string;
  name: string;
  score: number; // 0-100
  breakdown: {
    travelScore: number;
    securityScore: number;
    budgetScore: number;
    densityScore: number;
  };
  metrics: {
    travelTime?: number;
    securityLevel?: number;
    medianPrice?: number;
    density?: string;
  };
};

export async function scoreCommunes(
  criteria: SearchCriteria
): Promise<ScoredCommune[]> {
  // 1. Fetch routing results (if travelTime criteria)
  // 2. Fetch commune metrics (realEstate, geography, security)
  // 3. Filter communes (hard constraints)
  // 4. Calculate scores per criterion
  // 5. Apply weights
  // 6. Sort by final score
  // 7. Return top N (configurable, default 200)
}
```

**Performances** :
- Calcul scoring 35k communes : ~50-100ms (JavaScript client-side)
- Rendering table 200 résultats : ~20ms (React virtualized si besoin)
- **Total latency** : routing API (3-5s) + scoring (<100ms) ≈ **3-5s**

---

### Client API routing

**Nouveau fichier** : `apps/web/lib/api/routingClient.ts`

```typescript
export type TravelTimeRequest = {
  destinations: Array<{ lat: number; lng: number; label: string }>;
  mode: "driving";
  departureTime: string; // ISO 8601
  dayOfWeek: string;
};

export type TravelTimeResult = {
  communeInsee: string;
  travelTimeMinutes: number;
  distance: number;
  cached: boolean;
};

export async function fetchTravelTimes(
  request: TravelTimeRequest
): Promise<TravelTimeResult[]> {
  const response = await fetch("/api/routing/matrix", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  
  if (!response.ok) {
    throw new Error(`Routing API error: ${response.status}`);
  }
  
  const data = await response.json();
  return data.results;
}
```

---

## 8) Intégration carte

### Feature-state scoring

**Nouveau vocabulaire feature-state** (labels MapLibre) :

- `score` : Number (0-100)
- `isSearchResult` : Boolean

**Style layer** :
```javascript
{
  "id": "commune-labels-scored",
  "type": "symbol",
  "source": "osm-labels",
  "filter": ["==", ["feature-state", "isSearchResult"], true],
  "paint": {
    "text-color": [
      "interpolate", ["linear"],
      ["feature-state", "score"],
      0, "#dc2626",   // Rouge (score 0-30)
      50, "#fbbf24",  // Jaune (score 30-60)
      100, "#10b981"  // Vert (score 60-100)
    ],
    "text-halo-color": "#ffffff",
    "text-halo-width": 2
  }
}
```

**Logique** :
1. Résultats recherche → liste `codeInsee` + `score`
2. Résolution nom commune → label OSM (disambiguation existante)
3. `map.setFeatureState(labelId, { isSearchResult: true, score: 71 })`
4. Rendu carte : labels colorés par score

---

## 9) Tests

### Tests unitaires

**Scoring engine** :
- ✅ Normalisation critère temps (0-90 min → 0.00-1.00)
- ✅ Normalisation critère prix (50k-2M → 0.00-1.00)
- ✅ Pondération correcte (somme poids = 1.00)
- ✅ Filtrage hard constraints (max duration, max price)
- ✅ Tri résultats par score desc

**Routing client** :
- ✅ Fetch API success → parse results
- ✅ Fetch API error → throw exception
- ✅ Timeout handling

---

### Tests E2E

**Parcours complet** :
1. ✅ Landing → clic "Chercher location"
2. ✅ Formulaire → saisir critères
3. ✅ Submit → loading spinner 3-5s
4. ✅ Résultats → table affichée, carte colorée
5. ✅ Clic commune table → highlight carte + détail
6. ✅ Clic commune carte → table row highlight

---

## 10) Performances & optimisations

### Latency budget

| Étape | Temps | Optimisation |
|-------|-------|--------------|
| Géocodage destination | 200ms | Cache backend |
| Calcul routing (35k communes) | 3-5s | Batch API + cache |
| Fetch metrics communes | 500ms | Fichiers statiques CDN |
| Scoring client-side | 50ms | JavaScript natif |
| Render résultats | 50ms | React virtualized si >500 |
| **Total** | **4-6s** | Acceptable MVP |

**Objectif post-MVP** : < 2s (cache routing hit rate >80%).

---

### Optimisation carte

**Problème** : Colorier 35k labels → performance MapLibre ?

**Solution** :
1. Filtrer résultats top 200 communes uniquement
2. Feature-state uniquement sur top 200
3. Reste communes : état normal

**Alternative** : Layer polygones communes (remplissage coloré) au lieu de labels.

---

## 11) Roadmap post-MVP

### Phase 2 : Multi-destinations

**Use case** : Couple avec 2 lieux travail.

**UI** :
- Bouton "+ Ajouter destination"
- Liste destinations avec poids (60% maman, 40% papa)

**Scoring** :
```
travel_score = (
  travel_time_dest1 × weight1 +
  travel_time_dest2 × weight2
) / (weight1 + weight2)
```

---

### Phase 3 : Sauvegarde recherches

**Fonctionnalité** :
- Bouton "Sauvegarder cette recherche"
- LocalStorage ou backend (si auth)
- Liste recherches sauvegardées
- Rejeu recherche 1 clic

---

### Phase 4 : CRM adresses candidates

**Use case** : Tracker annonces vues, prises de notes.

**UI** :
- Bouton "Ajouter à mes favoris" (adresse)
- Table adresses candidates avec notes
- Calcul métriques par adresse (temps trajet exact, pas commune)

---

### Phase 5 : Alertes email

**Fonctionnalité** :
- "Alerter si nouvelle annonce matching critères"
- Scraping leboncoin/SeLoger (complexe, légalité ?)
- Email quotidien avec nouvelles annonces

---

## 12) Métriques de succès MVP

### Produit

- ✅ **> 60% utilisateurs** utilisent recherche guidée (vs exploration libre)
- ✅ **> 80% recherches** incluent critère temps trajet
- ✅ **Taux conversion** : utilisateur recherche → clic annonce externe > 40%
- ✅ **Retention D7** : utilisateur revient dans 7 jours > 30%

### Technique

- ✅ Latency P95 < 6s (calcul + rendu)
- ✅ Error rate < 2% (backend routing API)
- ✅ Aucun crash frontend (0 erreur React non catchée)

---

## 13) Risques & mitigations

| Risque | Impact | Probabilité | Mitigation |
|--------|--------|-------------|------------|
| Latency routing trop élevée (>10s) | Élevé | Moyenne | Cache agressif, affichage progressif, feedback loading |
| Utilisateurs ne comprennent pas scoring | Moyen | Moyenne | Tooltip explication score, breakdown par critère visible |
| Trop de résultats (35k communes) | Faible | Élevée | Limiter affichage top 200, filtres géographiques (département) |
| Données prix incomplètes (rural) | Moyen | Élevée | Message "Données insuffisantes", désactivation filtrage prix |

---

## 14) Documentation utilisateur

### FAQ

**Q** : Comment est calculé le score ?  
**R** : Score basé sur 4 critères pondérés : temps trajet (40%), sécurité (30%), budget (20%), cadre de vie (10%). Chaque critère noté 0-100.

**Q** : Pourquoi certaines communes n'apparaissent pas ?  
**R** : Communes exclues si dépassent contraintes (ex: temps trajet >45min, prix >350k€, données insuffisantes).

**Q** : Les temps de trajet sont-ils précis ?  
**R** : Temps estimés avec marge +10% basés sur trafic moyen par plage horaire. Vérifier avec GPS avant décision.

**Q** : Puis-je chercher plusieurs lieux travail ?  
**R** : Pas dans MVP. Fonctionnalité multi-destinations prévue phase 2.

---

## Annexes

### A. Exemple calcul scoring complet

**Critères recherche** :
- Temps trajet : 45 min max
- Sécurité : niveau 4/5 min
- Budget achat : 350 000€ max
- Cadre : Campagne

**Commune Agde (34003)** :
- Temps trajet : 40 min
- Sécurité : niveau 2 (score SSMSI)
- Prix médian maison : 280 000€
- Densité : Peu dense (rural)

**Calcul** :
```
travel_score = (90 - 40) / 90 = 0.556  (normalisé 0-90 inversé)
security_score = (4 - 2) / 4 = 0.500  (normalisé 0-4 inversé)
budget_score = (350000 - 280000) / 350000 = 0.200  (normalisé inversé)
density_score = 1.000  (match rural)

score_final = (
  0.556 × 0.40 +
  0.500 × 0.30 +
  0.200 × 0.20 +
  1.000 × 0.10
) = 0.222 + 0.150 + 0.040 + 0.100 = 0.512

Score affiché : 51/100
```

**Interprétation** : Commune "moyenne", faible sur budget (prix élevé), bonne sur cadre de vie.

---

### B. Wireframe détaillé table résultats

```
┌─────────────────────────────────────────────────────────┐
│ 🏆 156 communes correspondent à vos critères            │
├──────┬───────────┬───────┬───────────┬────────┬────────┤
│ #    │ Commune   │ Score │ Temps     │ Prix   │ Sécu   │
├──────┼───────────┼───────┼───────────┼────────┼────────┤
│ 1    │ Béziers   │ 71    │ 25 min    │ 220k   │ ⭐⭐⭐  │
│ 2    │ Sète      │ 68    │ 32 min    │ 245k   │ ⭐⭐⭐⭐ │
│ 3    │ Agde      │ 64    │ 40 min    │ 280k   │ ⭐⭐    │
│ ...  │           │       │           │        │        │
└──────┴───────────┴───────┴───────────┴────────┴────────┘
           [Exporter CSV] [Modifier critères]
```

**Interactions** :
- Hover row → highlight commune carte
- Clic row → sélection commune, affichage détail, scroll carte
- Sort colonnes (clic header)
