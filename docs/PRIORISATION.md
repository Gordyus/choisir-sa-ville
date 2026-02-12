# Priorisation Features — MVP Recherche Multi-Critères

**Date** : 12 février 2026  
**Contexte** : Planification implémentation MVP recherche logement avec temps de trajet

---

## Objectif MVP

Valider l'hypothèse : **"La recherche multi-critères avec temps de trajet à heure spécifique est un critère décisif pour trouver un logement"**

**Timeline cible** : 4-6 semaines (1 développeur full-time)  
**Budget** : 0-15€/mois infrastructure

---

## Priorisation (ordre d'implémentation)

### ✅ **Phase 0 : Fondations (terminées)**

| Feature | Statut | Effort | Valeur |
|---------|--------|--------|--------|
| Architecture Jamstack statique | ✅ Terminé | — | — |
| Carte MapLibre + interactions label-first | ✅ Terminé | — | — |
| Métriques sécurité SSMSI | ✅ Terminé | — | — |
| Transactions DVF département 34 | ✅ Terminé | — | — |
| Multi-lots + ventes complexes DVF | ✅ Terminé | — | — |

---

### 🎯 **Phase 1 : Backend Routing (critique, bloquant)** — **Semaine 1-2**

**Pourquoi priorité #1** : Bloquant pour toute feature de recherche. Aucune valeur utilisateur sans calcul temps de trajet.

| Feature | Spec | Effort | Dépendances | Risque |
|---------|------|--------|-------------|--------|
| **Service Routing Backend** | [`routing-service/spec.md`](feature/routing-service/spec.md) | 🔴 Élevé (10j) | Aucune | Moyen (API externe) |

**Délivrables** :
- ✅ Structure `apps/api-routing/` (Fastify + TypeScript)
- ✅ Pattern Adapter : interface `RoutingProvider`
- ✅ Implémentation `TomTomProvider` (2500 req/jour gratuit)
- ✅ Implémentation `MockProvider` (tests + fallback)
- ✅ Cache PostgreSQL optionnel (mocker si besoin)
- ✅ Endpoint `POST /api/routing/matrix`
- ✅ Endpoint `POST /api/geocode`
- ✅ Géocodage avec cache
- ✅ Geohash6 snapping + time bucketing
- ✅ Marge erreur +10% configurable
- ✅ Déploiement Railway.app
- ✅ Tests intégration (TomTom API réelle)
- ✅ Documentation API (README apps/api-routing)

**Critères de validation** :
- [ ] Calcul 35k communes → 1 destination en < 5s (avec cache hit >50%)
- [ ] Latency P95 < 5s
- [ ] Error rate < 1%
- [ ] Coûts < 15€/mois

