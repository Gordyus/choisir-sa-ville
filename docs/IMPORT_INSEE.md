# Import INSEE Communes, Infra Zones, and Enrichments

## Prerequisites
- Node.js 20+
- PostgreSQL running via docker-compose
- `.env` at repo root with `DATABASE_URL`
- Migrations applied

## Commands

Run migrations:

```bash
pnpm db:migrate
```

Import INSEE regions, departments, communes, infra zones, and postal codes:

```bash
pnpm -C packages/importer import:insee
```

Optional flags:

```bash
pnpm -C packages/importer import:insee --source <url> --region-source <url> --department-source <url> --postal-source <url> --force --limit 1000 --dry-run
pnpm -C packages/importer import:insee --include-infra false
pnpm -C packages/importer import:insee --only-type COM
pnpm -C packages/importer import:insee --only-type ARM
pnpm -C packages/importer import:insee --skip-postal
pnpm -C packages/importer import:insee --postal-limit 5000
```

## Import Order
- Regions, then departments.
- Communes (COM).
- Infra zones (ARM, COMD, COMA) after communes, so parents exist.
- Postal codes (commune -> postalCode).
- `--limit` applies per phase.
- `--postal-limit` applies only to the postal code import phase.
- Slugs are generated deterministically from names + codes during import.

## Sources (Defaults)
AUTHORITATIVE (INSEE COG):
- Regions: `https://www.insee.fr/fr/statistiques/fichier/8377162/v_region_2025.csv`
- Departments: `https://www.insee.fr/fr/statistiques/fichier/8377162/v_departement_2025.csv`
- Communes + infra zones: `https://www.insee.fr/fr/statistiques/fichier/8377162/v_commune_2025.csv`

NON-AUTHORITATIVE / AUXILIARY:
- Postal codes: `https://static.data.gouv.fr/resources/communes-de-france-base-des-codes-postaux/20241113-073516/20230823-communes-departement-region.csv`
  (replaceable via `--postal-source`)

Note: INSEE COG does not provide a simple, stable commune -> postal mapping
file for MVP needs. Postal codes can be 1..n per commune.
The data.gouv postal source uses non-padded numeric codes, so the importer
normalizes commune and postal codes with `padStart(5, "0")`.

## Cache
Downloads are cached in `packages/importer/.cache`. Use `--force` to redownload.

## Reset and Reimport

```bash
pnpm db:reset
pnpm db:migrate
pnpm -C packages/importer import:insee --force
```

## Expected Counts (Approx)
- Communes (COM): ~35k
- Infra zones: depends on year and availability (ARM, COMD, COMA vary)
- Regions: 18
- Departments: 101
- Postal codes: multiple per commune (varies)

## Verify in DB

```sql
select count(*) from commune;
select count(*) from region;
select count(*) from department;
select count(*) from commune_postal_code;
select type, count(*) from infra_zone group by type order by type;
select slug from commune where inseeCode = '75056';
select slug from infra_zone where code = '75111';
select * from commune_postal_code where communeCode = '75056' limit 20;
select * from infra_zone where parentCommuneCode = '75056' limit 5;
```

## Expected Logs

```text
Downloading https://www.insee.fr/fr/statistiques/fichier/8377162/v_region_2025.csv
Region pass: 1000 rows (selected 18, written 18, skipped 0)
Region pass done. Rows: 18. Selected: 18. Written: 18. Skipped: 0.
Downloading https://www.insee.fr/fr/statistiques/fichier/8377162/v_departement_2025.csv
Department pass: 1000 rows (selected 101, written 101, skipped 0)
Department pass done. Rows: 101. Selected: 101. Written: 101. Skipped: 0.
Downloading https://www.insee.fr/fr/statistiques/fichier/8377162/v_commune_2025.csv
Commune pass: 1000 rows (selected 1000, written 1000, skipped 0, ignored 0)
Commune pass done. Rows: 35000. Selected: 35000. Written: 35000. Skipped: 12. Ignored: 0.
Infra pass: 1000 rows (selected 1000, written 1000, skipped 0, missingParent 0, ignored 34000)
Infra pass done. Rows: 35000. Selected: 45. Written: 45. Skipped: 0. Missing parent: 0. Ignored: 34955.
Downloading https://static.data.gouv.fr/resources/communes-de-france-base-des-codes-postaux/20241113-073516/20230823-communes-departement-region.csv
Postal pass: 50000 rows (valid 50000, unique 50000, skipped 0, batchDup 0)
Postal pass done. Rows: 39000. Valid pairs: 39000. Unique pairs: 39000. Attempted inserts: 39000. Skipped: 0. Batch duplicates: 0.
Postal skip reasons (top 5): missing_commune=0, invalid_commune=0, unknown_commune=0, missing_postal=0, invalid_postal=0
Postal inserted pairs: 39000
```
