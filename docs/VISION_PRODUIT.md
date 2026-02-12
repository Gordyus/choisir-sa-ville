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

### Modèle économique : **Gratuit Location + Premium Achat + Lead Generation B2B**

**Principe clé** : 
- **Location = 100% gratuit** → acquisition trafic, bouche à oreille, leads B2B
- **Achat = Premium payant** → monétisation directe utilisateurs
- **B2B = Lead generation** → commission professionnels (courtiers, agents, déménagement)

---

#### Tier Location (100% GRATUIT)

**Cible** : Acquisition massive, bouche à oreille, génération leads B2B

**Features incluses** :
- ✅ Recherche multi-critères **illimitée** (4 critères MVP)
- ✅ Temps de trajet **jusqu'à 3 destinations** (travail maman + papa + école)
- ✅ Scoring communes (0-100)
- ✅ Détails communes (métriques sécurité, loyers médians, densité)
- ✅ Affichage carte + table résultats
- ✅ **DVF France entière** (transactions immobilières historiques)
- ✅ **Sauvegarde recherches** :
  - Sans compte : localStorage navigateur (temporaire)
  - Avec compte gratuit : sauvegarde serveur (persistant)

**Pourquoi gratuit** :
- Locataires = forte rotation (recherche tous les 2-3 ans)
- Volume élevé → trafic → SEO → notoriété
- Leads qualifiés vers professionnels (courtiers crédit, déménageurs)
- Conversion bouche à oreille ("ma copine a trouvé son appart avec cette app")

