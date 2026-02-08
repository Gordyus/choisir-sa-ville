import type { ReactNode } from "react";

export type FAQItem = {
    id: string;
    title: string;
    content: string | ReactNode;
};

export const FAQ_ITEMS: FAQItem[] = [
    {
        id: "insecurity-index",
        title: "Indice de sécurité : comment ça marche ?",
        content: `L'indice de sécurité mesure le niveau relatif d'insécurité d'une commune par rapport aux autres communes de France, sur une échelle de 0 à 100.

Plus le score est élevé, plus la commune se situe dans une position relative d'insécurité élevée par rapport à l'ensemble des communes françaises de taille comparable.

Les 5 niveaux de classification :

• Niveau 0 - Très faible (vert) : Percentile 0-20
  Parmi les 20% de communes les moins touchées

• Niveau 1 - Faible (vert-jaune) : Percentile 20-40
  Légèrement en-dessous de la moyenne nationale

• Niveau 2 - Modéré (jaune) : Percentile 40-60
  Proche de la moyenne nationale

• Niveau 3 - Élevé (orange) : Percentile 60-80
  Légèrement au-dessus de la moyenne nationale

• Niveau 4 - Plus élevé (rouge) : Percentile 80-100
  Parmi les 20% de communes les plus touchées

Pourquoi comparer les communes par taille ?

Les communes sont classées en 3 catégories de taille (petites, moyennes, grandes) avant calcul du percentile. Cette segmentation évite de comparer des contextes urbains trop différents.

Une petite commune rurale de 500 habitants n'est comparée qu'aux autres petites communes, pas à Paris ou Marseille. Cela rend la comparaison plus pertinente et équitable.

Comment est calculé le score ?

Le score agrège 3 familles d'indicateurs issus des données officielles :

1. Atteintes volontaires à l'intégrité physique (40% du score)
   Violences, coups et blessures

2. Atteintes aux biens (35% du score)
   Vols, cambriolages, dégradations

3. Atteintes à la tranquillité publique (25% du score)
   Troubles à l'ordre public, dégradations légères

Chaque famille est normalisée pour 100 000 habitants puis pondérée pour obtenir un score global.

Exemple de calcul concret :

Prenons une commune moyenne fictive de 50 000 habitants avec les données suivantes pour l'année 2024 :

• Atteintes à l'intégrité physique : 820 faits / 50 000 hab = 1640 pour 100 000 hab
• Atteintes aux biens : 2100 faits / 50 000 hab = 4200 pour 100 000 hab
• Atteintes à la tranquillité : 650 faits / 50 000 hab = 1300 pour 100 000 hab

Le score brut est calculé ainsi :
(1640 × 40%) + (4200 × 35%) + (1300 × 25%) = 656 + 1470 + 325 = 2451 pour 100 000 hab

Ce score brut est ensuite comparé à toutes les communes de taille similaire (ici, les communes moyennes de 10 000 à 100 000 habitants) pour obtenir un percentile [0-100], qui détermine le niveau affiché.

Pourquoi ces pondérations ?

Les poids 40%, 35%, 25% reflètent l'importance relative de chaque catégorie dans la construction de l'indice :

• 40% pour les violences physiques : Ces infractions, bien que de natures diverses, concernent l'intégrité des personnes et ont un impact psychologique fort sur le sentiment de sécurité

• 35% pour les atteintes aux biens : Cambriolages, vols et dégradations représentent une part importante des faits constatés et affectent directement le quotidien des habitants

• 25% pour la tranquillité publique : Troubles à l'ordre public et incivilités contribuent à la perception générale de sécurité d'un territoire

Cette pondération permet d'équilibrer gravité perçue (violences) et volume d'exposition (biens, tranquillité).

Source des données :

Les données proviennent exclusivement de sources officielles publiques :

• Ministère de l'Intérieur - Service statistique ministériel de la sécurité intérieure (SSMSI)
• INSEE - Données de population

Les données sont mises à jour annuellement et reflètent l'année civile la plus récente disponible.

Comment interpréter cet indice ?

Cet indice est un indicateur comparatif, pas une mesure absolue du danger. Il compare les communes entre elles selon les données déclarées officiellement.

Limites importantes :
• Les données reflètent les faits constatés et enregistrés, pas nécessairement la réalité exhaustive
• Le niveau peut varier d'une année à l'autre
• Un niveau "élevé" ne signifie pas qu'une commune est dangereuse, mais qu'elle se situe dans la partie haute de la distribution nationale

Utilisez cet indice comme un élément d'information parmi d'autres, pas comme un critère unique de décision.`
    }
];