**Bloque** : Recherche multi-critères (feature #3)

---

### 📊 **Phase 2 : Métriques Communes Étendues** — **Semaine 2-3**

**Pourquoi priorité #2** : Nécessaire pour scoring (prix, densité). Pas bloquant si partiellement implémenté (peut démarrer recherche avec seulement sécurité + temps trajet).

| Feature | Spec | Effort | Dépendances | Risque |
|---------|------|--------|-------------|--------|
| **Métriques Communes Étendues** | [`commune-metrics-extended/spec.md`](feature/commune-metrics-extended/spec.md) | 🟡 Moyen (7j) | DVF (✅ terminé) | Faible |

**Délivrables** :
- ✅ Export `communes/metrics/realEstate.json` (prix médians DVF)
  - Agrégation transactions 2 dernières années
  - Médiane prix/m², appartement, maison
  - Filtrage aberrations (< 5k€, > 10M€)
- ✅ Export `communes/metrics/geography.json` (densité + côte)
  - Grille densité INSEE (urban/rural)
  - Distance côte (coastline France GeoJSON)
- ✅ Export `communes/centroids.json` (coordonnées pour routing)
- ✅ Hook React `useCommuneMetrics(codeInsee)`
- ✅ Intégration `RightPanelDetailsCard` (affichage métriques)
- ✅ Tests qualité données (couverture >90%, valeurs cohérentes)

**Critères de validation** :
- [ ] Couverture données prix >90% communes
- [ ] Taille fichiers < 5 MB (gzippé)
- [ ] Temps build < 5 min total
- [ ] Affichage métriques dans UI détail commune

**Bloque partiellement** : Recherche multi-critères (critères budget + densité)

---

### 🔍 **Phase 3 : Recherche Multi-Critères (cœur MVP)** — **Semaine 3-5**

**Pourquoi priorité #3** : Feature principale MVP. Toute la valeur utilisateur. Dépend de #1 (routing) et idéalement #2 (métriques).

| Feature | Spec | Effort | Dépendances | Risque |
|---------|------|--------|-------------|--------|
| **Recherche Multi-Critères** | [`multi-criteria-search/spec.md`](feature/multi-criteria-search/spec.md) | 🔴 Élevé (12j) | Routing (#1), Métriques (#2), SSMSI (✅) | Moyen (UX complexe) |

**Délivrables** :

**Semaine 3** — Scoring engine + API client
- ✅ Scoring engine client-side `lib/search/scoringEngine.ts`
  - Normalisation critères (0-1)
  - Pondération (travel 40%, security 30%, budget 20%, density 10%)
  - Filtrage hard constraints (max duration, max price)
  - Tri résultats par score
- ✅ Client API routing `lib/api/routingClient.ts`
- ✅ Tests unitaires scoring (normalisation, pondération, filtrage)

**Semaine 4** — UI formulaire + résultats
- ✅ Page `/recherche/selection` (choix parcours location/achat/libre)
- ✅ Page `/recherche/location` + `/recherche/achat` (formulaire critères)
  - Composant `TravelTimeInput` (adresse autocomplete + jour + heure + slider durée)
  - Composant `SecurityInput` (slider tranquillité 1-5)
  - Composant `BudgetInput` (slider prix/loyer)
  - Composant `DensityInput` (toggle ville/campagne/indifférent)
- ✅ Page `/recherche/resultats` (layout carte + table)
  - Composant `SearchResults` (table triée score, top 50)
  - Composant `SearchMap` (carte communes colorées par score)
- ✅ Intégration `SelectionService` (highlight résultats)

**Semaine 5** — Polish + optimisations
- ✅ Feature-state scoring carte (gradient vert → jaune → rouge)
- ✅ Hover/clic commune table ↔ carte (sync bidirectionnel)
- ✅ Loading states (spinner calcul routing 3-5s)
- ✅ Error handling (API routing down, quota dépassé)
- ✅ Responsive mobile (formulaire + résultats)
- ✅ Tests E2E (parcours complet recherche → résultats → détail)

**Critères de validation** :
- [ ] Latency recherche < 6s (P95)
- [ ] Affichage 200 résultats sans lag
- [ ] Sync carte ↔ table fonctionnel
- [ ] Mobile responsive
- [ ] > 80% utilisateurs test utilisent critère temps trajet
- [ ] Taux conversion recherche → clic annonce externe > 40%

**Bloque** : Aucune feature (MVP complet)

---

### 🚀 **Phase 4 : Polish & Déploiement** — **Semaine 6**

| Tâche | Effort | Priorité |
|-------|--------|----------|
| Tests manuels QA (scénarios utilisateur réels) | 2j | P0 |
| Optimisations performances (cache routing hit rate >70%) | 2j | P1 |
| Documentation utilisateur FAQ (recherche multi-critères) | 1j | P0 |
| Setup monitoring (Sentry errors, metrics routing) | 1j | P1 |
| Déploiement production (Vercel + Railway) | 1j | P0 |

---

## Post-MVP (Phase 5+) — **Différé après validation**

| Feature | Spec | Effort | Priorité | Condition déclenchement |
|---------|------|--------|----------|------------------------|
| **Indicateurs immobiliers multi-échelle** | [`real-estate-multiscale-indicators/spec.md`](feature/real-estate-multiscale-indicators/spec.md) | 🔴 Élevé | P2 | Si >70% utilisateurs veulent détails quartier |
| **Search + Travel (legacy)** | [`search-travel/spec.md`](feature/search-travel/spec.md) | 🔴 Élevé | P3 | Remplacé par multi-criteria-search, archiver |
| **Couleur politique** | [`political-color/spec.md`](feature/political-color/spec.md) | 🟡 Moyen | P3 | Si demande utilisateurs >30% |
| **Loyers OLL** (extension métriques) | — | 🟢 Faible | P1 | Après validation MVP location |
| **Multi-destinations** (extension recherche) | — | 🟡 Moyen | P1 | Si >50% utilisateurs veulent 2+ lieux travail |
| **Transport en commun** (extension routing) | — | 🟡 Moyen | P2 | Après validation MVP voiture |
| **CRM adresses candidates** | — | 🔴 Élevé | P2 | Si >60% utilisateurs trackent >5 annonces |
| **Isochrones visuelles** | — | 🟡 Moyen | P3 | Feature "nice to have", pas critique |
| **OSRM self-hosted** (migration routing) | — | 🟡 Moyen | P2 | Si coûts TomTom >50€/mois |

---

## Dépendances techniques (graphe)

```
Phase 1 : Backend Routing
   ↓ (bloque)
Phase 3 : Recherche Multi-Critères
   ↑ (dépend partiellement)
Phase 2 : Métriques Communes

Légende :
→ dépendance bloquante
⇢ dépendance partielle (peut avancer sans)
```

**Chemin critique** : Phase 1 (routing) → Phase 3 (recherche)  
**Parallélisable** : Phase 2 (métriques) peut démarrer pendant Phase 1

---

## Métriques de succès MVP global

### Produit

| Métrique | Objectif | Mesure |
|----------|----------|--------|
| % utilisateurs utilisant recherche guidée (vs exploration libre) | >60% | Analytics événements |
| % recherches incluant critère temps trajet | >80% | Logs backend routing |
| Taux conversion recherche → clic annonce externe | >40% | Tracking liens sortants |
| Retention D7 (utilisateur revient sous 7 jours) | >30% | Analytics sessions |
| NPS (Net Promoter Score) | >50 | Survey post-recherche |

### Technique

| Métrique | Objectif | Mesure |
|----------|----------|--------|
| Latency recherche P95 | <6s | Monitoring backend + frontend |
| Cache routing hit rate | >70% après 2 semaines | Logs backend |
| Error rate backend routing | <1% | Sentry |
| Disponibilité backend | >99% | Monitoring uptime |
| Coûts infrastructure/mois | <15€ | Factures Railway + TomTom |

---

## Planning Gantt (6 semaines)

```
Semaine  │ 1        │ 2        │ 3        │ 4        │ 5        │ 6
─────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────
Phase 1  │ ████████ │ ████     │          │          │          │
Phase 2  │          │ ████████ │ ████     │          │          │
Phase 3  │          │          │ ████████ │ ████████ │ ████████ │
Phase 4  │          │          │          │          │          │ ████████

Légende :
████ = Travail actif
     = Idle / buffer
```

**Points de synchronisation** :
- **Fin S2** : Demo backend routing (calcul temps trajet fonctionnel)
- **Fin S3** : Demo métriques + scoring engine (tests unitaires)
- **Fin S4** : Demo UI recherche (formulaire + résultats basiques)
- **Fin S5** : Demo MVP complet (polish, interactions carte)
- **Fin S6** : Déploiement production + retrospective

---

## Décisions & Trade-offs

### Cache PostgreSQL optionnel Phase 1

**Décision** : Mocker cache en mémoire (Map) pour MVP si PostgreSQL complexifie.

**Raison** :
- TomTom 2500 req/jour gratuit = largement suffisant MVP (<50 utilisateurs/jour)
- PostgreSQL = overhead infra (Railway.app config, migrations, tests)
- Cache mémoire = suffit pour validation hypothèse

**Condition migration PostgreSQL** :
- Si quota TomTom dépassé régulièrement (>2000 req/jour)
- Si besoin persistence cache entre redémarrages backend

---

### Loyers OLL différé post-MVP

**Décision** : Utiliser médiane prix DVF comme proxy loyer en Phase 2.

**Raison** :
- OLL = source externe complexe (CSV, agrégation)
- DVF suffit pour validation hypothèse ("budget trop élevé" vs "abordable")
- Gain temps : 3-4 jours économisés

**Condition intégration OLL** :
- Si >60% utilisateurs parcours "location" (vs "achat")
- Si feedback : "prix achat pas pertinent pour loyer"

---

### Scope 4 critères MVP (pas plus)

**Décision** : Limiter à temps trajet, sécurité, budget, densité.

**Critères différés post-MVP** :
- Proximité mer (demande <20% utilisateurs cible)
- Nuisances (aéroport, voie ferrée) — data complexe
- Transport en commun — API routing transit post-MVP
- Évolution prix immobilier — data historique + ML

**Raison** : Focus validation hypothèse core, éviter scope creep.

---

## Risques majeurs

| Risque | Impact | Probabilité | Mitigation |
|--------|--------|-------------|------------|
| **Latency routing >10s inacceptable** | 🔴 Critique | Moyenne | Cache hit rate >70%, batch API, feedback loading, affichage progressif |
| **Quota TomTom dépassé en production** | 🔴 Critique | Faible | Monitoring quotidien, alertes, passage payant rapide si succès, fallback erreur 503 |
| **UX formulaire trop complexe** | 🟡 Moyen | Moyenne | Tests utilisateurs S4, simplification critères, onboarding guidé |
| **Données prix DVF incomplètes (rural)** | 🟡 Moyen | Élevée | Message "Données insuffisantes", filtrage prix désactivable, focus urbain MVP |
| **Performance scoring 35k communes** | 🟢 Faible | Faible | Benchmark JS natif <100ms garanti, Web Worker si besoin |

---

## Points de décision GO/NO-GO

### Fin Phase 1 (Semaine 2)

**Critères GO** :
- ✅ Backend routing calcule 1000 communes en <3s
- ✅ Cache hit rate >30% après 100 requêtes
- ✅ TomTom API fonctionne sans erreur 429
- ✅ Déployé Railway.app avec 0€ coûts

**NO-GO si** :
- ❌ Latency >10s systématique
- ❌ TomTom API instable (>10% erreurs)
- ❌ Coûts dépassent 20€/mois

---

### Fin Phase 3 (Semaine 5)

**Critères GO (lancement MVP)** :
- ✅ Parcours complet recherche → résultats fonctionne
- ✅ >5 utilisateurs test valident UX positive
- ✅ Latency recherche <8s (P95)
- ✅ 0 crash frontend
- ✅ Carte + table synchronisées

**NO-GO si** :
- ❌ Latency >15s systématique
- ❌ UX confuse (tests utilisateurs négatifs)
- ❌ Backend instable (>5% erreurs)

---

## Conclusion

**Priorisation finale** :

1. **Phase 1 : Backend Routing** (S1-2) — 🔴 Critique, bloquant
2. **Phase 2 : Métriques Communes** (S2-3) — 🟡 Important, partiellement parallélisable
3. **Phase 3 : Recherche Multi-Critères** (S3-5) — 🔴 Critique, cœur MVP
4. **Phase 4 : Polish & Déploiement** (S6) — 🟡 Important

**Timeline réaliste** : 6 semaines (1 dev)  
**Budget** : 0-15€/mois  
**Risque global** : Moyen (dépendance API externe, UX complexe)

**Recommandation** : Avancer Phase 1 immédiatement, Phase 2 peut démarrer S2 en parallèle.