**Monétisation indirecte** :
- Affiliation déménagement (Movinga, Aménagéon) : 20-50€/lead
- Affiliation assurance habitation (Luko, Unkle) : 30-80€/conversion
- ~~Liens sponsorisés annonces~~ (pas d'annonces immobilières sur la plateforme)
- **Vente leads** sur plateformes B2B (voir section Plateformes)

**Limites** :
- ❌ Pas d'alertes email (pas d'annonces immobilières sur le site, données statiques)
- ❌ Max 3 destinations (suffisant pour 95% cas d'usage)

**Objectif** :
- Volume locataires : **70% du trafic total**
- Retention D30 : **> 40%**
- Leads B2B/mois : **> 50** (M12)

---

#### Tier Achat Premium (post-MVP, T+6 mois)

**Prix à tester** : 
- **Option A (accessible)** : **24,90€ one-shot** → "24,90€ pour sécuriser 300 000€"
- **Option B (premium)** : **249€ one-shot** → "249€ pour une expertise complète"
- **Option C (récurrent)** : **14,90€/mois** (si recherche >2 mois)

**Décision MVP** : **Tester willingness to pay** avant de fixer prix définitif
- Afficher rapport détaillé complet en aperçu (blurred ou sample)
- Bouton "Accéder au rapport complet" → formulaire "Combien seriez-vous prêt à payer pour ce service ?"
- Analyser distribution réponses → pricing data-driven

**Cible** : **Acheteurs résidence principale/secondaire uniquement**

**Features Premium (rapport détaillé acquisition)** :

### Rapport MVP (M7-9) : **4 sections core** (~5-8 pages PDF)

**Contenu réaliste phase 1** :
1. ✅ **Analyse prix marché** (DVF adresse + 500m rayon, 2 dernières années)
   - Prix médian commune vs voisinage immédiat
   - Comparaison prix/m² bien analysé vs transactions similaires
   - Graphique évolution prix secteur
   
2. ✅ **Score opportunité** (sous-évalué / conforme / sur-évalué en %)
   - Calcul écart prix demandé vs médiane voisinage
   - Recommandation négociation chiffrée ("Négocier -15 000€")
   
3. ✅ **Points de vigilance basiques** (nuisances détectables)
   - Distance aéroport, gare, voie ferrée (OSM)
   - Zones industrielles 1km (ICPE base publique)
   - Affichage carte nuisances
   
4. ✅ **Temps trajet exacts** (adresse GPS précise)
   - Calcul routing adresse exacte (pas centroid commune)
   - Comparaison temps trajet commune vs adresse réelle

**Justification valeur** :
- Même 4 sections = **évite 1 erreur 10-20k€** facilement
- Effort utilisateur épargné : 5-10h recherche DVF + calculs manuels
- Pricing 24,90€ = **ROI 400-800x**, 249€ = **ROI 40-80x**

---

### Rapport Idéal (post-MVP, M12+) : **9 sections complètes** (~15-20 pages PDF)

**Sections additionnelles futures** :
5. ⏱️ **Analyse PLU avancée** (zonage, constructibilité, projets ZAC)
   - Requiert scraping/API urbanisme collectivités (complexe)
   
6. ⏱️ **Analyse cadastrale** (parcelle, bornage, servitudes)
   - Requiert API cadastre.gouv.fr + parsing PDF
   
7. ⏱️ **Historique transactions voisinage détaillé** (20 ventes similaires)
   - Déjà partiellement inclus section 1, mais version enrichie
   
8. ⏱️ **Évolution prix 5 ans** (tendances marché)
   - Requiert DVF historique étendu + ML prédictions
   
9. ⏱️ **Checklist validation achat** (50 points à vérifier visite)
   - Contenu éditorial à créer (travaux, diagnostics, copro, etc.)

**Effort développement sections 5-9** : +4-6 semaines (APIs complexes, scraping, contenu)

---

**Note MVP** : Toutes les features de recherche (multi-critères, scoring communes, DVF France) restent **100% gratuites** pour location ET achat. Seul le **rapport détaillé adresse** est Premium.

**Valeur ajoutée clé** :
- **Option A (24,90€)** : "24,90€ pour sécuriser 300 000€" = **ROI 12 000x si évite erreur**
  - Psychologie : prix d'une pizza pour sécuriser investissement vie
  - Volume élevé (conversion >30% potentielle)
  - Revenus : volume × faible ticket
  
- **Option B (249€)** : "249€ pour une expertise complète" = **ROI 1 200x**
  - Équivalent 1-2h consultant immobilier (300-500€/h)
  - Positionnement premium/expertise
  - Revenus : marge × faible volume

**Trade-off pricing (à étudier avec données réelles)** :

| Métrique | 24,90€ | 49,90€ | 99€ | 249€ |
|----------|--------|--------|-----|------|
| **Conversion estimée** | 30% | 20% | 12% | 8% |
| **Revenus/100 acheteurs** | 747€ | 998€ | 1 188€ | 1 992€ |
| **Perception valeur** | Accessible | Raisonnable | Premium | Expertise |
| **Risque** | Sous-valorisation | Équilibré | Friction moyenne | Friction forte |
| **CAC max rentable** | <10€ | <20€ | <40€ | <80€ |
| **Justification 4 sections** | ✅ OK | ✅ OK | ⚠️ Limite | ❌ Insuffisant |
| **Justification 9 sections** | ❌ Trop bas | ⚠️ Limite | ✅ OK | ✅ OK |

**Hypothèse initiale** : "Volume difficile en immobilier" (marché niche, achat ponctuel)
→ Pricing moyen/élevé (49-99€) probablement plus réaliste que volume bas prix (24,90€)

**Décision pricing** : **Tester willingness to pay APRÈS avoir rapport qualitatif validé**
1. **M7-8** : Développer rapport MVP 4 sections
2. **M8** : Tester avec 10-20 acheteurs beta (gratuit, feedback qualitatif)
3. **M9** : Si rapport validé (NPS >60) → Lancer formulaire willingness to pay
   - Afficher aperçu rapport réel (pas blurred, vrai exemple)
   - Formulaire : "Combien paieriez-vous pour ce rapport ?"
   - Options : 9,90€ / 24,90€ / 49,90€ / 99€ / 249€ / Autre
4. **M10** : Analyser distribution + lancer pricing data-driven
   - Si médiane 30-50€ → **49,90€** (équilibre volume/marge)
   - Si médiane >80€ → **99€** (premium assumé)
   - Si médiane <30€ → **24,90€** ou revoir qualité rapport

**Objectif conversion (hypothèses conservatrices)** :
- **Taux conversion acheteurs → Premium** : **> 15%** (pricing moyen 50-100€)
- **CAC (coût acquisition client)** : < 30€ (SEO organique + locataires → acheteurs)
- **LTV one-shot** : 50-100€ (selon pricing final data-driven)
- **Ratio LTV/CAC** : > 2-3 minimum (acceptable bootstrap)

**Note** : Chiffres à ajuster après test willingness to pay M9-10

---

#### Tier B2B Lead Generation (post-MVP, T+9 mois)

**Cible** : Professionnels immobiliers, courtiers crédit, déménageurs

**Modèle mixte** : 
- **Commission par lead qualifié** (intégration directe)
- **Vente leads sur plateformes B2B** (agrégateurs)

---

### A) Intégration directe partenaires

**Partenaires cibles** :

1. **Courtiers crédit immobilier** (Meilleurtaux, Pretto, Empruntis)
   - Lead acheteur qualifié (budget validé, recherche active)
   - Commission : **50-150€/lead** (si crédit signé : 200-400€)
   - Volume potentiel : 20-50 leads/mois (M12)

2. **Agents immobiliers / Agences**
   - Lead acheteur chaud (commune ciblée, budget, timing)
   - Commission : **30-80€/lead** ou **1% commission vente** si closing
   - Volume potentiel : 30-100 leads/mois (M12)

3. **Agences de déménagement** (Movinga, Demeco, Aménagéon)
   - Lead locataire + acheteur (date déménagement confirmée)
   - Commission : **20-50€/lead**
   - Volume potentiel : 50-200 leads/mois (M12)

4. **Assurances habitation** (Luko, Unkle, Allianz)
   - Lead locataire nouveau logement
   - Commission : **30-80€/conversion**
   - Volume potentiel : 40-150 conversions/mois (M12)

---

### B) Plateformes vente de leads immobiliers

**Plateformes françaises** :

1. **Drimki** (ex-Eldorado Immobilier)
   - https://www.drimki.fr
   - Leader français vente leads immo exclusifs
   - Prix moyen lead acheteur : 15-40€
   - Qualité : moyenne/bonne (scoring lead)

2. **Leads.fr**
   - https://www.leads.fr/immobilier
   - Multi-secteurs dont immobilier
   - Prix moyen lead : 10-30€
   - Modèle enchères temps réel

3. **Immobilier.com** (réseau SeLoger)
   - Programme partenaires
   - Leads acheteurs/locataires exclusifs
   - Prix moyen : 20-50€/lead

4. **Logic-Immo** (programme leads agents)
   - Leads acheteurs qualifiés
   - Prix moyen : 15-35€/lead

5. **Acheter-Louer.fr**
   - Plateforme leads professionnels
   - Prix moyen : 12-25€/lead

**Plateformes crédit** :

6. **Drimki Crédit** (dédié courtiers)
   - Leads emprunteurs immobiliers
   - Prix moyen : 30-80€/lead

7. **LeadMedia** (crédit + assurance)
   - https://www.leadmedia.fr
   - Leads crédit immo + assurance
   - Prix moyen : 25-60€/lead

**Plateformes déménagement** :

8. **Hellocasa** (leads services maison)
   - Déménagement, assurance, énergie
   - Prix moyen : 8-20€/lead

**Modèle de revenus plateformes** :
- Vendre leads non-exclusifs (moins cher, volume élevé)
- Commission plateforme : 20-40% du prix lead
- **Revenus estimés** : 500-1 500€/mois (M12) avec 100-200 leads/mois vendus

**Intégration produit** :
- Bouton "Besoin d'un crédit ?" dans parcours achat → formulaire → lead courtier
- Bouton "Trouver un agent local" dans détail commune → lead agence
- Popup "Organiser votre déménagement" après sélection adresse → lead déménageur
- Banner "Assurer votre logement" dans résultats location → lead assurance

**Transparence utilisateur** :
- Mentions légales claires : "Nous touchons commission si vous contactez partenaire"
- Jamais de spam : 1 suggestion max par parcours
- Utilisateur garde contrôle : "Non merci" facile

**Valeur apportée aux professionnels** (en cours de réflexion) :
- ✅ Leads ultra-qualifiés (scoring, budget validé, timing confirmé)
- ✅ Géolocalisation précise (commune/département ciblé)
- ✅ Données enrichies (critères recherche, score communes)
- ❓ Tableau de bord leads temps réel (à définir)
- ❓ API intégration CRM pro (Salesforce, HubSpot) (à définir)
- ❓ White-label widget recherche (intégration site agence) (à définir)

**Objectif revenus B2B combinés** :
- M12 : 2 500-4 000€/mois
  - Intégration directe : 1 500-2 500€ (50 leads × 30-50€)
  - Plateformes : 1 000-1 500€ (100 leads × 10-15€)
- M24 : 8 000-15 000€/mois
  - Intégration directe : 6 000-10 000€ (150 leads × 40-70€)
  - Plateformes : 2 000-5 000€ (200 leads × 10-25€)

---

## 4) Objectifs de rentabilité

### Horizon MVP (Mois 0-6)

**Objectif** : **Validation produit, 0 rentabilité attendue**

**KPI** :
- **MAU (utilisateurs actifs/mois)** : > 500 (M6)
  - Locataires : ~350 (70%)
  - Acheteurs : ~150 (30%)
- **Taux conversion recherche → annonce externe** : > 40%
- **NPS (Net Promoter Score)** : > 50
- **Coûts infra** : < 15€/mois

**Revenus** : **0€** (pas encore de Premium ni B2B)  
**Coûts** : ~100€/mois (dev time bénévole, infra minime)  
**Burn** : -100€/mois (acceptable phase validation)

**Validation hypothèse** : Location gratuit génère trafic suffisant (70% users)

---

### Horizon Post-MVP (Mois 7-12)

**Objectif** : **Monétisation mixte (Premium Achat + B2B), break-even**

**Lancement Premium Achat** : M7  
**Lancement Lead Gen B2B** : M9

**KPI** :
- **MAU** : > 2 000
  - Locataires gratuit : ~1 400 (70%)
  - Acheteurs total : ~600 (30%)
  - Acheteurs Premium : ~90 (15% conversion acheteurs)
- **MRR Premium Achat** : > 1 350€ (90 users × 14,90€)
- **One-shot Premium** : > 2 000€/mois (8 users/mois × 249€)
- **Revenus B2B** : > 1 000€/mois (50 leads × 20€ moyen)
- **Churn rate Premium mensuel** : < 15%/mois (achat = court terme)
- **CAC** : < 30€
- **LTV Premium one-shot** : 249€
- **LTV Premium mensuel** : 90€ (6 mois)

**Revenus totaux M10-12** (après test pricing) : 
- Hypothèse conservatrice (49,90€, 15% conversion) : **4 500€/mois** Premium
- Hypothèse médiane (99€, 12% conversion) : **7 128€/mois** Premium
- Hypothèse optimiste (249€, 8% conversion) : **11 952€/mois** Premium

**Coûts** : 800€/mois (infra 200€ + marketing SEO 500€ + outils 100€)  

**Profit M10-12** : 
- Scénario conservateur : **+3 700€/mois**
- Scénario médiane : **+6 328€/mois**
- Scénario optimiste : **+11 152€/mois**

**Break-even** : M10 (dès lancement Premium, tous scénarios)

**Hypothèse clé** : Locataires gratuit = acquisition gratuite acheteurs futurs (20% locataires deviennent acheteurs dans 2 ans)

---

### Horizon Croissance (Année 2)

**Objectif** : **Scaling rentable, début recrutement**

**KPI** :
- **MAU** : > 15 000
  - Locataires gratuit : ~10 500 (70%)
  - Acheteurs total : ~4 500 (30%)
  - Acheteurs Premium : ~675 (15% conversion)
- **MRR Premium Achat** : > 10 000€ (675 users × 14,90€)
- **One-shot Premium** : > 15 000€/mois (60 users/mois × 249€)
- **Revenus B2B** : > 8 000€/mois (200 leads × 40€ moyen)
- **Équipe** : 2 personnes (dev + marketing/bizdev)

**Revenus totaux** : **33 000€/mois** (10k MRR + 15k one-shot + 8k B2B)  
**Coûts** : 15 000€/mois (salaires 10k + infra 2k + marketing 3k)  
**Profit** : **+18 000€/mois** (+216k€/an)

**Décision recrutement** : Si profit >15k€/mois stable 3 mois → embauche dev #2

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
| **MAU** | 500 | 15 000 | Analytics sessions |
| **MAU Locataires (gratuit)** | 350 (70%) | 10 500 (70%) | Analytics parcours |
| **MAU Acheteurs (total)** | 150 (30%) | 4 500 (30%) | Analytics parcours |
| **Retention D7** | 30% | 50% | Cohorte retour J+7 |
| **Retention D30** | 15% | 40% | Cohorte retour J+30 |
| **Conversion recherche → annonce** | 40% | 60% | Tracking clics liens externes |
| **NPS** | 50 | 70 | Survey post-recherche |
| **Temps moyen recherche** | <5 min | <3 min | Analytics événements |
| **Nb recherches/utilisateur/mois** | 3 | 8 | Analytics |
| **Taux conversion Acheteurs → Premium** | — | 15% | Stripe |
| **Churn Premium mensuel** | — | <15%/mois | Stripe (achat = court terme OK) |
| **Leads B2B/mois** | — | 200 | Tracking formulaires |
| **Taux conversion Lead → Client Pro** | — | 30% | Feedback partenaires |

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

### ✅ T0 (M0-6) : MVP Recherche (**TOUT GRATUIT** sauf rapport détaillé)

- Backend routing
- 4 critères (temps trajet, sécurité, prix, densité)
- 2 parcours : Location + Achat (fonctionnalités identiques gratuites)
- **Max 3 destinations** pour tous (location + achat)
- **Sauvegarde recherches** :
  - Sans compte : localStorage navigateur
  - Avec compte gratuit : sauvegarde serveur
- **DVF France entière** (pas que dept 34)
- ~~Aperçu rapport~~ (différé M7-8, développement rapport d'abord)
- ~~Willingness to pay~~ (différé M9, après validation qualité rapport)

**Validation** : 
- >60% adoption recherche guidée
- 70% trafic locataires
- NPS >50
- Base utilisateurs suffisante pour beta test rapport (>100 acheteurs actifs/mois)

---

### 🎯 T1 (M7-10) : Monétisation Premium Achat

**Phasage détaillé** :

**M7-8 : Développement rapport MVP**
- ✅ Rapport 4 sections core (5-8 pages PDF)
  - Analyse prix marché DVF 500m (2 ans)
  - Score opportunité + recommandation négociation
  - Points vigilance nuisances (**OSM uniquement** pour MVP, pas Géorisques)
  - Temps trajet adresse exacte
- ✅ Génération PDF automatique (**Puppeteer serveur**, template HTML → PDF)
  - Latency génération : 10-30s (acceptable one-shot)
  - Template HTML/CSS responsive (design fait maison)
  - Graphiques Chart.js → canvas → export PNG
- ✅ Page aperçu rapport (exemple réel commune test)

**M8 : Beta test qualitatif**
- ✅ Offrir rapport gratuit à 10-20 acheteurs beta
  - Recrutement : Reddit (r/vosfinances, r/france), TikTok, forums immo
  - Critères : recherche active achat <3 mois, motivation forte
  - Contrepartie : feedback détaillé 30 min (visio ou formulaire)
- ✅ Formulaire feedback détaillé (NPS, amélioration souhaitée)
- ✅ Valider qualité rapport (objectif NPS >60)
- ✅ Itération rapport V2 si besoin (design, contenu, clarté)

**M9 : Test willingness to pay**
- ✅ Afficher aperçu rapport réel validé (pas blurred)
- ✅ Formulaire pricing : "Combien paieriez-vous ?"
  - Options : 9,90€ / 24,90€ / 49,90€ / 99€ / 249€ / Autre
- ✅ Collecter 50-100 réponses
- ✅ Analyser distribution (médiane, P25, P75)

**M10 : Lancement Premium**
- ✅ **Pricing data-driven** (ex: si médiane 40-60€ → lancer 49,90€)
- ✅ Page paiement Stripe one-shot
- ✅ Génération + envoi rapport automatique
- ~~Alertes email~~ (hors scope : pas d'annonces sur le site)
- ~~CRM avancé~~ (différé post-MVP)

**Objectif revenus M10-12** (hypothèse conservatrice 49,90€, conversion 15%) : 
- 600 acheteurs/mois × 15% = 90 conversions/mois
- 90 × 49,90€ = **4 491€/mois**
- (À ajuster selon pricing final et conversion réelle)

---

### 💼 T2 (M10-12) : Lead Generation B2B

- Intégration courtiers crédit (Meilleurtaux, Pretto)
- Intégration agences immobilières (leads géolocalisés)
- Intégration déménageurs (Movinga)
- Intégration assurances (Luko)
- Boutons CTA contextuels parcours utilisateur
- Dashboard suivi leads partenaires

**Objectif** : 200 leads/mois, 8 000€/mois revenus B2B, 33k€/mois total

---

### 🚀 T3 (M13-18) : Scaling features

- Transport en commun (temps trajet transit)
- Responsive mobile optimisé (PWA)
- Analyse PLU avancée (projets ZAC, modification PLU)
- Évolution prix marché (tendances 5 ans)
- Loyers OLL (données locatives)
- Recommandations IA (communes similaires)

**Objectif** : 25 000 MAU, 50k€/mois revenus totaux

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

- [ ] **Pricing Premium** : ⚠️ **À DÉTERMINER après test willingness to pay M9**
  - Hypothèse réaliste : 49,90€ - 99€ (équilibre volume/marge)
  - Contrainte : "Volume difficile en immobilier" (marché niche)
  - Méthode : Beta test qualitatif M8 → Willingness to pay M9 → Lancement pricing data-driven M10
  - Options testées : 9,90€ / 24,90€ / 49,90€ / 99€ / 249€
- [x] **Mobile app native** : ✅ **PWA/Responsive d'abord, native plus tard si succès**
- [x] **Alertes email** : ✅ **Hors MVP** (pas d'annonces immobilières sur le site)
- [ ] **Contenu rapport V2** : Quelles sections 5-9 prioriser après MVP (PLU ? Cadastre ? Checklist ?) ?
- [ ] **Critères recherche post-MVP** : Proximité mer vs Nuisances vs Transport ?
- [ ] **Stratégie données locatives (loyers)** : OLL Montpellier suffit ou besoin source nationale ?
- [ ] **Format rapport** : PDF uniquement ou aussi page web interactive ?

### Business

- [x] **Stratégie B2B** : ✅ **Lead generation (courtiers, agents, déménagement) dès M9**
- [ ] **Valeur apportée aux professionnels B2B** : Dashboard leads temps réel ? API CRM ? White-label widget ?
- [ ] **Commission leads B2B** : Fixe (30-50€) ou variable (1% vente, 10% crédit) ?
- [ ] **Partenariats agences** : Affiliation leads ou white-label intégration ?
- [x] **Levée de fonds** : ✅ **Bootstrap pur (seul, pas de levée avant produit fonctionnel)**

### Tech

- [ ] **Migration OSRM self-hosted** : À quel seuil coûts TomTom (50€/mois ? 100€/mois) ?
- [ ] **Infrastructure scaling** : Quand migrer Railway → AWS/GCP ?
- [ ] **Authentification utilisateur** : Auth0 (payant) vs Supabase Auth (gratuit) vs custom ?
- [x] **Génération PDF rapport** : ✅ **Puppeteer serveur (template HTML → PDF)**
- [x] **Design rapport** : ✅ **Fait maison (pas de designer externe)**
- [x] **Données nuisances MVP** : ✅ **OSM uniquement** (Géorisques/ICPE différé post-MVP)
- [ ] **Fréquence génération rapport** : Temps réel (10-30s latency) ou pré-généré nuit (cache) ?
  - Temps réel = expérience utilisateur immédiate, mais serveur charge élevée
  - Pré-généré = rapide (<1s), mais nécessite catalogue adresses (impossible sans annonces)
  - **Recommandation** : Temps réel uniquement (one-shot payant, acceptable 20s wait)

---

## Conclusion

**Vision validée par ce document** :
- ✅ Mission claire : CRM personnel recherche logement
- ✅ Personas définis : Camille (location gratuit), Marc & Julie (achat Premium)
- ✅ Modèle économique : **Location 100% gratuit + Achat Premium 14,90€/mois ou 249€ + Lead Gen B2B**
- ✅ Objectifs rentabilité : Break-even M7, 18k€/mois profit Année 2
- ✅ Métriques succès : 60% adoption recherche guidée, 15% conversion acheteurs → Premium, 70% trafic locataires
- ✅ Bootstrap pur : Pas de levée fonds avant produit fonctionnel
- ✅ Mobile : PWA/Responsive d'abord, native plus tard

**Décisions clés prises (12 février 2026)** :
- Location = acquisition gratuite (trafic, bouche à oreille, leads B2B)
- Achat = monétisation Premium (validation opportunité = forte valeur ajoutée)
- B2B = lead generation professionnels (courtiers, agents, déménagement)
- One-shot 249€ capte mieux valeur achat ponctuel (vs churn mensuel)

**Questions ouvertes restantes** :
- Valeur apportée aux professionnels B2B (dashboard ? API ? white-label ?)
- Commission leads : fixe ou variable (% closing) ?
- Critères post-MVP : Proximité mer, nuisances, transport ?
- Sources loyers : OLL suffit ou besoin national ?

**Prochaines étapes** :
1. ~~Valider stratégie business (location gratuit vs achat payant)~~ ✅ **VALIDÉ**
2. Implémenter MVP Phase 1-3 (backend routing + métriques + recherche)
3. Créer dashboard analytics (Mixpanel, Amplitude)
4. Préparer page pricing Premium Achat (arguments one-shot vs mensuel)
5. Identifier partenaires B2B potentiels (courtiers, agences)

---

**Statut** : 🟢 **VALIDÉ PARTIELLEMENT** — Questions B2B en cours de réflexion
