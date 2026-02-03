# API

Minimal Fastify adapter for local development.

## Build and start

- `pnpm --filter api build`
- `pnpm --filter api start`

## PowerShell env setup

- `$env:DATABASE_URL = "postgres://postgres:postgres@localhost:5432/postgres"`
- Start the API in the same terminal after setting the variable.
- If you change env vars, restart the API process.

## PowerShell checks

- `curl http://localhost:3000/api/health -UseBasicParsing`
- `curl http://localhost:3000/api/version -UseBasicParsing`

## Areas suggest

Endpoint:

- `GET /api/areas/suggest?q=par&limit=5`

PowerShell example:

- `curl "http://localhost:3000/api/areas/suggest?q=par&limit=5" -UseBasicParsing`

Example response:

```json
{
 "items": [
  {
   "id": "75056",
   "type": "commune",
   "label": "Paris",
   "communeCode": "75056",
   "departmentCode": "75",
   "regionCode": "11"
  }
 ]
}
```

## Smoke test (areas suggest)

- `docker compose up -d`
- `pnpm -C packages/db migrate`
- `$env:DATABASE_URL = "postgres://postgres:postgres@localhost:5432/postgres"`
- `pnpm --filter api start`
- `curl "http://localhost:3000/api/areas/suggest?q=par&limit=5" -UseBasicParsing`

Note: results can be empty unless you import data via the importer.
