# Testing Navitia Provider

## Step 1: Get API Token

1. Go to https://numerique.sncf.com/startup/api/
2. Sign up (free, instant)
3. Navigate to "Mes APIs" → "Navitia"
4. Copy your token (format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

## Step 2: Configure .env

```bash
# apps/api/.env
ROUTING_PROVIDER=navitia
NAVITIA_API_KEY=your_token_here
PORT=3005
```

## Step 3: Test

### Start server
```bash
cd apps/api
pnpm dev
```

### Test Montpellier → Paris
```bash
# PowerShell
$body = @{
  origins=@(@{lat=43.6108;lng=3.8767})
  destinations=@(@{lat=48.8566;lng=2.3522})
  departureTime='2026-03-15T08:30:00Z'
  mode='car'
} | ConvertTo-Json -Compress

$result = Invoke-RestMethod -Method Post `
  -Uri 'http://localhost:3005/api/routing/matrix' `
  -Body $body `
  -ContentType 'application/json'

Write-Host "Duration: $($result.durations[0][0]) seconds"
Write-Host "Distance: $($result.distances[0][0]) meters"
Write-Host "Route points: $($result.routes[0][0].points.Count)"
Write-Host "Provider: Navitia"
```

### Expected result
```
Duration: ~23000-27000 seconds (6-7.5 hours)
Distance: ~740000-750000 meters (740-750 km)
Route points: ~8000-10000 points
Provider: Navitia
```

### Compare with TomTom

Change `.env`:
```bash
ROUTING_PROVIDER=tomtom
TOMTOM_API_KEY=BeuSpo61zvvixmSFkNDSMOzHGc61hEB3
```

Restart and re-run same test → should get similar durations/distances but potentially different routes.

## Step 4: Validate

✅ Both providers should return:
- Similar travel times (±10%)
- Similar distances (±5%)
- Different but valid route geometries
- `fromCache: false` on first call

## Troubleshooting

**401 Unauthorized:**
- Token invalid or expired → regenerate on SNCF portal

**404 Not Found:**
- Coverage zone issue → try changing `defaultCoverage` in NavitiaProvider.ts

**Timeout (>15s):**
- Navitia can be slow for long-distance routes
- Increase timeout in NavitiaProvider.ts line 42

**Empty geometry:**
- Check `sections[].geojson` exists in API response
- Fallback should provide straight line origin→destination
