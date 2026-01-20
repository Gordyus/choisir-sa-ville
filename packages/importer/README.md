# Importer data sources

This package uses offline datasets to keep imports deterministic and avoid runtime network calls.

## Offline commune coordinates

- Source file: `data/sources/admin-express-communes.csv`
- Current origin: "communes-departement-region" (postal base) snapshot dated 2023-08-23,
  stored locally and treated as an offline commune coordinate source.
- Generated file: `data/coords/communes-centroid.csv`

Regenerate the centroid file after updating the source:

```sh
pnpm -C packages/importer gen:communes-centroid
```

The generated file is committed so the importer can run without HTTP access.
If the source has missing coordinates, the generator derives them from department
centroids, then from a global centroid as a last resort (with warnings).
