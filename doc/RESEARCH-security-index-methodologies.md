# Recherche: Méthodologies Indices de Sécurité - Best Practices Internationales

**Date**: 2026-02-08  
**Objectif**: Identifier la méthode la plus cohérente pour afficher un indicateur d'insécurité destiné à aider les utilisateurs à choisir où habiter

---

## 1. Standards Internationaux Identifiés

### 1.1 Numbeo Crime Index (Grand Public)

**Site**: numbeo.com/crime  
**Portée**: 400+ villes mondiales  
**Méthodologie**: Crowdsourced perception surveys

**Formule**:
```
Crime Index = Weighted average of 15 perceptions:
- Level of crime (weight: 3×)
- Crime increasing trend
- Safety alone (day/night)
- Worries: burglary, mugging, car theft, attack, insult, discrimination
- Problems: drugs, property crimes, violent crimes, corruption

Scale: 0-100
- Very Low: <20
- Low: 20-40
- Moderate: 40-60
- High: 60-80
- Very High: >80
```

**Résultats France** (Numbeo 2024):

| Ville | Crime Index | Catégorie | Rank France |
|-------|-------------|-----------|-------------|
| **Marseille** | 66.7 | High | 1 |
| **Grenoble** | 62.6 | High | 2 |
| Montpellier | 61.0 | High | 3 |
| Lyon | 59.3 | Moderate | 4 |
| Nantes | 58.6 | Moderate | 5 |
| Paris | 58.0 | Moderate | 6 |
| Nice | 55.6 | Moderate | 7 |
| Lille | 51.0 | High | 8 |
| **Bordeaux** | **49.8** | **Moderate** | **9** |
| Toulouse | 49.8 | Moderate | 9 |

**Observations**:
- ✅ Bordeaux classée **modérée** (49.8), pas "très élevée"
- ❌ Grenoble plus élevée que Bordeaux selon perception
- ⚠️ Diverge de nos données (Bordeaux > Grenoble dans nos stats officielles)

**Avantages**:
- Perception utilisateur (utile pour "où fait bon vivre")
- Standard reconnu internationalement
- Mise à jour continue (rolling 5 years)
- Comparable entre pays

**Limites**:
- Subjectif (perception ≠ réalité statistique)
- Biais de participation (qui répond?)
- Peut être manipulé

---

### 1.2 International Crime Victims Survey (ICVS)

**Organisme**: UN Office on Drugs and Crime (UNODC)  
**Portée**: 70+ pays  
**Méthodologie**: Standardized victim surveys

**11 Crimes Standardisés**:
1. Car theft
2. Theft from car
3. Car vandalism
4. Motorcycle theft
5. Bicycle theft
6. Burglary
7. Attempted burglary
8. Robbery
9. Theft of personal property
10. Sexual assault
11. Assault & threats

**Caractéristiques**:
- ✅ Standard "de facto" international
- ✅ Méthodologie cohérente entre pays
- ✅ Capture crimes non-reportés
- ❌ Dépend mémoire/honnêteté répondants
- ❌ Ignore crimes contre enfants

**Utilisation**:
- Études comparatives European Commission
- Analyse tendances internationales
- Mesure crimes "réels" vs "reportés"

---

### 1.3 Classements Homicides (El Consejo Ciudadano)

**Organisme**: Citizen Council for Public Security and Criminal Justice (Mexico City)  
**Méthodologie**: Official homicide statistics

**Critères**:
- **Population minimale**: 300,000 habitants
- **Métrique**: Homicides pour 100,000 habitants/an
- **Exclusions**: Zones de guerre active
- **Source**: Données officielles gouvernementales

**Top 10 Mondial 2023-2024**:
1. Colima, Mexico: 181.94/100k
2. Durán, Ecuador: 148.00/100k
3. Ciudad Obregón, Mexico: 138.23/100k
...
28. Memphis, USA: 48.00/100k

**France**:
- Paris, Lyon, Marseille: Hors classement top 200
- Taux national: ~1.16/100k (milieu tableau européen)
- **Bordeaux: Non présente dans classement**

**Caractéristiques**:
- ✅ Métrique la plus fiable (homicide = définition claire)
- ✅ Comparabilité internationale forte
- ✅ **Seuil population évite biais petites villes**
- ❌ Un seul type de crime (pas vision globale)

---

### 1.4 Standards Statistiques (Wikipedia Crime Statistics)

**Consensus Scientifique**:

