# Spécification Technique — Rapport Détaillé Adresse (Premium)

**Statut** : Draft  
**Date** : 12 février 2026  
**Implémentation** : Non commencée (M7-8)  
**Dépendances** : DVF France, routing backend, OSM data

---

## 1) Contexte & objectif

Le **rapport détaillé adresse** est la **seule feature Premium** du produit. Il doit :
- Justifier un prix de vente one-shot (49-249€ à déterminer M9)
- Fournir une valeur actionnable immédiate (aide décision achat 300k€+)
- Être généré en < 30s (latence acceptable one-shot)
- Design professionnel (impression PDF pour banque/notaire)

---

## 2) Scope MVP (M7-8) : 4 sections core

### Section 1 : Analyse Prix Marché

**Données** :
- Transactions DVF adresse + 500m rayon (2 dernières années)
- Filtrage : même type bien (maison/appartement), ±30% surface

**Contenu** :
```
📊 ANALYSE PRIX MARCHÉ

Adresse analysée : 15 Rue du Commerce, 34000 Montpellier
Type bien : Maison, 120 m²
Prix demandé : 340 000 €

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Comparaison marché local (500m, 24 mois)

Prix médian maisons 100-150m² :    315 000 €
Prix médian / m² secteur :          2 625 €/m²
Prix demandé / m² :                 2 833 €/m² (+7,9%)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Transactions similaires récentes :

📍 12 Rue du Commerce (95 m²)       280 000 €   Nov 2025
📍 8 Rue Pasteur (135 m²)           365 000 €   Sept 2025
📍 22 Avenue Foch (110 m²)          298 000 €   Juil 2025
📍 6 Rue du Commerce (125 m²)       335 000 €   Mai 2025

[Graphique : Évolution prix/m² secteur 24 mois]
```

**Graphique** : Chart.js line chart (export PNG)
- Axe X : Date transaction (mois)
- Axe Y : Prix/m² (€)
- Ligne : Prix médian glissant 3 mois
- Point rouge : Prix demandé adresse analysée

---

### Section 2 : Score Opportunité & Négociation

**Calcul** :
```typescript
const ecartPrix = (prixDemande - prixMedianSecteur) / prixMedianSecteur * 100;

if (ecartPrix < -10) {
  score = "SOUS-ÉVALUÉ";
  reco = "Bon prix marché, risque enchères. Offre rapide recommandée.";
} else if (ecartPrix > 10) {
  score = "SUR-ÉVALUÉ";
  montantNego = prixDemande - prixMedianSecteur;
  reco = `Prix surévalué ${ecartPrix.toFixed(1)}%. Négocier -${montantNego.toLocaleString()}€.`;
} else {
  score = "CONFORME";
  reco = "Prix cohérent avec marché local.";
}
```

**Contenu** :
```
🎯 SCORE OPPORTUNITÉ

Statut : SUR-ÉVALUÉ +7,9%

Le prix demandé (340 000€) est supérieur au prix médian du 
secteur (315 000€) pour un bien équivalent.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 RECOMMANDATION NÉGOCIATION

Négocier -25 000€ pour revenir au prix marché.

Prix cible : 315 000€ (prix médian secteur)
Marge négociation : 7,9% du prix demandé

Arguments :
✓ Transactions similaires récentes 280-335k€
✓ Prix/m² demandé 8% au-dessus médiane
✓ 4 ventes comparables <320k€ sur 6 derniers mois
```

---

### Section 3 : Points de Vigilance (Nuisances)

**Sources** :
- **OSM** (OpenStreetMap) uniquement pour MVP
  - Aéroports (`aeroway=aerodrome`)
  - Gares (`railway=station`)
  - Voies ferrées (`railway=rail`)
  - Routes majeures (`highway=motorway|trunk`)
  - Zones industrielles (`landuse=industrial`)

**Calcul distances** :
- Turf.js `distance()` entre adresse et features OSM
- Rayon analyse : 5 km

