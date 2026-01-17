# Import INSEE Communes and Infra Zones

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

Import INSEE communes + infra zones:

```bash
pnpm -C packages/importer import:insee
```

Optional flags:

```bash
pnpm -C packages/importer import:insee --source <url> --force --limit 1000 --dry-run
pnpm -C packages/importer import:insee --include-infra false
pnpm -C packages/importer import:insee --only-type COM
pnpm -C packages/importer import:insee --only-type ARM
```

## Import Order
- The importer always loads communes (COM) first.
- Infra zones (ARM, COMD, COMA) are imported after communes, so parents exist.
- `--limit` applies per phase (communes and infra zones).

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

## Verify in DB

```sql
select count(*) from commune;
select type, count(*) from infra_zone group by type order by type;
select * from infra_zone where parentCommuneCode = '75056' limit 5;
```

## Expected Logs

```text
Downloading https://www.insee.fr/fr/statistiques/fichier/8377162/v_commune_2025.csv
Commune pass: 1000 rows (selected 1000, written 1000, skipped 0, ignored 0)
Commune pass done. Rows: 35000. Selected: 35000. Written: 35000. Skipped: 12. Ignored: 0.
Infra pass: 1000 rows (selected 1000, written 1000, skipped 0, missingParent 0, ignored 34000)
Infra pass done. Rows: 35000. Selected: 45. Written: 45. Skipped: 0. Missing parent: 0. Ignored: 34955.
```
