# Local development

## Setup
```bash
cp .env.example .env
pnpm install
docker compose up -d
pnpm db:migrate
pnpm dev
```

## Verify
- API: `GET /health`
- City search: `GET /cities?q=par&limit=10`

## Reset database (dev only)
```bash
pnpm db:reset
pnpm db:migrate
```
