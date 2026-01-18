# codex-prompts-geocode-pr-by-pr.md
PR-by-PR prompts (copy/paste) for Codex to implement “Destination as address search near search area”
in a hosting-agnostic way (frontend calls our API, backend uses provider adapters + CacheStore).

This plan assumes:
- Travel-time pipeline already exists and consumes destination lat/lng.
- A DisabledTravelProvider may exist; this work is only about GEOCODING destination UX/API.
- You want incremental PRs with small, testable changes.

---

## PR0 — Alignment & guardrails (quick meta PR, optional but recommended)

**Prompt to Codex**
```
Goal: Replace the Destination (lat,lng) input with an address-based destination near the current search area.

Constraints:
- Hosting-agnostic architecture (no Cloudflare-only assumptions).
- Frontend must call our API, not a third-party geocoder directly.
- Geocode results must be biased by current search area (near + bbox when available).
- Add caching policy: geocode TTL max 90 days.
- Keep existing travel-time pipeline unchanged; it still consumes destination lat/lng.

Deliver incrementally with small PRs.
Start with PR1 (geocode-on-apply) then PR2 (autocomplete).
```

**Acceptance**
- Constraints are explicitly documented (in spec/tasks or AGENTS-adjacent docs).
- No functional code changes.

---

## PR1 — Shared DTOs + helpers (pure & testable)

**Prompt to Codex**
```
Create PR1 with shared types/DTOs and pure helper functions.

1) Add DTOs:
- GeocodeRequest:
  { query: string, near?: {lat:number,lng:number}, bbox?: {minLon:number,minLat:number,maxLon:number,maxLat:number}, limit?: number }
- GeocodeCandidate:
  { label: string, lat: number, lng: number, score?: number, source?: string }
- GeocodeResponse:
  { candidates: GeocodeCandidate[] }

2) Add validation schema (zod or equivalent) for GeocodeRequest.
3) Add pure helpers:
- normalizeQuery(query: string) => string (trim, collapse spaces)
- hashBbox(bbox) => string (stable)
- computeNearFromSearchArea(searchArea) => {lat,lng} | undefined
- computeBboxFromSearchArea(searchArea) => bbox | undefined

4) Unit tests:
- normalizeQuery behavior
- bbox hashing stability
- near/bbox derivation on representative searchArea samples
```

**Acceptance**
- DTOs are shared and imported by API + frontend without duplication.
- Helpers are covered by unit tests.
- No runtime feature yet.

---

## PR2 — Cache layer for geocode (agnostic)

**Prompt to Codex**
```
Create PR2 implementing read-through caching for geocoding responses using the existing CacheStore abstraction.
If CacheStore does not exist yet, introduce it as an interface + a reference implementation for this repo stack (per AGENTS.md).

1) CacheStore contract:
- get<T>(key:string): Promise<T|null>
- set<T>(key:string, value:T, ttlSeconds:number): Promise<void>

2) Cache key:
- geocode:v1:{normalizedQuery}:{nearHashOrNone}:{bboxHashOrNone}:{limit}
Where:
- normalizedQuery = normalizeQuery(query).toLowerCase()
- nearHashOrNone can be geohash6(near) or rounded grid string
- bboxHashOrNone = hashBbox(bbox) or 'none'

3) TTL:
- 90 days

4) Implement:
- a small GeocodeCache wrapper:
  - getCachedGeocode(req): GeocodeResponse | null
  - setCachedGeocode(req, resp): void

5) Unit tests:
- key composition
- TTL value applied
```

**Acceptance**
- Cache key is deterministic and includes near/bbox/limit.
- Cache behavior works with mock CacheStore.

---

## PR3 — GeocodeProvider adapter + first provider implementation (no API key)

**Prompt to Codex**
```
Create PR3 implementing a GeocodeProvider adapter and a no-key provider implementation.

1) Create interface:
- GeocodeProvider.geocode(request: GeocodeRequest): Promise<GeocodeResponse>

2) Implement a provider requiring no API key:
Choose ONE:
- Photon (recommended for MVP) OR
- Nominatim (be careful with usage limits)

Provider requirements:
- Support 'near' bias (lat/lng) and 'bbox' bias if the provider supports it.
- Default limit: 5 candidates.
- Timeout: 3–5 seconds.
- Map provider payload => GeocodeCandidate(label, lat, lng, score?, source?).
- If provider fails: throw a typed error or return empty candidates (API must handle gracefully).
- Add minimal unit tests for response mapping using fixture JSON.
```