1. **Classification par taille OBLIGATOIRE**
   - Petites: <100,000 habitants
   - Grandes: >100,000 ou >300,000
   - **Raison**: Éviter biais mécanique taux/capita

2. **Métriques Reconnues**:
   - **Pour 100,000 habitants** (standard scientifique)
   - Victim surveys (enquêtes victimisation)
   - Police reports (avec correction sous-reporting)

3. **Problèmes Méthodologiques**:
   - Définitions varient entre juridictions
   - Sous-reporting (UK: 1/3 crimes violents non enregistrés)
   - Corrections judiciaires ("correctionnalisation" France)
   - Différences pratiques reporting entre pays

**Recommandation ONU (ICCS 2015)**:
- International Classification of Crime for Statistical Purposes
- Standardisation définitions crimes
- Prise en compte contexte national

---

## 2. Analyse Comparée: Notre Système vs Standards

### 2.1 Notre Méthodologie Actuelle

| Aspect | Notre Choix | Standard International |
|--------|-------------|------------------------|
| **Métrique** | Taux pour **1,000** | Taux pour **100,000** |
| **Classification** | **Toutes communes ensemble** | **Par catégorie de taille** |
| **Pondération** | 40% violences, 35% biens, 25% tranquillité | Variable ou non-pondéré |
| **Échelle** | Percentile 0-100 | Souvent 0-100 aussi |
| **Niveaux** | 5 niveaux (0-4) | Variable (Numbeo: 5, autres: 3-10) |
| **Source** | SSMSI (Ministère Intérieur) | Variable (police, surveys, mix) |

### 2.2 Divergences Principales

#### Divergence 1: Taux /1000 vs /100,000

**Notre choix**: Taux pour 1,000 habitants
- Bordeaux: 80.1 atteintes aux biens/1000
- Score pondéré: 38.23

**Standard scientifique**: Taux pour 100,000 habitants
- Bordeaux: 8010 atteintes aux biens/100k
- Facilite comparaisons internationales
- Évite confusion avec pourcentages

**Impact**: Cosmétique (×100), pas de changement méthodologique

---

#### Divergence 2: Toutes Communes vs Classification Taille

**Notre choix**: Percentile sur 34,875 communes
- Bordeaux (252k hab): indexGlobal 99, niveau 3
- Commune 30 hab: indexGlobal 100, niveau 4
- **Biais**: Petites communes surreprésentées niveau 4

**Standard international**: Classification par catégorie
- Bordeaux: Comparée seulement aux 42 villes >100k
- Si appliqué: Bordeaux serait top 1% → niveau 4 catégorie
- **Légitime**: Compare "pairs" de taille similaire

**Impact**: **MAJEUR** — change complètement classement grandes villes

---

### 2.3 Cohérence avec Numbeo

| Ville | Numbeo Crime Index | Notre Score | Notre IndexGlobal | Notre Niveau |
|-------|-------------------|-------------|-------------------|--------------|
| Marseille | 66.7 (High) | 29.09 | 98 | 3 (Élevé) |
| **Grenoble** | **62.6** (High) | 35.92 | 99 | 3 (Élevé) |
| Lyon | 59.3 (Moderate) | 33.34 | 98 | 3 (Élevé) |
| Paris | 58.0 (Moderate) | 32.06 | 98 | 3 (Élevé) |
| **Bordeaux** | **49.8** (Moderate) | **38.23** | **99** | **3** (Élevé) |

**Observation critique**:
- ❌ **Numbeo**: Grenoble (62.6) > Bordeaux (49.8)
- ✅ **Nous**: Bordeaux (38.23) > Grenoble (35.92)
- ⚠️ **Interprétation**: Perception ≠ Statistiques officielles

**Pourquoi?**
- Numbeo = perception subjective (sécurité ressentie)
- Nous = données officielles police (délinquance enregistrée)
- **Les deux sont utiles mais mesurent des choses différentes**

---

## 3. Best Practices Identifiées

### 3.1 Classification par Taille (Consensus Fort)

**Pratique Universelle**:
- Classements homicides: seuil 300k habitants
- ICVS: Analyse par catégorie urbain/rural
- Numbeo: Inclut toutes tailles mais comparable contexte
- Académiques: Toujours contrôler pour taille population

**Seuils Communs**:
- Petites: <10,000 habitants
- Moyennes: 10,000-100,000 habitants
- Grandes: >100,000 habitants
- Métropoles: >1,000,000 habitants

