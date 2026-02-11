# Roadmap : Métrique Loyer (Post-MVP)

**Feature** : `real-estate-multiscale-indicators`  
**Date** : 11 février 2026  
**Statut** : Backlog priorité haute  
**Validation sources** : 11 février 2026 (CLAMEUR 2025 retenu)

---

## Contexte

La métrique loyer (commune + hexagones) a été **retirée du scope MVP** pour les raisons suivantes :
1. Loyers hexagonaux estimés = risque juridique sans validation empirique préalable
2. Nécessité de clarifier la stratégie source données (loyers réels vs annonces)
3. MVP concentré sur **vente uniquement** (DVF observé) pour garantir qualité

**Mise à jour 11 février 2026** : Recherche sources loyers complétée. **CLAMEUR 2025 retenu comme source prioritaire** (granularité commune, couverture 100% France).

---

## Objectif post-MVP

Ajouter la métrique loyer au mode `realEstate` avec un sélecteur `Vente | Loyer` :
- **Loyer commune** : Baseline CLAMEUR (loyers d'annonce, disclaimer obligatoire)
- **Loyer hexagones** : Loyer commune la plus proche (pas de formule proxy — approche simple et traçable)

---

## Pré-requis obligatoires

### 1. Source loyers — Décision finale

**Source retenue : CLAMEUR 2025** (loyers d'annonce commune-level) — **PRIORITAIRE**

**URL** : https://www.data.gouv.fr/fr/datasets/carte-des-loyers-indicateurs-de-loyers-dannonce-par-commune-en-2025/  
**Format** : CSV délimiteur `;` (4 fichiers : appart tous, 1-2P, 3P+, maisons)  
**Licence** : Non spécifiée (données Ministère Transition écologique)  
**Mise à jour** : Annuelle (dernière : décembre 2025)

**Avantages** :
- ✅ **Granularité commune** (code INSEE direct → mapping trivial)
- ✅ **Couverture 100% France** (34 900 communes métropole + DOM-TOM)
- ✅ Segmentation type logement (appart 1-2P, 3P+, maisons)
- ✅ Simplicité implémentation (1 jointure INSEE_C)
- ✅ Usage hexagones H3 possible (hex centroid → commune nearest → loyer)

**Limitations** :
- ❌ Loyers d'**annonce** (biais structurel +10-15% vs loyers réels conclus)
- ⚠️ Qualité hétérogène : 14% communes données directes (4 871 communes, nbobs_com > 0), 86% proxy maille (30 029 communes, estimation modèle spatial)
- ⚠️ Intervalle confiance large (±20-30% selon commune)

**Colonnes clés CSV** :
- `INSEE_C` : Code INSEE commune (5 digits)
- `loypredm2` : Loyer prédit €/m²
- `TYPPRED` : Type prédiction (`"commune"` = direct, `"maille"` = proxy spatial)
- `nbobs_com` : Nb observations annonces commune (0 si proxy maille)
- `lwr.IPm2`, `upr.IPm2` : Intervalle confiance 95%

**Conditions d'acceptation UI** (obligatoires) :
1. ✅ **Disclaimer explicite** : *"Loyers basés sur annonces locatives. Ils peuvent différer des loyers réellement conclus (+10-15% en moyenne). Source : Ministère Transition écologique 2025."*
2. ✅ **Badge "Loyer d'annonce"** (icône 📋, tooltip explicatif)
3. ✅ **Différenciation visuelle qualité** :
   - Communes TYPPRED=commune (données directes) → Opacité 100%
   - Communes TYPPRED=maille (proxy spatial) → Opacité 60% (moins fiable)
4. ✅ **Tooltip observations** : "Basé sur [N] annonces" (si commune) OU "Estimation zone voisine" (si maille)

---

**Source complémentaire : OLL (Observatoires Locaux des Loyers)** — **OPTIONNEL**

**URL** : https://www.data.gouv.fr/fr/datasets/resultats-nationaux-des-observatoires-locaux-des-loyers/  
**Format** : CSV délimiteur `;` (données agglomération uniquement)  
**Statut** : Complément pour validation qualité grandes agglomérations

**Avantages** :
- ✅ Loyers **réels observés** (pas annonces, pas de biais)
- ✅ Méthodologie rigoureuse (réseau 37 observatoires locaux)
- ✅ Segmentation fine (type logement, ancienneté, époque construction)

**Limitations** :
- ❌ **Granularité agglomération** (pas commune individuelle → mapping spatial complexe)
- ❌ Couverture partielle (37 agglomérations = 52% parc locatif français, ~3000 communes)

**Usage recommandé** :
- Affichage comparatif UI (tooltip) : "Loyer annonce commune : X €/m² | Loyer réel agglomération : Y €/m²" (si commune dans périmètre OLL)
- Vérification qualité CLAMEUR sur échantillon grandes villes
- **Ne PAS utiliser comme source primaire** (granularité bloquante)

**Implémentation** : Post-MVP+1 (nice-to-have, pas critique)

---

### 2. Loyers hexagonaux — Stratégie simplifiée (pas de formule proxy)

**Décision** : Les loyers hexagonaux utilisent la **valeur commune la plus proche** (pas de formule d'estimation complexe).

**Rationnel** :
- ✅ Traçable et transparent (hex → commune nearest → loyer CLAMEUR)
- ✅ Pas de risque juridique formule proxy non validée
- ✅ Cohérent avec approche DVF vente (hex → agrégation transactions zone)
- ⚠️ Approximation assumée : intra-city variation ignorée (disclaimer obligatoire)

**Méthode** :
```
1. Pour chaque hexagone H3 niveau 8 :
   - Calculer centroid hexagone
   - Reverse geocoding → code INSEE commune la plus proche
   - Loyer hexagone = loyer commune CLAMEUR (loypredm2)

2. Métadonnées :
   - Champ `sourceCommune` : code INSEE commune source
   - Champ `predictionType` : "commune" ou "maille" (qualité CLAMEUR)
```

**Conditions UI** :
- ✅ Tooltip hexagone : "Loyer estimé : X €/m² (valeur commune [NomCommune])"
- ✅ Différenciation visuelle si TYPPRED=maille (opacité 60%)
- ✅ Disclaimer : "Loyer uniforme par commune, variation intra-communale non prise en compte"

**Alternative future (Post-MVP+2)** : Si demande utilisateurs forte pour granularité intra-city, investiguer formule proxy validée empiriquement (voir section 2.bis ci-dessous).

---

### 2.bis Formule proxy avancée (Post-MVP+2 optionnel)

**Si besoin de granularité intra-city validée**, investiguer formule :
```
rentHex = rentBaselineCommune * (saleHex / saleCommune)^alpha
```

**Pré-requis OBLIGATOIRES avant implémentation** :

#### 2.bis.1 Validation empirique sur échantillon réel

- Sélectionner 100+ communes avec loyers réels observés OLL par zone
- Calculer `rentHex` estimé via formule
- Comparer avec loyers réels OLL zonaux
- Mesurer **erreur absolue moyenne** et **RMSE**

**Critère d'acceptation** : Erreur moyenne < 20% sur l'échantillon.

#### 2.bis.2 Calibration `alpha`

- Tester plusieurs valeurs `alpha` (0.4, 0.5, 0.6, 0.7, 0.8)
- Optimiser `alpha` pour minimiser RMSE
- Documenter `alpha` calibré dans `meta.json`

#### 2.bis.3 Disclaimer juridique renforcé

- Rédaction disclaimer par juriste
- Modale première utilisation mode loyer
- Lien méthodologie détaillée

**Recommandation** : **Ne PAS implémenter formule proxy dans post-MVP immédiat** (complexité vs valeur ajoutée faible, risque juridique).
---

### 3. Différenciation visuelle qualité données

**Problème** : CLAMEUR fournit 2 types de données (directes vs proxy maille) à différencier visuellement.

**Solution** :
- **Communes données directes** (TYPPRED=commune, nbobs_com > 0) : Opacité 100%, couleur standard
- **Communes proxy maille** (TYPPRED=maille, nbobs_com = 0) : Opacité 60%, badge "Estimé zone voisine"
- **Hexagones** : Opacité selon commune source (100% si direct, 60% si maille)

**Palette couleur loyers** :
- Verte (ex: light `#68C993` → dark `#39AA70`) pour différenciation vs vente (bleue)
- Cohérent avec convention "vert = loyer, bleu = vente"

**Tooltips** :
- Commune directe : *"Loyer annonce : 12 €/m² (basé sur 356 annonces)"*
- Commune maille : *"Loyer estimé : 10 €/m² (estimation zone voisine)"*
- Hexagone : *"Loyer : 15 €/m² (valeur commune [NomCommune])"*

---

## Implémentation technique

### Étapes pipeline (build-time)

**Ajout à `packages/importer/src/exports/rents/exportRents.ts`** (nouveau module) :

1. **Import source CLAMEUR** :
   - URL : `https://static.data.gouv.fr/resources/.../pred-app-mef-dhup.csv`
   - Parser colonnes : `INSEE_C`, `loypredm2`, `TYPPRED`, `nbobs_com`, `lwr.IPm2`, `upr.IPm2`
   - Cache TTL 365 jours (mise à jour annuelle)

2. **Agrégats communaux loyer** :
   - Stocker dans `data/vYYYY-MM-DD/rents/communes.json` :
     ```json
     {
       "26113": {
         "rentPerM2": 11.75,
         "rentPerM2Lower": 9.09,
         "rentPerM2Upper": 15.19,
         "predictionType": "commune",
         "observationsCount": 356,
         "sourceType": "CLAMEUR_2025"
       }
     }
     ```

3. **Agrégats hexagonaux loyer** :
   - Pour chaque hexagone H3 niveau 8 :
     - Calculer centroid
     - Reverse geocoding → code INSEE commune nearest
     - `rentHex = rentCommune[insee].rentPerM2`
     - `predictionTypeHex = rentCommune[insee].predictionType`
   - Écrire `data/vYYYY-MM-DD/rents/hex/z{bundleZ}/{x}/{y}.json`
   - Métadonnées : `sourceCommune` (code INSEE), `predictionType` (qualité)

4. **Metadata** :
   - Ajouter dans `meta.json` :
     ```json
     {
       "rentSource": {
         "type": "CLAMEUR_2025",
         "url": "https://www.data.gouv.fr/fr/datasets/...",
         "disclaimer": "Loyers basés sur annonces locatives, biais +10-15%",
         "lastUpdate": "2025-12-11",
         "coverage": {
           "totalCommunes": 34900,
           "directData": 4871,
           "proxyData": 30029
         }
       }
     }
     ```

### Étapes runtime (apps/web)

**Ajout à `apps/web/lib/data/rents/`** (nouveau module) :

1. **Provider interface** :
   ```typescript
   interface RentDataProvider {
     getCommuneRent(insee: string): Promise<CommuneRent | null>;
     getHexRent(hexId: string): Promise<HexRent | null>;
   }
   ```

2. **Sélecteur métrique** :
   - Ajouter état `realEstateMetric: "sale" | "rent"` dans config affichage
   - Toggle UI dans la légende carte (switch ou tabs)

3. **Couches MapLibre** :
   - Layer commune rent : `fill` avec palette verte, opacité selon `predictionType`
   - Layer hex rent : `fill` avec palette verte, opacité héritée commune source
   - Feature-state dynamique : `metric: "sale" | "rent"`

4. **Tooltips** :
   - Commune : Afficher type données (direct vs proxy), nb observations
   - Hexagone : Afficher commune source, disclaimer uniformité

5. **Disclaimer UI** :
   - Badge permanent "Loyer d'annonce" dans légende
   - Tooltip info : *"Loyers basés sur annonces, peuvent différer loyers conclus (+10-15%)"*
   - Section info panel : Lien vers `/methodologie#loyers-clameur`

---

## Documentation requise

### Avant implémentation

1. **`docs/feature/real-estate-multiscale-indicators/sources-loyers.md`** :
   - ✅ **Déjà créé** : `sources.md` (actuel pour DVF vente)
   - À compléter : Section CLAMEUR 2025 (structure CSV, colonnes, qualité données)

### Après implémentation

2. **Mise à jour `docs/feature/real-estate-multiscale-indicators/spec.md`** :
   - Section 4 : Ajouter source CLAMEUR
   - Section 5.1 : Activer sélecteur métrique `Vente | Loyer`
   - Section 6 : Détailler calcul loyer commune + hex
   - Section 7.2 : Palette loyer verte
   - Section 8 : Ajouter datasets `rents/`
   - Section 10.2 : Tooltip loyer hexagone
   - Section 12 : Critères acceptation loyers

3. **Mise à jour `docs/architecture/overview.md`** :
   - Section "Agrégats multi-échelle" : Mentionner loyer commune + hex
   - Pattern disclaimer : Documenter biais loyers annonces

---

## Critères d'acceptation post-MVP

1. ✅ Source CLAMEUR 2025 importée et documentée
2. ✅ Loyers commune disponibles pour 34 900 communes (100% France)
3. ✅ Loyers hexagones calculés (valeur commune nearest)
4. ✅ Disclaimer UI "Loyer d'annonce" affiché (badge + tooltip)
5. ✅ Différenciation visuelle données directes (14%) vs proxy maille (86%)
6. ✅ Sélecteur métrique `Vente | Loyer` fonctionnel
7. ✅ Tooltips commune + hexagone avec source et type données
8. ✅ Documentation technique (`sources.md` complété, `spec.md` mis à jour)
9. ✅ Metadata `meta.json` avec source CLAMEUR + coverage stats

**Bonus optionnel (Post-MVP+1)** :
- ⚠️ Comparaison OLL loyers réels vs CLAMEUR annonces (tooltip grandes agglos)
- ⚠️ Segmentation type logement (appart 1-2P, 3P+, maisons) si pertinent UX

---

## Backlog évolutions ultérieures

### Post-MVP+2 : Formule proxy avancée (optionnel, si demande forte)

- Validation empirique formule `rentHex = rentCommune * (saleHex / saleCommune)^alpha`
- Calibration `alpha` sur échantillon OLL
- Disclaimer juridique renforcé
- **Prérequis** : Erreur moyenne < 20% validée, service légal OK

### Post-MVP+3 : Sources loyers réels nationales (veille)

- Surveiller ouverture INSEE loyers réels commune-level
- Partenariats OLL pour extension couverture
- Migration CLAMEUR → source réelle si disponible

**Critère migration** : Source réelle couvrant ≥ 80% communes (vs 14% actuellement CLAMEUR direct)
2. ✅ Si loyers hex estimés : validation empirique réalisée (erreur < 20%)
3. ✅ Disclaimer juridique validé par service légal
4. ✅ Sélecteur `Vente | Loyer` fonctionnel sans rechargement
5. ✅ Différenciation visuelle claire (commune observée vs hex estimé)
6. ✅ Infobulle hex affiche intervalle confiance ±X%
7. ✅ Modale disclaimer première utilisation implémentée
8. ✅ Page méthodologie `/methodologie#loyer-hex` créée
9. ✅ Documentation technique complète (sources, validation, API)

---

## Prochaines étapes

### Étape 1 : Décision source loyers (PO)

**Options** :
- A) Utiliser CLAMEUR (loyers annonces) avec disclaimer explicite → Implémentation rapide (1-2 sprints)
- B) Attendre source loyers réels fiable → Délai inconnu (6-12 mois ?)

**Recommandation** : Option A pour tester l'UX loyer, puis migrer vers B quand disponible.

### Étape 2 : Validation empirique (si loyers hex)

- Constituer échantillon 100+ communes
- Exécuter protocole validation (test alpha, erreur moyenne)
- Documenter résultats dans `validation-loyer-hex.md`
- Décision GO/NO-GO selon critère erreur < 20%

### Étape 3 : Validation juridique

- Rédaction disclaimer par juriste
- Validation service légal
- Ajustements si nécessaire

### Étape 4 : Implémentation

- Pipeline : Import source + calcul agrégats (1 sprint)
- Runtime : Sélecteur + couches + infobulle + disclaimer (1 sprint)
- Documentation + tests (0.5 sprint)

**Estimation totale** : 2-3 sprints (4-6 semaines) après validation pré-requis.

---

## Risques identifiés

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Source loyers réels indisponible | Élevée | Moyen | Utiliser CLAMEUR avec disclaimer explicite |
| Validation empirique échoue (erreur > 20%) | Moyenne | Élevé | Ne pas implémenter loyers hex, commune uniquement |
| Disclaimer insuffisant juridiquement | Faible | Critique | Validation juriste obligatoire avant release |
| Confusion utilisateur mesuré/estimé | Moyenne | Moyen | Différenciation visuelle forte + tooltip persistant |

---

**Conclusion** : La métrique loyer est **faisable post-MVP** sous conditions strictes. Recommandation = commencer par loyer commune uniquement (CLAMEUR), puis ajouter hex après validation empirique.
