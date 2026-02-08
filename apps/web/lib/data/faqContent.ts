import type { ReactNode } from "react";

import {
    INSECURITY_CATEGORIES,
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
        id: "insecurity-index",
        title: "Indice de sécurité : comment ça marche ?",
        content: `L'indice de sécurité classe les communes sur une échelle de 0 à 100, basée sur le nombre d'incidents enregistrés pour 1000 habitants.

**Les 5 niveaux :**
${INSECURITY_LEVELS.map((l) => `- **${l.label}** (${l.description})`).join("\n")}

**Comment fonctionne le classement :**
Les communes sont classées par **percentile national** selon leur score brut d'insécurité. Plus le score brut est faible, plus l'indice de sécurité est proche de 0 (commune très sûre). Les communes avec le score le plus élevé ont un indice proche de 100 (insécurité la plus importante).

**Les 3 familles d'infractions mesurées :**
${INSECURITY_CATEGORIES.map(
    (cat) => `- **${cat.label}** (${getWeightPercentage(cat.weight)}% du score global)`
).join("\n")}

**La pondération :**
Ces 3 familles sont combinées avec des poids différents pour obtenir un indice composite :
${INSECURITY_CATEGORIES.map((cat) => `- **${cat.label}** : ${(cat.weight * 100).toFixed(0)}%`).join("\n")}

Cette pondération reflète l'importance relative de chaque catégorie dans le sentiment d'insécurité selon les enquêtes victimisation françaises.

**Code couleur sur la carte :**
- 🟢 **Vert** = Très faible insécurité (indice 0–24)
- 🟡 **Jaune** = Faible insécurité (indice 25–49)
- 🟠 **Orange** = Insécurité modérée (indice 50–74)
- 🔴 **Rouge foncé** = Insécurité élevée (indice 75–100)
- 🔴 **Rouge** = Très élevée (top 10%)

**Source et fiabilité :**
**Source :** Ministère de l'Intérieur – SSMSI (Système Statistique de Sécurité Intérieure)
- Base communale de la délinquance enregistrée
- Années disponibles : 2016 à 2024
- Actualisation : annuelle
- Normalisation : Population INSEE pour mettre à l'échelle (incidents pour 1000 habitants)
- Granularité : Communes (niveau pivot)

**Important :** Cet indice mesure les **infractions enregistrées** par les autorités, pas les faits réels. Les tendances géographiques et temporelles sont significatives, mais le chiffre brut dépend du taux de signalement.`
    }
];
