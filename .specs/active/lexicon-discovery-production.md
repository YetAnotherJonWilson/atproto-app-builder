# Spec: Lexicon Discovery — Production Fixes & Browse Enhancements

**Status:** in-progress
**Date:** 2026-04-01

## What

Fix lexicon search and browse so they work in production (currently broken), switch the LexiStats integration to the richer `/api/v1/lexicon-meta` endpoint, enhance the Popular tab with category filtering and pagination, and merge LexiStats data into the Search tab so search is more resilient and informative.

## Why

Three problems:

1. **Search and browse are broken in production.** Both `LexiconDiscovery` and `LexiStats` services use relative paths (`/lexicon-garden/...` and `/lexistats/...`) that are handled by Vite's dev proxy but fall through to static asset serving (404) in the production Cloudflare Worker. The fix is different for each:
   - **Lexicon Garden** serves no CORS headers, so the browser cannot call it directly. It must be proxied through the Cloudflare Worker.
   - **LexiStats** serves `access-control-allow-origin: *`, so the browser can call it directly. The fix is to use the full URL instead of relying on a proxy.

2. **The Popular tab is functional but minimal.** It shows 50 lexicons in a fixed order with no filtering or pagination. Users can't narrow down by category, making it hard to find relevant lexicons in a list of hundreds. It also uses the `/api/v1/lexicons` endpoint (228 items, limited metadata) when the richer `/api/v1/lexicon-meta` endpoint (573 items, includes `schema_type`, `has_schema`, `tags`) is available.

3. **Search relies solely on Lexicon Garden.** When Lexicon Garden is down, search is completely broken. LexiStats data could serve as a fallback, and usage stats could enrich search results to help users judge relevance.

## Prior Work

The LexiStats "Popular" tab was added in PR #9 and is already merged. The following already exists:

- `src/app/services/LexiStats.ts` — API client fetching from `/lexistats/api/v1/lexicons`, with `LexiStatEntry` interface
- `src/app/views/panels/DataPanel.ts` — Search/Popular tab toggle, popular list rendering with NSID/description/category/stats, click-to-resolve via `resolveLexicon`, error handling, loading state, in-memory caching
- `styles/workspace/data-detail.css` — CSS for `.browse-tab`, `.popular-result-item`, `.popular-result-desc`, `.popular-result-stats`
- `vite.config.ts` — Dev proxy for `/lexistats` → `https://lexistats.linkedtrust.us`

## Acceptance Criteria

### Production fixes

- [x] **Lexicon Garden search works in production**
  - The Cloudflare Worker proxies all `/lexicon-garden/*` requests to `https://lexicon.garden/*`
  - Request path rewriting strips the `/lexicon-garden` prefix (matching the Vite dev proxy behavior)
  - The proxy adds CORS response headers so the browser permits the response
  - If Lexicon Garden is unreachable, the Worker returns a 502 with a JSON error body (not an HTML error page)

- [x] **LexiStats works in production**
  - The LexiStats service calls `https://lexistats.linkedtrust.us/api/v1/lexicon-meta` directly instead of using the relative `/lexistats` path
  - This works because LexiStats serves `access-control-allow-origin: *` (confirmed 2026-04-01)
  - The Vite dev proxy for `/lexistats` is removed (no longer needed)

- [ ] **Production verification**
  - After deploying, verify on `thelexfiles.com`: search returns results, Popular tab loads lexicons, schema resolution works when clicking a result
  - Verify with DevTools Network tab that requests go to the correct endpoints and return valid JSON

### Endpoint upgrade

- [x] **Switch from `/api/v1/lexicons` to `/api/v1/lexicon-meta`**
  - Update `LexiStats.ts` to fetch from `https://lexistats.linkedtrust.us/api/v1/lexicon-meta`
  - Update the `LexiStatEntry` interface to include the additional fields: `schema_type`, `tags`, `has_schema`, `has_example`, `total_events`, `first_seen`, `last_seen`, `authority`, `lexicon_url`
  - The catalog grows from 228 to 573 lexicons; client-side filtering handles the larger set

### Browse enhancements (Popular tab)

- [x] **Record-type filtering**
  - The Popular tab only shows lexicons with `schema_type === "record"`
  - This filters the list from 573 to ~243 adoptable lexicons
  - Lexicons with `null` schema_type (no published schema) are excluded

- [x] **`has_schema` indicator**
  - Lexicons where `has_schema === false` show a visual indicator (e.g., muted styling or a small badge) that schema resolution may fail
  - When a user clicks such a lexicon and resolution fails, the error message is: "Schema not publicly available for [nsid]. The author hasn't published it yet." (already implemented)

