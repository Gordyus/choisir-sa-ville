export const COMMUNE_KEYS = [
  "code_commune_insee",
  "inseeCode",
  "code_insee",
  "codeinsee",
  "com",
  "code_commune"
].map((key) => key.toLowerCase());

export const POSTAL_KEYS = [
  "code_postal",
  "postalCode",
  "postal_code",
  "codepostal",
  "cp"
].map((key) => key.toLowerCase());

export const LAT_KEYS = ["latitude", "lat", "geo_latitude", "latitude_commune"].map(
  (key) => key.toLowerCase()
);
export const LON_KEYS = [
  "longitude",
  "lon",
  "geo_longitude",
  "longitude_commune"
].map((key) => key.toLowerCase());

export const DEFAULT_LOG_EVERY = 50000;
export const POSTAL_BATCH_SIZE = 500;
