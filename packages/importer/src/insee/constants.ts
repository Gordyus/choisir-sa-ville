export const DEFAULT_SOURCE_URL =
  "https://www.insee.fr/fr/statistiques/fichier/8377162/v_commune_2025.csv";
export const DEFAULT_REGION_SOURCE_URL =
  "https://www.insee.fr/fr/statistiques/fichier/8377162/v_region_2025.csv";
export const DEFAULT_DEPARTMENT_SOURCE_URL =
  "https://www.insee.fr/fr/statistiques/fichier/8377162/v_departement_2025.csv";
export const DEFAULT_POSTAL_SOURCE_URL =
  "https://static.data.gouv.fr/resources/communes-de-france-base-des-codes-postaux/20241113-073516/20230823-communes-departement-region.csv";
// INSEE "Populations de référence" (reference population, effective 01/01/2026, year 2023)
// Source: https://www.insee.fr/fr/statistiques/8680726 (ensemble.zip containing CSV files)
export const DEFAULT_POPULATION_REFERENCE_SOURCE_URL =
  "https://www.insee.fr/fr/statistiques/fichier/8680726/ensemble.zip";
export const DEFAULT_POPULATION_REFERENCE_YEAR = 2023;
export const DEFAULT_OFFLINE_COORDS_PATH = "data/coords/communes-centroid.csv";

export const CACHE_DIR = ".cache";
export const BATCH_SIZE = 500;
export const LOG_EVERY = 1000;
