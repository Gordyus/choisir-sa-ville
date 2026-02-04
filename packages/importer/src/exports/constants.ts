export const SOURCE_URLS = {
    communes: "https://www.insee.fr/fr/statistiques/fichier/8377162/v_commune_2025.csv",
    regions: "https://www.insee.fr/fr/statistiques/fichier/8377162/v_region_2025.csv",
    departments: "https://www.insee.fr/fr/statistiques/fichier/8377162/v_departement_2025.csv",
    postal: "https://static.data.gouv.fr/resources/communes-de-france-base-des-codes-postaux/20241113-073516/20230823-communes-departement-region.csv",
    populationRef: "https://www.insee.fr/fr/statistiques/fichier/8680726/ensemble.zip"
} as const;

export type SourceKey = keyof typeof SOURCE_URLS;