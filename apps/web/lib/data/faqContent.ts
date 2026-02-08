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