**Contenu** :
```
⚠️ POINTS DE VIGILANCE

Nuisances détectées dans un rayon de 5 km :

🛫 Aéroport Montpellier-Méditerranée
   Distance : 8,2 km (hors zone impact sonore)
   Impact : FAIBLE

🚂 Gare TGV Montpellier Sud-de-France
   Distance : 3,4 km
   Impact : FAIBLE (pas de nuisance directe)

🏭 Zone industrielle Port Marianne
   Distance : 1,8 km
   Impact : MOYEN (vérifier vents dominants)

🛣️ Autoroute A9
   Distance : 2,1 km
   Impact : FAIBLE (bruit atténué par distance)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Carte : Adresse + nuisances rayon 5km]

✅ Aucune nuisance majeure détectée
⚠️ Vérifier isolation phonique (proximité zone industrielle)
```

**Carte** : Mapbox Static API ou MapLibre export
- Centre : Adresse analysée (marker rouge)
- Markers : Nuisances (couleur par impact)
- Cercle : Rayon 5 km

---

### Section 4 : Temps Trajet Exacts

**Données** :
- Backend routing `/api/routing/matrix`
- Adresse GPS exacte (géocodage TomTom)
- Destinations saisies utilisateur (max 3)

**Contenu** :
```
🚗 TEMPS DE TRAJET

Depuis : 15 Rue du Commerce, 34000 Montpellier

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📍 Travail Maman (Place de la Comédie, Montpellier)
   Voiture : 12 min (lundi 8h30)
   Distance : 4,2 km

📍 Travail Papa (ZAC Garosud, Lunel)
   Voiture : 28 min (lundi 8h30)
   Distance : 18,5 km

📍 École Primaire Jules Ferry (Rue Pasteur, Montpellier)
   Voiture : 6 min
   Distance : 2,1 km

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Temps trajet conformes aux critères recherche
⚠️ Trafic variable : marge +10% recommandée
```

---

## 3) Architecture technique

### Stack

```
Frontend (apps/web)
  ↓ POST /api/reports/generate
Backend API (apps/api-routing)
  ├── Route: POST /api/reports/generate
  ├── Service: ReportGeneratorService
  │   ├── fetchDVFData(address, radius)
  │   ├── calculateOpportunityScore(price, median)
  │   ├── fetchOSMNuisances(lat, lng, radius)
  │   ├── calculateTravelTimes(origins, destinations)
  │   └── generatePDF(data)
  └── Puppeteer (HTML template → PDF)
      ↓ Return PDF Buffer
Frontend
  ↓ Download PDF
```

---

### Endpoint API

**POST /api/reports/generate**

**Input** :
```typescript
{
  address: {
    full: "15 Rue du Commerce, 34000 Montpellier",
    lat: 43.610769,
    lng: 3.876716
  },
  propertyType: "maison" | "appartement",
  surface: 120,
  price: 340000,
  destinations: [
    { label: "Travail Maman", lat: 43.608, lng: 3.880 },
    { label: "Travail Papa", lat: 43.672, lng: 4.137 }
  ],
  departureTime: "2026-02-17T08:30:00",
  dayOfWeek: "monday"
}
```

**Output** :
```typescript
{
  reportId: "rpt_abc123",
  pdfUrl: "/downloads/reports/rpt_abc123.pdf",
  generatedAt: "2026-02-17T10:45:23Z",
  sections: {
    marketAnalysis: { median: 315000, ecart: 7.9 },
    opportunityScore: "SUR-ÉVALUÉ",
    nuisances: 4,
    travelTimes: [12, 28, 6]
  }
}
```

**Latency** : 10-30s (acceptable one-shot payant)

---

### Template HTML → PDF (Design fait maison)

**Fichier** : `apps/api-routing/templates/report.html`

**Contraintes design** :
- Police : Inter (Google Fonts, web-safe)
- Couleur marque : `#1b4d3e` (brand green)
- Responsive print (A4, marges 2cm)
- Impression noir & blanc OK (graphiques lisibles sans couleur)

