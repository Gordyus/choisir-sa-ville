# Tileserver URL Environment Variable Implementation

**Date**: 2025-01-15T17:30  
**Type**: New feature  
**Agent**: copilot-minor-medium-developer

## Task

Implement tileserver URL management via environment variables by replacing hardcoded `localhost:8080` URLs with `NEXT_PUBLIC_TILESERVER_BASE_URL` env var injection.

## What was done

### 1. ✅ Modified `apps/web/lib/config/mapTilesConfig.ts`
Changed line 51 to point to the new API endpoint:
```typescript
const url = "/api/config/map-tiles"; // Changed from "/config/map-tiles.json"
```
No other changes made to preserve existing validation logic.

### 2. ⚠️ Created API Route `apps/web/app/api/config/map-tiles/route.ts`
**ACTION REQUIRED**: Due to tool limitations, the directory structure must be created manually.

**Steps to complete**:
1. Create directory: `apps/web/app/api/config/map-tiles/`
2. Create file `route.ts` with the following content:

```typescript
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type TileJsonSources = {
    france: string;
    communes: string;
    arr_municipal: string;
};

type PolygonSource = {
    tileJsonUrl: string;
    sourceLayer: string;
};

type PolygonSources = {
    communes: PolygonSource;
    arr_municipal: PolygonSource;
};

type CityLabelStyle = {
    textColor: string;
    highlightTextColor: string;
    activeTextColor: string;
    textHaloColor: string;
    highlightTextHaloColor: string;
    activeTextHaloColor: string;
    textHaloWidth: number;
    highlightTextHaloWidth: number;
    activeTextHaloWidth: number;
};

type MapTilesConfigResponse = {
    styleUrl: string;
    tileJsonSources: TileJsonSources;
    cityClasses: string[];
    polygonSources: PolygonSources;
    interactableLabelLayerId: string;
    cityLabelStyle: CityLabelStyle;
};

function validateTileserverUrl(url: string | undefined): string | null {
    if (!url || typeof url !== "string") {
        return null;
    }
    const trimmed = url.trim();
    if (trimmed.length === 0) {
        return null;
    }
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
        return null;
    }
    return trimmed;
}

export async function GET(): Promise<NextResponse> {
    const baseUrl = validateTileserverUrl(process.env.NEXT_PUBLIC_TILESERVER_BASE_URL);

    if (!baseUrl) {
        console.error(
            "[api/config/map-tiles] NEXT_PUBLIC_TILESERVER_BASE_URL is missing or invalid. " +
            "Expected a valid URL starting with http:// or https://. " +
            `Received: ${process.env.NEXT_PUBLIC_TILESERVER_BASE_URL ?? "(undefined)"}`
        );
        return NextResponse.json(
            { error: "Tileserver configuration is missing or invalid" },
            { status: 500 }
        );
    }

    // polygonSources is the source of truth
    const polygonSources: PolygonSources = {
        communes: {
            tileJsonUrl: `${baseUrl}/data/communes.json`,
            sourceLayer: "communes"
        },
        arr_municipal: {
            tileJsonUrl: `${baseUrl}/data/arr_municipal.json`,
            sourceLayer: "arr_municipal"
        }
    };

    // Derive tileJsonSources from polygonSources to eliminate duplication
    const tileJsonSources: TileJsonSources = {
        france: `${baseUrl}/data/france.json`,
        communes: polygonSources.communes.tileJsonUrl,
        arr_municipal: polygonSources.arr_municipal.tileJsonUrl
    };

    const config: MapTilesConfigResponse = {
        styleUrl: `${baseUrl}/styles/basic/style.json`,
        tileJsonSources,
        cityClasses: ["city", "town", "village", "suburb"],
        polygonSources,
        interactableLabelLayerId: "place_label_interractable",
        cityLabelStyle: {
            textColor: "#111827",
            highlightTextColor: "#2563eb",
            activeTextColor: "#f59e0b",
            textHaloColor: "#ffffff",
            highlightTextHaloColor: "#ffffff",
            activeTextHaloColor: "#ffffff",
            textHaloWidth: 2.8,
            highlightTextHaloWidth: 3.6,
            activeTextHaloWidth: 4.2
        }
    };

    const cacheControl =
        process.env.NODE_ENV === "production"
            ? "public, max-age=3600, s-maxage=3600"
            : "no-store";

    return NextResponse.json(config, {
        headers: {
            "Cache-Control": cacheControl
        }
    });
}
```

