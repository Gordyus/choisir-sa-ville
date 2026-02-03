# Guides (consolidés)

Ce document regroupe les notes courtes auparavant réparties dans plusieurs fichiers.

## Philosophie (MVP)
- Simplicité > abstraction prématurée
- Lisibilité > micro-optimisation
- Portabilité > vendor lock-in

## Coding rules
- TypeScript strict
- Pas de logique métier dans les routes
- Validation Zod systématique
- Pas d’accès DB direct depuis l’API

## Workflows
- feature/* → PR → main
- migrations versionnées
- seed reproductible

## Data contract
Les données exposées par l’API sont :
- versionnées
- documentées
- stables

Toute modification implique :
- migration
- mise à jour doc

## Cache strategy
Objectif : réduire les calculs coûteux et appels DB.

- Cache en mémoire en local
- Interface Cache abstraite
- Implémentation Redis/KV possible en prod
- TTL explicite par use-case

## Import pipeline
- Données publiques (INSEE, IGN, etc.)
- Import via scripts dédiés
- Jamais depuis l’API runtime
- Traçabilité des sources obligatoire

## Scoring guide
- Scores normalisés
- Présentation utilisateur sur 5 étoiles
- Calculs transparents et explicables

