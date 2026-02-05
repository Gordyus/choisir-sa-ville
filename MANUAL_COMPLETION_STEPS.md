# Manual Completion Steps

Due to tool limitations, some steps require manual completion. Follow these steps:

## Option 1: Run the automated script (Recommended)

### On Windows:
```cmd
complete-tileserver-implementation.bat
```

### On Linux/Mac:
```bash
chmod +x complete-tileserver-implementation.sh
./complete-tileserver-implementation.sh
```

## Option 2: Manual steps

### Step 1: Create directory structure
```bash
mkdir -p apps/web/app/api/config/map-tiles
```

Or on Windows:
```cmd
mkdir apps\web\app\api\config\map-tiles
```

### Step 2: Create the API route file

Create `apps/web/app/api/config/map-tiles/route.ts` with the content from the report file (section 2).

Alternatively, copy from this location:
The full TypeScript code is documented in:
- `doc/2025-01-15T17-30-tileserver-env-var-implementation.md` (section 2)

### Step 3: Delete deprecated file

```bash
rm apps/web/public/config/map-tiles.json
```

Or on Windows:
```cmd
del apps\web\public\config\map-tiles.json
```

### Step 4: Run validation

```bash
pnpm typecheck
pnpm lint:eslint
```

Both commands should complete with 0 errors/warnings.

### Step 5: Test the implementation

```bash
pnpm dev
```

Then:
1. Visit http://localhost:3000/api/config/map-tiles (or your dev server port)
2. Verify valid JSON is returned with URLs containing `http://localhost:8080`
3. Open the application and verify the map loads correctly

## Troubleshooting

### Map doesn't load
- Check browser console for errors
- Verify `NEXT_PUBLIC_TILESERVER_BASE_URL` is set in `.env`
- Ensure tileserver is running on localhost:8080

### API returns 500 error
- Check server console for error message
- Verify environment variable is correctly set
- Restart dev server after changing `.env` file

### TypeScript errors
- Make sure the route.ts file was created with the exact content from the report
- Run `pnpm install` to ensure dependencies are up to date
- Check for any typos in the copied code