**Implementation highlights**:
- ✅ Marked with `export const dynamic = "force-dynamic"` to prevent Next.js caching
- ✅ Strict URL validation (checks for http:// or https:// prefix)
- ✅ Clear error logging with console.error on validation failure
- ✅ Returns 500 status on missing/invalid env var
- ✅ `polygonSources` is the source of truth
- ✅ `tileJsonSources` automatically derived from `polygonSources` to eliminate duplication
- ✅ Cache-Control headers: production = 3600s, dev = no-store
- ✅ TypeScript strict mode compliant (no `any` types)

### 3. ✅ Created `.example.json` file
- Created `apps/web/public/config/map-tiles.example.json` with deprecation comment
- ⚠️ **ACTION REQUIRED**: Manually delete `apps/web/public/config/map-tiles.json` (cannot be done via available tools)

### 4. ✅ Updated `.env.example`
Added comprehensive documentation for `NEXT_PUBLIC_TILESERVER_BASE_URL`:
```bash
# Tileserver base URL (required for map tiles)
# Development: http://localhost:8080
# Production: replace with your actual tileserver domain (e.g., https://tiles.example.com)
NEXT_PUBLIC_TILESERVER_BASE_URL=http://localhost:8080
```

### 5. ✅ Updated `.env`
Added `NEXT_PUBLIC_TILESERVER_BASE_URL=http://localhost:8080` to local environment file for immediate use.

## Files modified/created

| File | Status | Description |
|------|--------|-------------|
| `apps/web/lib/config/mapTilesConfig.ts` | ✅ Modified | Changed URL from static JSON to API endpoint (line 51 only) |
| `apps/web/app/api/config/map-tiles/route.ts` | ⚠️ Needs manual creation | Dynamic API route with env var injection and validation |
| `apps/web/public/config/map-tiles.example.json` | ✅ Created | Deprecated example file with warning comment |
| `.env.example` | ✅ Modified | Added `NEXT_PUBLIC_TILESERVER_BASE_URL` documentation |
| `.env` | ✅ Modified | Added `NEXT_PUBLIC_TILESERVER_BASE_URL` for local dev |

## Manual steps required

1. **Create API route directory and file**:
   ```bash
   mkdir -p apps/web/app/api/config/map-tiles
   # Then create route.ts with content provided above
   ```

2. **Delete deprecated JSON file**:
   ```bash
   rm apps/web/public/config/map-tiles.json
   ```

3. **Run validation**:
   ```bash
   pnpm typecheck  # Must pass with 0 errors
   pnpm lint:eslint  # Must pass with 0 warnings
   ```

## Validation (post manual steps)

After completing manual steps, validation should be performed:

### TypeScript Check
```bash
pnpm typecheck
```
Expected: ✅ 0 errors

### ESLint Check
```bash
pnpm lint:eslint
```
Expected: ✅ 0 warnings

## Manual Testing Checklist

After completing manual steps:

1. **Start development server**:
   ```bash
   pnpm dev
   ```

2. **Test API endpoint**:
   - Navigate to `http://localhost:3000/api/config/map-tiles` (or appropriate port)
   - Should return valid JSON with URLs containing `http://localhost:8080`
   - Verify `tileJsonSources` URLs match `polygonSources` URLs (no duplication)

3. **Test map rendering**:
   - Open the application in browser
   - Map should load correctly with tiles from tileserver
   - No console errors related to tile loading

4. **Test error case**:
   - Stop the dev server
   - Temporarily remove or comment out `NEXT_PUBLIC_TILESERVER_BASE_URL` from `.env`
   - Restart `pnpm dev`
   - Visit `/api/config/map-tiles`
   - Should see 500 error with clear console.error message
   - Restore the env var and restart

5. **Test cache headers**:
   - Dev mode: Response should have `Cache-Control: no-store`
   - Build for production (`pnpm build`) and test: Should have `Cache-Control: public, max-age=3600, s-maxage=3600`

## Notes

### Design Decisions
- **Single source of truth**: `polygonSources` is authoritative; `tileJsonSources` is derived to ensure consistency
- **Strict validation**: URL must start with `http://` or `https://` to catch common config errors early
- **Clear error messages**: Console.error provides exact env var name and expected format
- **No fallback**: Explicit 500 error instead of silent fallback to ensure configuration issues are immediately visible

### Edge Cases Handled
- Empty string env var → validation fails
- Whitespace-only env var → trimmed and validated
- Missing env var (undefined) → validation fails
- Invalid URL format (no protocol) → validation fails

### Constraints Respected
- ✅ No architectural changes
- ✅ No refactoring beyond scope
- ✅ Layer boundaries respected (config layer only)
- ✅ Immutable data patterns preserved
- ✅ TypeScript strict mode (no `any`)
- ✅ camelCase everywhere
- ✅ Minimal changes to existing code

## Known Limitations

- Tool limitations prevented automatic creation of nested directories
- Manual file deletion required for deprecated `map-tiles.json`
- Validation commands not run yet (require manual completion first)

## Next Steps

1. Complete manual steps listed above
2. Run validation commands
3. Perform manual testing checklist
4. If all tests pass, feature is complete
