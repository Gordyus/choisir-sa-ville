# Vision Produit — Choisir sa Ville

**Date de création** : 12 février 2026  
**Statut** : Draft — **À COMPLÉTER ET VALIDER**  
**Auteur** : Équipe produit

---

## 1) Vision & Mission

### Mission

**Aider les Français à trouver le logement idéal** en fournissant un **outil CRM personnel** qui synthétise et analyse **toutes les données pertinentes** pour prendre une décision éclairée.

### Vision long terme

Devenir **la référence française** pour la recherche de logement basée sur des **critères de vie réels** (temps de trajet avec trafic, sécurité, prix du marché, cadre de vie) plutôt que sur des critères purement géographiques.

**Différenciation** : Nous sommes les seuls à calculer les temps de trajet **avec heure de départ spécifique** ("arriver au travail lundi 8h30") et à scorer les communes sur critères de vie objectifs.

### Problème résolu

**Actuellement, chercher un logement = chaos** :
- 50+ onglets navigateur ouverts (leboncoin, SeLoger, Google Maps, data.gouv.fr...)
- Aucun outil pour centraliser, comparer, scorer
- Temps de trajet approximatifs (distance à vol d'oiseau, pas de trafic)
- Données sécurité, prix marché : éparpillées ou payantes
- Décisions émotionnelles mal informées ("j'ai l'impression que c'est cher")

**Notre solution** : Un **assistant de recherche intelligent** qui :
1. Centralise toutes les données publiques (INSEE, DVF, SSMSI, OSM)
2. Calcule les temps de trajet réels avec trafic et heure de départ
3. Score les communes selon critères personnalisés
4. Aide à valider si une adresse candidate est une bonne opportunité

---

## 2) Personas

### Persona 1 : **Camille, locataire urbaine** (priorité P0)

**Démographie** :
- 28 ans, célibataire, CDI startup tech
- Revenu : 2 800€/mois net
- Localisation actuelle : Paris 11e (coloc)
- Objectif : location solo proche travail (Montpellier)

**Besoins** :
- ✅ Temps trajet travail ≤ 30 min en voiture (horaires 9h-18h)
- ✅ Loyer ≤ 900€/mois (charges comprises)
- ✅ Quartier sécurisé (jeune femme seule)
- ✅ Proximité transports, commerces
- ❌ Pas achat immédiat (épargne insuffisante)

**Parcours actuel** :
1. Recherche annonces leboncoin/SeLoger (rayon 15km Montpellier)
2. Google Maps : calcul temps trajet approximatif
3. Recherche Google "Quartier X Montpellier sécurité"
4. Visite 5-10 logements avant décision
5. Souvent mauvaise surprise : trajet réel >45min aux heures de pointe

**Frustrations** :
- "Impossible de filtrer par temps de trajet RÉEL"
- "Je ne sais jamais si le loyer est correct pour la zone"
- "Les annonces ne disent rien sur la sécurité du quartier"

**Objectif avec notre app** :
- Trouver 3-5 communes cibles en <10 min
- Filtrer annonces leboncoin sur ces communes uniquement
- Économiser 20h+ de recherche

---

### Persona 2 : **Marc & Julie, couple acheteurs** (priorité P0)

**Démographie** :
- Marc 35 ans (ingénieur), Julie 33 ans (enseignante)
- 2 enfants (5 et 8 ans)
- Revenus cumulés : 5 500€/mois net
- Budget achat : 350 000€ max (apport 50k€)
- Localisation actuelle : location Toulouse
- Objectif : achat résidence principale Hérault (proche Montpellier)

**Besoins** :
- ✅ Temps trajet Marc (bureau Montpellier) ≤ 30 min
- ✅ Temps trajet Julie (école Lunel) ≤ 45 min
- ✅ Maison 4 pièces + jardin
- ✅ Budget ≤ 350 000€
- ✅ Commune sécurisée (enfants)
- ✅ Cadre de vie "campagne" (pas hyper-urbain)
- ❌ Pas investissement locatif (usage personnel)

**Parcours actuel** :
1. SeLoger : recherche maisons Hérault <350k€
2. Google Maps : calcul trajet pour chaque annonce (×50)
3. Sites mairie : écoles, services publics
4. DVF Etalab : "Est-ce que 320k€ est un bon prix pour Baillargues ?"
5. Visite 10-15 maisons sur 6 mois
6. Décision finale : souvent trop cher ou mauvaise surprise PLU

**Frustrations** :
- "On passe des week-ends entiers à visiter des maisons qui ne conviennent pas"
- "Impossible de savoir si 340k€ est un bon prix ou 30k€ trop cher"
- "Les agences survendent, on a aucune donnée objective"

**Objectif avec notre app** :
- Identifier 10-15 communes cibles en 1h
- Valider prix marché pour chaque annonce candidate
- Éviter pièges (zone bruyante, mauvaise évolution prix, sur-évaluation)

---

### Persona 3 : **Sophie, investisseur débutant** (priorité P3 — post-MVP)

**Démographie** :
- 42 ans, cadre banque
- Revenu : 4 200€/mois net
- Patrimoine : 80k€ épargne
- Objectif : investissement locatif (rendement >5%)

**Besoins** :
- ✅ Rendement locatif élevé (loyer / prix achat)
- ✅ Demande locative forte (taux occupation >95%)
- ✅ Évolution prix favorable (potentiel plus-value)
- ✅ Fiscalité optimisée (Pinel, LMNP)
- ❌ Pas résidence personnelle

**Hors scope MVP** : Critères trop spécifiques investisseurs (rendement, fiscalité, demande locative). Besoin KPI avancés.

---

## 3) Stratégie de monétisation

### Modèle économique : **Freemium + Premium**

#### Tier Gratuit (MVP)

**Cible** : Acquisition utilisateurs, validation hypothèse produit

**Features incluses** :
- ✅ Recherche multi-critères illimitée (4 critères MVP)
- ✅ Temps de trajet 1 destination (voiture uniquement)
- ✅ Scoring communes (0-100)
- ✅ Détails communes (métriques sécurité, prix médians, densité)
- ✅ Affichage carte + table résultats
- ✅ Historique transactions DVF (département 34)

**Limites** :
- ❌ 1 destination max (pas multi-destinations)
- ❌ Pas de sauvegarde recherches
- ❌ Pas de scoring adresses précises (commune uniquement)
- ❌ Pas d'alertes email
- ❌ Données DVF limitées (département 34 uniquement MVP)

**Objectif** :
- Taux conversion gratuit → premium : **> 5%** (après 3 recherches)
- Retention D30 : **> 40%**

---

#### Tier Premium (post-MVP, T+6 mois)

**Prix** : **9,90€/mois** ou **79€/an** (-33%)

**Cible** : Acheteurs sérieux + locataires exigeants

**Features supplémentaires** :
- ✅ **Multi-destinations** (couple 2 lieux travail, école enfants)
- ✅ **Scoring adresse précise** (validation opportunité bien immobilier)
  - Temps trajet exact (pas commune, adresse GPS)
  - Analyse prix marché (DVF adresse + 500m rayon)
  - Points de vigilance (nuisances : aéroport, voie ferrée, industries)
  - Analyse PLU (zonage, constructibilité)
- ✅ **Sauvegarde recherches illimitée** (CRM personnel)
- ✅ **Historique adresses candidates** (tracking annonces, notes)
- ✅ **Alertes email** (nouvelles annonces matching critères)
- ✅ **Données DVF France entière**
- ✅ **Transport en commun** (calcul temps trajet transit)
- ✅ **Export résultats** (CSV, PDF rapport)

**Valeur ajoutée clé** :
- "Éviter 1 seule mauvaise décision immobilière = rentabiliser 120 mois d'abonnement"
- "Économiser 50h de recherche = 500€+ de temps perso"

**Objectif conversion** :
- **CAC (coût acquisition client)** : < 20€ (SEO organique + bouche à oreille)
- **LTV (lifetime value)** : 150€ (15 mois rétention moyenne)
- **Ratio LTV/CAC** : > 7

---

#### Tier Entreprise (post-MVP, T+12 mois)

**Prix** : **Sur devis** (250-500€/mois)

**Cible** : Agences immobilières, promoteurs, collectivités

**Features** :
- ✅ API accès données (communes, métriques, scoring)
- ✅ White-label (intégration site agence)
- ✅ Volume queries élevé (100k+ req/mois)
- ✅ Support prioritaire
- ✅ Données historiques étendues (10 ans DVF)
- ✅ Custom reports

**Hors scope MVP** : Focus B2C uniquement.

---

## 4) Objectifs de rentabilité

### Horizon MVP (Mois 0-6)

**Objectif** : **Validation produit, 0 rentabilité attendue**

**KPI** :
- **MAU (utilisateurs actifs/mois)** : > 500 (M6)
- **Taux conversion recherche → annonce externe** : > 40%
- **NPS (Net Promoter Score)** : > 50
- **Coûts infra** : < 15€/mois

**Revenus** : **0€** (freemium uniquement)  
**Coûts** : ~100€/mois (dev time bénévole, infra minime)  
**Burn** : -100€/mois (acceptable phase validation)

---

### Horizon Post-MVP (Mois 7-12)

**Objectif** : **Monétisation, break-even**

**Lancement Premium** : M7

**KPI** :
- **MAU** : > 2 000
- **Premium subscribers** : > 100 (taux conversion 5%)
- **MRR (revenus récurrents/mois)** : > 1 000€
- **Churn rate** : < 10%/mois
- **CAC** : < 20€
- **LTV** : > 150€

**Revenus** : 1 000€/mois (100 users × 9,90€)  
**Coûts** : 500€/mois (infra scaling + marketing SEO)  
**Profit** : **+500€/mois** → break-even M9

---

### Horizon Croissance (Année 2)

**Objectif** : **Rentabilité, scaling**

**KPI** :
- **MAU** : > 20 000
- **Premium subscribers** : > 1 500
- **MRR** : > 15 000€
- **Équipe** : 2-3 personnes (dev + marketing)

**Revenus** : 15 000€/mois  
**Coûts** : 8 000€/mois (salaires + infra + marketing)  
**Profit** : **+7 000€/mois** (+84k€/an)

---

## 5) Métriques de succès (North Star)

### Métrique principale : **Taux d'adoption recherche guidée**

**Définition** : % utilisateurs utilisant recherche multi-critères vs exploration libre

**Objectif MVP** : **> 60%**

**Rationale** : Si <60%, notre hypothèse "recherche guidée = valeur ajoutée" est invalidée.

---

### Métriques secondaires

| Métrique | Objectif MVP | Objectif M12 | Mesure |
|----------|--------------|--------------|--------|
| **MAU** | 500 | 20 000 | Analytics sessions |
| **Retention D7** | 30% | 50% | Cohorte retour J+7 |
| **Retention D30** | 15% | 40% | Cohorte retour J+30 |
| **Conversion recherche → annonce** | 40% | 60% | Tracking clics liens externes |
| **NPS** | 50 | 70 | Survey post-recherche |
| **Temps moyen recherche** | <5 min | <3 min | Analytics événements |
| **Nb recherches/utilisateur/mois** | 3 | 8 | Analytics |
| **Taux conversion Premium** | — | 5% | Stripe |
| **Churn Premium** | — | <10%/mois | Stripe |

---

## 6) Canaux d'acquisition (post-MVP)

### Phase 1 (M0-6) : Organique pur

- ✅ SEO ("temps de trajet Montpellier", "où habiter Hérault")
- ✅ Bouche à oreille
- ✅ Reddit/forums (r/vosfinances, r/france)
- ❌ Pas de paid ads (budget 0)

**Objectif** : 500 MAU sans budget marketing

---

### Phase 2 (M7-12) : SEO + Content

- ✅ Blog ("Top 10 communes familiales Hérault", guides achat)
- ✅ Guest posts sites immo (SeLoger, MeilleursAgents)
- ✅ YouTube (guides recherche logement)
- ✅ Google Ads (expérimentation 200€/mois)

**Budget** : 500€/mois → objectif 50 conversions/mois (CAC 10€)

---

### Phase 3 (Année 2) : Scaling

- ✅ Partenariats agences immobilières (affiliation)
- ✅ Google Ads scaling (1 000€/mois)
- ✅ Facebook/Instagram (lookalike audiences)
- ✅ Influenceurs immobilier (nano/micro)

**Budget** : 2 000€/mois → objectif 100+ conversions/mois

---

## 7) Risques business

| Risque | Impact | Probabilité | Mitigation |
|--------|--------|-------------|------------|
| **Utilisateurs préfèrent exploration libre** | 🔴 Critique | Moyenne | Tests utilisateurs S4-5, itération rapide UX |
| **Faible conversion Premium (<3%)** | 🔴 Critique | Moyenne | A/B test pricing, valeur ajoutée claire, onboarding Premium |
| **Coûts API routing explosent** | 🟡 Moyen | Faible | Migration OSRM self-hosted, pricing dynamique Premium |
| **Concurrence (MeilleursAgents, SeLoger copient)** | 🟡 Moyen | Moyenne | Focus différenciation (temps trajet heure spécifique), vitesse execution |
| **Données DVF/INSEE obsolètes** | 🟢 Faible | Faible | Pipeline automatique, monitoring freshness |
| **Régulation RGPD/données publiques** | 🟢 Faible | Faible | Data 100% publique open data, anonymisation |

---

## 8) Roadmap produit (vision 18 mois)

### ✅ T0 (M0-6) : MVP Recherche

- Backend routing
- 4 critères (temps trajet, sécurité, prix, densité)
- Freemium uniquement
- DVF département 34

**Validation** : >60% adoption recherche guidée, NPS >50

---

### 🎯 T1 (M7-9) : Monétisation

- Lancement Premium (9,90€/mois)
- Multi-destinations
- Scoring adresse précise
- Sauvegarde recherches
- DVF France entière

**Objectif** : 100 subscribers Premium, MRR 1 000€

---

### 🚀 T2 (M10-12) : Scaling features

- Transport en commun (temps trajet transit)
- Alertes email (annonces matching)
- CRM adresses candidates (tracking, notes)
- Analyse PLU (zonage, constructibilité)
- Mobile app (React Native)

**Objectif** : 1 500 subscribers Premium, MRR 15 000€

---

### 🔮 T3 (M13-18) : Évolution

- Isochrones visuelles (zones 30min)
- Recommandations IA (communes similaires)
- Évolution prix (tendances marché)
- Loyers OLL (données locatives)
- API B2B (agences immobilières)

**Objectif** : 5 000 subscribers Premium, MRR 50 000€

---

## 9) Indicateurs clés à tracker (dashboard)

### Analytics produit

- MAU, DAU, WAU
- Taux adoption recherche guidée vs exploration libre
- Nb recherches/utilisateur
- Critères les plus utilisés (ranking)
- Temps moyen session
- Pages vues/session
- Taux rebond
- Conversion recherche → clic annonce externe

### Analytics business

- MRR (revenus récurrents mensuels)
- ARR (revenus annuels)
- Subscribers Premium actifs
- Churn rate (mensuel)
- CAC (coût acquisition client)
- LTV (lifetime value)
- Ratio LTV/CAC
- Conversion gratuit → Premium (%)
- Retention D7, D30, D90

### Analytics infra

- Coûts serveurs/mois
- Coûts API routing/mois (TomTom)
- Latency P95 recherche
- Error rate backend
- Uptime API

---

## 10) Questions ouvertes (à valider)

### Produit

- [ ] **Pricing Premium** : 9,90€ optimal ou tester 7,90€ / 12,90€ ?
- [ ] **Critères prioritaires post-MVP** : Proximité mer vs Nuisances vs Transport ?
- [ ] **Mobile app native** : Nécessaire ou PWA suffit ?
- [ ] **Stratégie données locatives (loyers)** : OLL Montpellier suffit ou besoin source nationale ?

### Business

- [ ] **Stratégie B2B** : Lancer API entreprises dès M12 ou attendre M18 ?
- [ ] **Partenariats agences** : Affiliation ou white-label ?
- [ ] **Levée de fonds** : Bootstrap pur ou amorçage 100k€ M12 pour scaling ?

### Tech

- [ ] **Migration OSRM self-hosted** : À quel seuil coûts TomTom (50€/mois ? 100€/mois) ?
- [ ] **Infrastructure scaling** : Quand migrer Railway → AWS/GCP ?

---

## Conclusion

**Vision validée par ce document** :
- ✅ Mission claire : CRM personnel recherche logement
- ✅ Personas définis : Camille (location), Marc & Julie (achat)
- ✅ Modèle économique : Freemium → Premium 9,90€/mois
- ✅ Objectifs rentabilité : Break-even M9, 7k€/mois profit Année 2
- ✅ Métriques succès : 60% adoption recherche guidée, 5% conversion Premium

**Prochaines étapes** :
1. **Valider ce document avec équipe/stakeholders**
2. Intégrer décisions finales (pricing, critères post-MVP)
3. Créer dashboard analytics (Mixpanel, Amplitude)
4. Définir plan marketing détaillé (SEO, content)

---

**Statut** : 🟡 **DRAFT — REQUIERT VALIDATION ÉQUIPE PRODUIT**