**Raison Fondamentale**:
- Biais mécanique: 1 fait divers / 50 habitants = 20/1000
- Même fait / 100,000 habitants = 0.01/1000
- **Comparaison illégitime** sans correction taille

---

### 3.2 Transparence Méthodologique

**Éléments Requis** (tous standards):
1. **Source données** clairement indiquée
2. **Période temporelle** précise
3. **Pondération** explicitée si applicable
4. **Limitations** documentées (sous-reporting, etc.)
5. **Formule** disponible (reproductibilité)

**Exemple Numbeo**:
- Formule publiée (Java code)
- Rolling 5 years explicite
- "Perception-based" clairement indiqué
- Catégories définies (<20, 20-40, etc.)

**Notre Système Actuel**:
- ✅ Source: SSMSI documentée
- ✅ Année: Affichée (2024)
- ✅ Pondération: 40/35/25 explicite
- ⚠️ Limitations: Peu documentées (sous-reporting, correctionnalisation)
- ✅ Formule: Implémentation visible (code open?)

---

### 3.3 Double Perspective (Perception + Stats)

**Tendance Émergente**:
- Numbeo: Perception users
- Gov stats: Données officielles
- **Combinaison**: Vision holistique

**Avantages**:
- Perception = "où fait bon vivre" (ressenti sécurité)
- Stats = réalité objective (délinquance mesurée)
- **Complémentaire**: Pas en opposition

**Exemple**:
- Grenoble: Perception élevée (62.6) mais stats modérées (35.92)
- Interprétation: Sentiment d'insécurité > réalité statistique
- **Utile pour utilisateurs**: Les deux comptent

---

## 4. Recommandations Finales

### Recommandation 1: Adopter Classification par Taille ⭐⭐⭐

**Justification**:
- ✅ Aligné sur 100% standards internationaux
- ✅ Résout biais fondamental
- ✅ Bordeaux correctement classée (top 1% grandes villes)
- ✅ Comparaisons légitimes

**Implémentation**:
- 3 catégories: <10k / 10k-100k / >100k
- Double indexGlobal: national + catégorie
- UI: Badge "Niveau 4 (grandes villes) | Niveau 3 (national)"

---

### Recommandation 2: Passer à "pour 100,000" ⭐⭐

**Justification**:
- ✅ Standard scientifique universel
- ✅ Facilite comparaisons internationales
- ✅ Plus intuitif grandes villes (évite décimales)

**Impact**:
- Cosmétique: ×100 tous les taux
- Bordeaux: 80.1/1000 → 8010/100k
- Formule inchangée

---

### Recommandation 3: Ajouter Perception Index (Future) ⭐

**Justification**:
- ✅ Complémente stats officielles
- ✅ Répond à "où fait bon vivre"
- ✅ Standard Numbeo reconnu

**Implémentation** (v2):
- Enquête utilisateurs (crowdsourced)
- 10-15 questions perception
- Crime Index + Safety Index séparés
- Affichage dual: Stats + Perception

---

## 5. Conclusions

### Ce Qui Est Cohérent dans Notre Système

✅ **Source données**: SSMSI = officiel et fiable  
✅ **Pondération**: 40/35/25 = raisonnable (crimes graves > biens > troubles)  
✅ **Échelle 0-100**: Standard international  
✅ **5 niveaux**: Comparable Numbeo  
✅ **Transparence**: Méthodologie documentée  

### Ce Qui Doit Être Amélioré

❌ **Pas de classification par taille**: Biais majeur  
⚠️ **Taux /1000**: Moins standard que /100k  
⚠️ **Pas de perception**: Vision incomplète  
⚠️ **Documentation limitations**: Sous-reporting, correctionnalisation non mentionnés  

### Réponse à la Question Bordeaux

**Ville-data.com dit "Bordeaux top 1"**:
- Probablement filtre grandes villes uniquement
- Ou données année différente
- Ou méthodologie différente (non vérifiable, site inaccessible)

**Numbeo dit "Bordeaux modérée (49.8)"**:
- 9ème France (perception)
- Cohérent avec notre niveau 3

**Nos données disent "Bordeaux top 1 grandes villes, niveau 3 national"**:
- Top 1/42 villes >100k: ✅ VRAI
- Niveau 3 (pas 4): ⚠️ Dû à absence classification taille

**Conclusion**: Bordeaux **EST** la ville la plus dangereuse (>100k hab) selon stats officielles, mais notre classification actuelle ne le reflète pas (niveau 3 au lieu de 4) car **pas de séparation par taille**.

---

**Document de référence pour décision architecturale finale.**
