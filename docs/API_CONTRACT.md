# API_CONTRACT – MVP / POC

Ce document définit le **contrat public** de l’API HTTP (format des réponses, erreurs, conventions).
Il est conçu pour :
- rester **stable** pour le front et les consommateurs externes,
- rester **agnostique** de l’hébergeur,
- faciliter le travail de Codex (conventions explicites).

---

## 1) Principes généraux

- Base URL (local) : `http://localhost:8787`
- API **stateless**
- JSON uniquement
- UTF-8
- Dates en **ISO 8601** (`YYYY-MM-DDTHH:mm:ss.sssZ`)
- Champs en **camelCase**
- Toute réponse d’erreur respecte un format unique.

---

## 2) Conventions HTTP

### Codes de statut
- `200` OK : réponse standard
- `201` Created : création (si ajoutée plus tard)
- `204` No Content : suppression (si ajoutée plus tard)
- `400` Bad Request : validation / paramètres invalides
- `401` Unauthorized : authentification requise (si ajoutée plus tard)
- `403` Forbidden : autorisé mais accès refusé (si ajoutée plus tard)
- `404` Not Found : ressource inexistante
- `409` Conflict : conflit (ex: doublon, état incohérent)
- `422` Unprocessable Entity : erreur métier / règle métier non satisfaite
- `429` Too Many Requests : rate limiting (si ajouté plus tard)
- `500` Internal Server Error : erreur inattendue

### Headers
- `Content-Type: application/json`
- `Accept: application/json`
- `X-Request-Id` (optionnel) : si présent, l’API le renvoie tel quel.
- CORS : géré côté serveur, transparent pour le contrat.

---

## 3) Format des réponses

### 3.1 Réponses “objet”
Réponse directe, sans enveloppe imposée :

```json
{
  "id": "…",
  "name": "…"
}
```

### 3.2 Réponses “liste”
Format stable :

```json
{
  "items": [],
  "meta": {
    "limit": 10,
    "offset": 0,
    "total": 123
  }
}
```

Notes :
- `total` peut être omis tant qu’il n’est pas calculé efficacement (MVP).
- si `total` est absent, `meta` reste présent avec `limit`/`offset`.

### 3.3 Pagination
Convention (query string) :
- `limit` : entier [1..50], défaut 10
- `offset` : entier >= 0, défaut 0

Exemple :
`GET /cities?q=par&limit=10&offset=0`

---

## 4) Format d’erreur (OBLIGATOIRE)

Toutes les erreurs répondent avec :

```json
{
  "error": {
    "code": "SOME_CODE",
    "message": "Human readable message",
    "details": {}
  }
}
```

Règles :
- `error.code` : string **stable**, en **SCREAMING_SNAKE_CASE**
- `error.message` : message lisible, non localisé (FR/EN à décider plus tard)
- `error.details` : optionnel, objet JSON (jamais un texte brut)
- Aucune stacktrace ne doit être renvoyée en prod.

### 4.1 Mapping des erreurs

#### Validation / Zod
- HTTP `400`
- code : `VALIDATION_ERROR`
- details : format minimal stable

Exemple :

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request",
    "details": {
      "issues": [
        {
          "path": ["q"],
          "message": "Required"
        }
      ]
    }
  }
}
```

#### Not found
- HTTP `404`
- code : `NOT_FOUND`

#### Conflit
- HTTP `409`
- code : `CONFLICT`

#### Métier
- HTTP `422`
- code : `DOMAIN_ERROR`
- details : inclure un sous-code si utile (`reason`, `rule`, etc.)

#### Rate limit (si ajouté)
- HTTP `429`
- code : `RATE_LIMITED`

#### Erreur interne
- HTTP `500`
- code : `INTERNAL_ERROR`
- message : générique

---

## 5) Endpoints MVP (actuels)

### GET /health
But : vérifier que l’API répond.

**200**
```json
{ "ok": true }
```

### GET /cities
Recherche simple de cities (MVP).

Query :
- `q` (string) : terme recherché (min 1) – défaut vide côté core, mais l’API peut imposer min 1
- `limit` (int) : 1..50 – défaut 10
- `offset` (int) : >= 0 – défaut 0 (si implémenté)

**200**
```json
{
  "items": [
    { "inseeCode": "75056", "name": "Paris", "population": 2165423 }
  ],
  "meta": { "limit": 10, "offset": 0 }
}
```

Erreurs possibles :
- `400 VALIDATION_ERROR`

### GET /cities/:idOrCode
Details d'une city (data source: commune).

**200**
```json
{
  "inseeCode": "75056",
  "name": "Paris",
  "population": 2165423,
  "departmentCode": "75",
  "regionCode": "11",
  "lat": 48.8566,
  "lon": 2.3522
}
```

Erreurs possibles :
- `400 VALIDATION_ERROR`
- `404 NOT_FOUND`

### GET /cities/:idOrCode/infra-zones
Liste des zones infra-communales pour une city (ARM, COMD, COMA).

Query :
- `type` (optionnel) : `ARM|COMD|COMA`
- `limit` (int) : 1..50 - defaut 50
- `offset` (int) : >= 0 - defaut 0

**200**
```json
{
  "items": [
    {
      "id": "ARM:75111",
      "type": "ARM",
      "code": "75111",
      "parentCommuneCode": "75056",
      "name": "Paris 11e Arrondissement"
    }
  ],
  "meta": { "limit": 50, "offset": 0 }
}
```

Erreurs possibles :
- `400 VALIDATION_ERROR`
- `404 NOT_FOUND`

---

## 6) Versioning

MVP : pas de version dans l’URL.
Quand nécessaire :
- versioning via URL : `/v1/...`
- ou via header : `Accept: application/vnd.choisirsaville.v1+json`

Décision à prendre avant ouverture publique large.

---

## 7) Compat & évolutions

- Toute modification **breaking** implique :
  - nouvelle version (v2) ou endpoint alternatif
  - mise à jour de ce document
- Toute nouvelle route doit :
  - suivre ce contrat (réponses + erreurs)
  - être documentée ici (au minimum : méthode, path, exemples)

---
