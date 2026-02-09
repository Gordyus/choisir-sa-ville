export const SOURCE_URLS = {
    communes: "https://www.insee.fr/fr/statistiques/fichier/8377162/v_commune_2025.csv",
    regions: "https://www.insee.fr/fr/statistiques/fichier/8377162/v_region_2025.csv",
    departments: "https://www.insee.fr/fr/statistiques/fichier/8377162/v_departement_2025.csv",
    postal: "https://static.data.gouv.fr/resources/communes-de-france-base-des-codes-postaux/20241113-073516/20230823-communes-departement-region.csv",
    populationRef: "https://www.insee.fr/fr/statistiques/fichier/8680726/ensemble.zip",
    ssmsi: "https://www.data.gouv.fr/api/1/datasets/r/98fd2271-4d76-4015-a80c-bcec329f6ad0",
    dvfGeolocalisees: "https://www.data.gouv.fr/api/1/datasets/r/d7933994-2c66-4131-a4da-cf7cd18040a4"
} as const;

export type SourceKey = keyof typeof SOURCE_URLS;