**Structure** :
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    @page { size: A4; margin: 2cm; }
    body { font-family: 'Inter', sans-serif; font-size: 11pt; }
    h1 { color: #1b4d3e; font-size: 24pt; }
    .section { page-break-inside: avoid; margin-bottom: 2cm; }
    .chart { width: 100%; height: 300px; }
    .table { width: 100%; border-collapse: collapse; }
    .alert-high { background: #fee; border-left: 4px solid #c33; }
    .alert-medium { background: #ffc; border-left: 4px solid #f90; }
    .alert-low { background: #efe; border-left: 4px solid #3c3; }
  </style>
</head>
<body>
  <header>
    <h1>Rapport d'Analyse Immobilière</h1>
    <p>{{address}}</p>
    <p>Généré le {{date}}</p>
  </header>

  <div class="section">
    <h2>📊 Analyse Prix Marché</h2>
    <!-- Section 1 content -->
    <img src="{{chartPriceEvolution}}" class="chart" />
  </div>

  <div class="section">
    <h2>🎯 Score Opportunité</h2>
    <!-- Section 2 content -->
  </div>

  <div class="section">
    <h2>⚠️ Points de Vigilance</h2>
    <!-- Section 3 content -->
    <img src="{{mapNuisances}}" class="chart" />
  </div>

  <div class="section">
    <h2>🚗 Temps de Trajet</h2>
    <!-- Section 4 content -->
  </div>

  <footer>
    <p>Choisir sa Ville - choisir-sa-ville.fr</p>
    <p>Données : DVF, OSM, TomTom Routing</p>
  </footer>
</body>
</html>
```

**Puppeteer génération** :
```typescript
const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();

await page.setContent(htmlTemplate, { waitUntil: 'networkidle0' });
const pdf = await page.pdf({
  format: 'A4',
  printBackground: true,
  margin: { top: '2cm', right: '2cm', bottom: '2cm', left: '2cm' }
});

await browser.close();
return pdf; // Buffer
```

---

## 4) Génération graphiques

**Chart.js server-side** :
- Librairie : `chartjs-node-canvas`
- Export PNG → embed base64 dans HTML template

**Exemple** :
```typescript
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';

const chartJSNodeCanvas = new ChartJSNodeCanvas({ 
  width: 800, 
  height: 400 
});

const configuration = {
  type: 'line',
  data: {
    labels: ['Jan 25', 'Fév 25', 'Mar 25', ...],
    datasets: [{
      label: 'Prix médian / m²',
      data: [2500, 2550, 2600, 2625],
      borderColor: '#1b4d3e'
    }]
  }
};

const imageBuffer = await chartJSNodeCanvas.renderToBuffer(configuration);
const base64Image = imageBuffer.toString('base64');
const dataUrl = `data:image/png;base64,${base64Image}`;

// Inject dans template HTML
htmlTemplate = htmlTemplate.replace('{{chartPriceEvolution}}', dataUrl);
```

---

## 5) Génération carte nuisances

**Mapbox Static Images API** (gratuit 50k req/mois)
```
https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/
  pin-l-danger+c33(3.876716,43.610769),
  pin-s-airport+f90(3.95,43.58)
  /3.876716,43.610769,11,0/800x400@2x
  ?access_token=YOUR_TOKEN
```

---

## 6) Stockage rapports

**Stockage temporaire** (MVP) :
- Génération → Upload Cloudflare R2 → URL signée 24h
- Cleanup automatique après 24h (cron job)
- Coûts : 0€ (R2 gratuit 10GB)

---

## 7) Paiement Stripe

**Flow** :
1. Saisie adresse + données → Aperçu gratuit
2. Clic "Générer rapport 49,90€"
3. Stripe Checkout one-shot
4. Webhook `checkout.session.completed`
5. Génération rapport → Upload → Email PDF

---

## 8) Performances

**Latency budget** : 12-28s total
- Fetch DVF : 2-5s
- Fetch OSM : 1-2s
- Routing : 1-2s
- Charts : 1-2s
- Puppeteer PDF : 5-15s
- Upload : 1-2s

---

## 9) Beta test (M8)

**Recrutement** :
- Reddit : r/vosfinances, r/france (posts "Recherche beta testeurs rapport immo gratuit")
- TikTok : Vidéos courtes "J'ai créé un outil analyse prix immo, qui veut tester ?"
- Forums : PAP.fr, SeLoger forums, Meilleurtaux

**Critères** :
- Recherche active achat <3 mois
- Adresse candidate identifiée
- Motivation feedback (visio 30min ou formulaire détaillé)

**Objectif** : NPS >60, itération V2 si <40

---

## 10) Effort développement

**Total** : 3-4 semaines
- Backend API : 2 semaines
- Frontend : 1 semaine
- Tests : 3 jours
- Beta test : 1 semaine

**Go/No-Go** : NPS >60 → Willingness to pay M9
