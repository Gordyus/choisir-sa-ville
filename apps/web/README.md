# @csv/web

Angular 20.x (LTS) map POC for cities.

## Local dev

```bash
pnpm -C apps/web dev
```

## Notes
- Configure the API base URL with `VITE_API_BASE_URL` (defaults to `http://localhost:8787`).
- The map loads markers from `/cities/bbox` and details from `/cities/:id`.
- Right panel flow: edit criteria -> results list -> bottom details sheet. UI is in `src/app/features/right-panel/`.