- [x] **Category filtering**
  - Category pill/chip buttons appear above the popular list, dynamically extracted from the visible (record-type) lexicons
  - Each pill shows the category name and count of lexicons in that category
  - Clicking a pill filters the list to that category; clicking again clears the filter
  - Only one category can be active at a time

- [x] **Sort options**
  - A sort dropdown or toggle appears near the category pills
  - Options: most active users (7d) (default), most total events, alphabetical by NSID
  - Changing sort re-orders the visible list immediately (client-side, from cached data)

- [x] **Pagination**
  - Initially show 20 results
  - A "Show more" button at the bottom loads the next 20
  - Category and sort state are preserved across "Show more" clicks
  - The button disappears when all matching results are shown

### Search enhancements

- [x] **Search merges results from both sources**
  - When the user types a search query, both Lexicon Garden and LexiStats are queried
  - Lexicon Garden is queried via the existing `searchLexicons()` API call
  - LexiStats is queried via client-side filtering of the cached catalog (matching against `nsid`, `description`, and `tags`)
  - Results are merged and deduplicated by NSID (case-insensitive)
  - Lexicon Garden results appear first, followed by any additional LexiStats-only matches
  - If Lexicon Garden fails, LexiStats results are shown alone (no error state unless both fail)
  - If LexiStats hasn't loaded yet (catalog not cached), Lexicon Garden results are shown alone (current behavior, no degradation)

- [x] **Search results show usage stats**
  - Each search result displays the NSID (as today) plus usage stats when available from LexiStats: unique users (7d) and/or total events
  - Results without LexiStats data show no stats (no placeholder or "unknown")
  - The "via Lexicon Garden" source label is removed or replaced with usage stats

- [x] **Search fallback when Lexicon Garden is down**
  - If Lexicon Garden returns an error but LexiStats catalog is cached, search results come from LexiStats client-side filtering only
  - No error banner is shown — the fallback is seamless to the user
  - If both Lexicon Garden fails and LexiStats catalog is not cached, the existing error message is shown: "Search unavailable. You can enter an NSID directly below."

### Tests

- [x] **LexiStats service has tests**
  - Tests in `tests/services/LexiStats.test.ts`
  - Covers: successful fetch, API error handling, empty/malformed response handling, client-side search/filter logic

## Scope

**In scope:**
- Cloudflare Worker proxy route for Lexicon Garden
- LexiStats production fix (switch to direct URL) and endpoint upgrade to `/api/v1/lexicon-meta`
- Remove Vite dev proxy for `/lexistats`
- Record-type filtering and `has_schema` indicator on Popular tab
- Category filter UI and client-side filtering logic
- Sort controls and client-side sorting logic
- Pagination ("Show more") for popular results
- Merged search (Lexicon Garden + LexiStats) with dedup and fallback
- Usage stats on search results
- Tests for LexiStats service
- Production verification

**Out of scope:**
- Replacing Lexicon Garden for schema resolution — LG remains the schema authority
- LexiStats inferred schemas for the adopt flow
- Caching improvements beyond the existing in-memory cache (fetch once per session)
- Per-lexicon detail pages or usage history charts

## Files Likely Affected

- `worker/index.ts` — add proxy route for Lexicon Garden
- `src/app/services/LexiStats.ts` — switch to direct URL, new endpoint, expanded interface, add client-side search function
- `src/app/views/panels/DataPanel.ts` — category filter UI, sort controls, pagination, merged search logic, usage stats display
- `src/app/services/LexiconDiscovery.ts` — no changes (search and resolve stay as-is)
- `styles/workspace/data-detail.css` — styles for category pills, sort dropdown, show-more button, has_schema indicator
- `vite.config.ts` — remove `/lexistats` proxy
- `tests/services/LexiStats.test.ts` — new file

## Integration Boundaries

### Cloudflare Worker (modified)
- **Data flowing in:** Proxied requests from the browser to Lexicon Garden
- **Data flowing out:** Forwarded responses with CORS headers added
- **Expected contract:** Transparent proxy — same request/response as calling Lexicon Garden directly, with CORS headers injected. All paths under `/lexicon-garden/*` are forwarded.
- **Unavailability:** If Lexicon Garden is down, the Worker forwards the upstream error status. The browser-side code handles errors as today.

### LexiStats API (upgraded endpoint)
- **Endpoint:** `GET https://lexistats.linkedtrust.us/api/v1/lexicon-meta`
- **CORS:** `access-control-allow-origin: *` (confirmed 2026-04-01)
- **Response shape:** `{ lexicons: Array<{ nsid, authority, domain, description, category, tags, schema_type, lexicon_url, total_events, unique_users_7d, first_seen, last_seen, has_schema, has_example, spidered }> }`
- **Size:** ~242KB, 573 lexicons (243 records, 330 with null schema_type)
- **Unavailability:** Popular tab shows "Could not load popular lexicons. Try searching instead." Search falls back to Lexicon Garden only.