**Acceptance**
- Provider returns candidates for a normal query.
- Bias parameters are included when provided.

---

## PR4 — API endpoint `/api/geocode` (geocode-on-apply MVP)

**Prompt to Codex**
```
Create PR4 adding the backend API endpoint for geocoding with caching.

Endpoint:
- POST /api/geocode
Body: GeocodeRequest
Return: GeocodeResponse

Implementation details:
1) Validate body.
2) Try cache (read-through).
3) On miss: call GeocodeProvider.geocode().
4) Store result in cache with TTL 90 days.
5) Return response.

Error handling:
- 400 for invalid request
- 502 if provider fails (or return {candidates:[]} with a warning log — pick the simplest consistent pattern used in repo)
- Always log: requestId, cacheHit, providerLatencyMs, candidatesCount (avoid logging full queries)

Tests:
- Contract test: POST with valid query returns schema.
- Test: cache hit path returns without calling provider (mock).
```

**Acceptance**
- API works end-to-end with provider.
- Cache is used.

---

## PR5 — Frontend MVP: address input + geocode on Apply

**Prompt to Codex**
```
Create PR5 updating the UI to use destination address input (no autocomplete yet).

UI changes:
- Replace Destination (lat,lng) input with:
  - Destination address: text input
  - Help text: "Type an address, we’ll locate it near your search area."
- Keep existing Travel Options UX (mode, arrive day/time, apply).

Behavior:
- On "Apply travel":
  1) Derive near/bbox from the current search area (shared helpers).
  2) Call POST /api/geocode with {query, near, bbox, limit: 5}.
  3) If candidates non-empty:
     - select first candidate by default
     - set destination lat/lng in travel state
     - show the resolved label near the input (read-only)
  4) If empty:
     - show a user-friendly error (and do not override previous destination)

Optional:
- If user enters "lat,lng" directly, accept it and skip geocode.

Tests:
- Component unit test for "apply triggers geocode and sets destination"
- Mock API response fixture.
```

**Acceptance**
- User can type an address and travel times populate.
- Clear message when address not found.

---

## PR6 — Autocomplete suggestions (API + UI)

**Prompt to Codex**
```
Create PR6 adding destination autocomplete suggestions.

API:
- Either reuse POST /api/geocode (called on input) or add:
  GET /api/geocode/suggest?q=...&near=...&bbox=...&limit=...
Keep caching policy identical (90d TTL).

Frontend:
- Implement autocomplete dropdown:
  - debounce 250–400ms
  - min 3 characters
  - show 5–8 candidates
  - click selects candidate (sets label + lat/lng)
  - enter selects highlighted
  - escape closes
- If a candidate is already selected, "Apply travel" does NOT call geocode again.

Anti-stale:
- Cancel previous request or ignore by requestId.
- Do not overwrite a newer selection with an older response.

Tests:
- Unit test selection sets destination.
- Basic anti-stale coverage.
```

**Acceptance**
- Suggestions appear and are biased to search area.
- Selecting a suggestion immediately sets destination.

---

## PR7 — Hardening: limits, observability, docs

**Prompt to Codex**
```
Create PR7 for hardening and documentation.

Backend:
- Enforce limits:
  - query max length (e.g. 200)
  - limit range 1..10
- Improve error codes/messages (consistent)
- Add structured logs for geocode:
  - requestId, cacheHit, latency, candidatesCount, hasNear, hasBbox

Frontend:
- Better empty/error states
- Ensure travel feature remains usable if geocode provider is down (no crash)

Docs:
- Update spec/tasks to include geocode endpoints and caching policy.
- Document env vars for geocoder provider base URL.
```

**Acceptance**
- Robust under bad inputs and provider failures.
- Docs updated and accurate.

---

## Keep these decisions consistent

- **Biasing**: Always pass `near` and `bbox` when available.
- **Privacy**: Avoid logging full address queries (log query length + hashed query if needed).
- **Caching**: Geocode TTL max 90 days, no active invalidation required.
- **Hosting-agnostic**: Provider and cache are behind interfaces.
