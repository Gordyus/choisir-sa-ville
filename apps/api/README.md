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