### Lexicon Garden (existing, needs production proxy)
- **Endpoints:** `GET /api/autocomplete-nsid?q=...`, `GET /xrpc/com.atproto.lexicon.resolveLexicon?nsid=...`
- **CORS:** None (confirmed 2026-04-01 — no `access-control-allow-origin` header)
- **Unavailability:** Search falls back to LexiStats client-side filtering. Schema resolution shows inline error.

## Behavioral Scenarios

**Scenario: Search works in production**
- Setup: App is deployed to thelexfiles.com
- Action: User opens Data panel, clicks "Use existing", types "feed" in search
- Expected outcome: Search results appear from Lexicon Garden (proxied through Worker), enriched with usage stats from LexiStats where available. Clicking a result resolves the schema and shows the adopt flow.

**Scenario: Popular tab works in production**
- Setup: App is deployed to thelexfiles.com
- Action: User clicks "Popular" tab
- Expected outcome: Lexicons load from LexiStats, filtered to records only. Clicking a lexicon resolves its schema via the Lexicon Garden proxy.

**Scenario: Search with both services available**
- Setup: Both Lexicon Garden and LexiStats are reachable, catalog is cached
- Action: User types "feed" in the search box
- Expected outcome: Results from both sources appear, deduplicated. Lexicon Garden results listed first, followed by LexiStats-only matches. Each result shows usage stats if LexiStats has data.

**Scenario: Search with Lexicon Garden down**
- Setup: Lexicon Garden returns errors, LexiStats catalog is cached
- Action: User types "feed" in the search box
- Expected outcome: Results appear from LexiStats only (client-side filtered from cached catalog). No error banner — fallback is seamless. Results include usage stats.

**Scenario: Search with LexiStats not yet loaded**
- Setup: User searches before clicking the Popular tab (catalog not cached)
- Action: User types "feed" in the search box
- Expected outcome: Results appear from Lexicon Garden only, without usage stats. Identical to today's behavior.

**Scenario: Both services down**
- Setup: Lexicon Garden returns errors, LexiStats catalog not cached
- Action: User types "feed"
- Expected outcome: Error message: "Search unavailable. You can enter an NSID directly below." Manual NSID lookup still works if resolution recovers.

**Scenario: User filters by category**
- Setup: Popular tab is loaded with lexicons
- Action: User clicks the "social" category pill
- Expected outcome: List filters to show only "social" lexicons. The pill appears selected. Clicking it again clears the filter and shows all lexicons.

**Scenario: User changes sort order**
- Setup: Popular tab is loaded, possibly filtered by category
- Action: User changes sort from "most users" to "alphabetical"
- Expected outcome: List re-orders immediately. Category filter (if active) is preserved.

**Scenario: User paginates through results**
- Setup: Popular tab shows first 20 results
- Action: User clicks "Show more"
- Expected outcome: Next 20 results appear below the existing ones. "Show more" button moves to the bottom. Button disappears when all results are shown.

**Scenario: User clicks a lexicon without a published schema**
- Setup: Popular tab shows a lexicon with `has_schema === false` (visually indicated)
- Action: User clicks it
- Expected outcome: Schema resolution is attempted via Lexicon Garden. If it fails, error reads: "Schema not publicly available for [nsid]. The author hasn't published it yet."

**Scenario: Lexicon Garden down, Popular tab still works**
- Setup: Lexicon Garden is unreachable, LexiStats is up
- Action: User clicks "Popular" tab, browses lexicons
- Expected outcome: Popular list loads normally. Clicking a lexicon fails to resolve schema (Lexicon Garden is down) — error message shown. Search shows LexiStats-only results if catalog is cached.

## How to Verify

1. **Production search:** Deploy to thelexfiles.com → Data panel → "Use existing" → search for "feed" → results appear with usage stats → click one → schema preview loads
2. **Production popular:** Click "Popular" tab → lexicons load (records only) → click one → schema resolves
3. **Merged search:** Search for a term → verify results from both sources appear, deduplicated, with Lexicon Garden results first
4. **Search fallback:** Block Lexicon Garden in DevTools → search still works via LexiStats → unblock, block LexiStats → search still works via Lexicon Garden
5. **Category filter:** In Popular tab, click a category pill → list filters → click again → clears
6. **Sort:** Change sort order → list re-orders → category filter preserved
7. **Pagination:** Scroll to bottom of Popular list → "Show more" → more results appear → eventually button disappears
8. **has_schema indicator:** Find a lexicon marked as no-schema → click it → informative error message
9. **Build:** `npm run build` passes
10. **Tests:** `npx vitest run` passes
