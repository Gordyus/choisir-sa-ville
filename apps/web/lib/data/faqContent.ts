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
        content: `L'indice de sécurité classe les communes sur une échelle de 0 à 100, basée sur le nombre d'incidents enregistrés pour 100 000 habitants.

**Les 5 niveaux :**
${INSECURITY_LEVELS.map((l) => `- **${l.label}** (${l.description})`).join("\n")}

**Comment fonctionne le classement :**
Les communes sont classées par **percentile** selon leur score brut d'insécurité, avec une double perspective :
- **National** : Comparaison avec toutes les communes françaises
- **Catégorie de taille** : Comparaison avec des communes de taille similaire (prioritaire)

Plus le score brut est faible, plus l'indice de sécurité est proche de 0 (commune très sûre). Les communes avec le score le plus élevé ont un indice proche de 100 (insécurité la plus importante).

**Classification par taille de population :**

Pour permettre des comparaisons légitimes, les communes sont classées en 3 catégories selon leur population :

- **Petites communes** : moins de 10 000 habitants
- **Communes moyennes** : 10 000 à 100 000 habitants  
- **Grandes villes** : plus de 100 000 habitants

Le niveau affiché (0 à 4) reflète le classement **au sein de la catégorie de taille**.

**Pourquoi cette classification ?**

Les petites communes peuvent avoir des taux très élevés avec peu de faits divers.

**Exemple** : Une commune de 50 habitants avec 1 seul fait divers aura un taux de 2 000 pour 100 000 habitants, alors qu'une grande ville avec 200 faits pour 100 000 habitants aura un taux bien plus faible.

Comparer ces deux communes directement serait mathématiquement invalide. La classification par taille résout ce biais en comparant chaque commune à ses **pairs de taille similaire**.

**Que signifie "pour 100 000 habitants" ?**

C'est le standard scientifique international (ONU, études académiques). Les taux sont exprimés en "faits pour 100 000 habitants" au lieu de "pour 1 000" pour faciliter les comparaisons internationales et éviter les confusions avec les pourcentages.

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
- Normalisation : Population INSEE pour mettre à l'échelle (incidents pour 100 000 habitants)
- Granularité : Communes (niveau pivot)

**Important :** Cet indice mesure les **infractions enregistrées** par les autorités, pas les faits réels. Les tendances géographiques et temporelles sont significatives, mais le chiffre brut dépend du taux de signalement.`
    }
];
