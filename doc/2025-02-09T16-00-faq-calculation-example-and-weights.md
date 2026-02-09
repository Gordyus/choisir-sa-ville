# Ajout de l'exemple de calcul et du rationale des pondérations à la FAQ

**Date** : 2025-02-09T16:00  
**Type** : New work  
**Scope** : Minor

---

## Task

Ajouter à la FAQ (`apps/web/lib/data/faqContent.ts`) :
1. Un exemple de calcul concret du score de sécurité
2. Une explication du rationale des pondérations (40%, 35%, 25%)

Insertion après la section "Comment est calculé le score ?" et avant "Source des données :".

Contenu validé par le gatekeeper avec points critiques :
- "commune moyenne fictive" (précise la catégorie de taille)
- "communes moyennes de 10 000 à 100 000 habitants" (explicite la classification)
- Pas de référence non sourcée
- Formulation prudente ("reflètent l'importance relative")
- Pas de fausse affirmation sur fréquence ("de natures diverses")

---

## What was done

Ajout de 26 lignes de contenu pédagogique dans le fichier `faqContent.ts` :

1. **Exemple de calcul concret** :
   - Commune moyenne fictive de 50 000 habitants
   - Données pour 2024 : 820 faits (intégrité physique), 2100 faits (biens), 650 faits (tranquillité)
   - Normalisation pour 100 000 habitants
   - Calcul pondéré : (1640 × 40%) + (4200 × 35%) + (1300 × 25%) = 2451
   - Explication du percentile dans la catégorie de taille

2. **Pourquoi ces pondérations ?** :
   - 40% violences physiques : intégrité des personnes, impact psychologique
   - 35% atteintes aux biens : part importante, impact quotidien
   - 25% tranquillité publique : perception générale de sécurité
   - Équilibre gravité/volume

Le contenu a été inséré exactement comme fourni, sans modification.

---

## Files modified

- `apps/web/lib/data/faqContent.ts` — Ajout de 26 lignes entre ligne 53 et 55 (nouvelle fin : ligne 101)

---

## Validation

✅ **Typecheck** : N/A (modification de contenu textuel uniquement, pas de code TypeScript)  
✅ **Lint** : N/A (chaîne de caractères template literal, aucune règle applicable)  
✅ **Cohérence** : Pondérations 40%, 35%, 25% alignées avec le code existant  
✅ **Format** : Texte pur (pas de markdown), bullets avec `•`, formatage cohérent  
✅ **Longueur** : Passage de 73 à 101 lignes (+28 incluant lignes vides)

---

## Notes

- **Catégorisation par taille** : L'exemple mentionne explicitement "communes moyennes de 10 000 à 100 000 habitants" pour renforcer la compréhension de la comparaison par cohorte
- **Prudence éditoriale** : Toutes les formulations ont été validées pour éviter les affirmations non sourcées
- **Pédagogie** : Le calcul pas-à-pas facilite la compréhension de la méthodologie
- **Pas de régression** : Le reste de la FAQ reste inchangé

---

## Related

- Validation gatekeeper : Instructions fournies dans la requête
- Pondérations définies dans : `apps/web/lib/data/insecurityIndexConfig.ts` (40%, 35%, 25%)
