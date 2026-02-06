import type { ReactNode } from "react";

import {
    INSECURITY_CATEGORIES,
    INSECURITY_EPSILON,
    INSECURITY_LEVELS,
    getWeightPercentage
} from "@/lib/config/insecurityMetrics";

export type FAQItem = {
    id: string;
    title: string;
    content: string | ReactNode;
};

export const FAQ_ITEMS: FAQItem[] = [
    {
        id: "classification",
        title: "Qu'est-ce que le classement des villes par insécurité ?",
        content: `L'indice d'insécurité classe les communes sur une échelle de 0 à 100, basée sur le nombre d'incidents pour 1000 habitants.

**Les 5 niveaux :**
${INSECURITY_LEVELS.map((l) => `- **${l.label}** (${l.description})`).join("\n")}

**Comment ça marche :**
- Les communes très faibles (≤${INSECURITY_EPSILON}/1000 hab) ont un indice de 0.
- Les autres communes sont classées par percentile national, sans tenir compte des très faibles.
- Cela permet aux communes limitrophes de grandes villes d'être visibles dans le classement.`
    },
    {
        id: "families",
        title: "Les familles d'infractions",
        content: `Les données SSMSI regroupent les infractions en 3 familles :

${INSECURITY_CATEGORIES.map(
    (cat) => `- **${cat.label}** (${getWeightPercentage(cat.weight)}% du score)
  - Crimes et délits violents contre les personnes (agressions, vols avec violence, etc.)`
).join("\n")}

Le score brut combine ces 3 familles avec leurs poids respectifs pour obtenir une métrique composite.`
    },
    {
        id: "colors",
        title: "Code couleur sur la carte",
        content: `La carte utilise un gradient de couleurs pour représenter l'insécurité :

- 🟢 **Vert** = Très faible insécurité
- 🟡 **Jaune** = Faible insécurité
- 🟠 **Orange** = Insécurité modérée
- 🔴 **Rouge foncé** = Insécurité élevée
- 🔴 **Rouge** = Insécurité très élevée

**Note :** Les communes très faibles (≤${INSECURITY_EPSILON}/1000 hab) affichent en vert clair.`
    },
    {
        id: "weighting",
        title: "Comment fonctionne la pondération ?",
        content: `Le score brut combine les 3 familles d'infractions avec des poids différents :

${INSECURITY_CATEGORIES.map((cat) => `- **${cat.label}** : ${(cat.weight * 100).toFixed(0)}%`).join("\n")}

**Exemple :**
Une commune avec :
- 10 crimes violents/1000 hab
- 25 atteintes aux biens/1000 hab
- 5 troubles à l'ordre public/1000 hab

Aura un score brut = (10 × 0.4) + (25 × 0.35) + (5 × 0.25) = 4 + 8.75 + 1.25 = 14 incidents/1000 hab`
    },
    {
        id: "epsilon",
        title: "Epsilon et rescaling : pourquoi ces chiffres ?",
        content: `**Le problème :** Beaucoup de petites communes ont un score très proche de 0. Cela écrase la distribution nationale et rend les vraies différences invisibles.

**La solution :** On utilise un seuil epsilon (ε = ${INSECURITY_EPSILON}) :

- Communes avec scoreRaw ≤ ${INSECURITY_EPSILON} → indice = 0 (très faible)
- Communes avec scoreRaw > ${INSECURITY_EPSILON} → indice calculé sur la distribution filtrée

**Formule (simplifiée) :**
\`\`\`
indexGlobal = 1 + 99 × (rang commune / rang max) dans {communes > ε}
\`\`\`

**Résultat :** Les communes limitrophes de grandes villes montent visibles dans le classement.`
    },
    {
        id: "sources",
        title: "Sources et fiabilité des données",
        content: `**Source :** Ministère de l'Intérieur – SSMSI (Système Statistique de Sécurité Intérieure)
- Base communale de la délinquance enregistrée
- Années disponibles : 2016 à 2024
- Actualisation : annuelle

**Normalisation :** Population INSEE pour mettre à l'échelle (incidents pour 1000 habitants)

**Granularité :** Communes (niveau pivot)
- Arrondissements et zones infra-communales : à étudier ultérieurement`
    }
];
