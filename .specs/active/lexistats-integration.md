# Spec: LexiStats Integration

**Status:** draft
**Date:** 2026-03-27

## What

Integrate LexiStats (lexistats.linkedtrust.us) into the lexicon picker within the Data Panel. This adds three capabilities: (1) merge LexiStats results into the existing search so it surfaces lexicons Lexicon Garden might miss, and serves as a fallback when Lexicon Garden is down, (2) enrich all search results with usage stats from LexiStats, and (3) add a new browsable catalog of lexicons powered by LexiStats categories and sorting.

## Why

The current lexicon picker relies solely on Lexicon Garden for search. This has two problems:

1. **Discovery gap** — users who don't know what to search for have no way to browse or explore. There's no category filtering, no popularity ranking, and no way to tell if a lexicon is actively used or abandoned.
2. **Single point of failure** — when Lexicon Garden is down (as observed today), search is completely broken and the only option is manual NSID entry.

LexiStats provides a catalog of 450+ lexicons with real usage data (weekly active users, total events), categories, and example records. Integrating it addresses both problems while keeping Lexicon Garden as the authoritative source for full schema resolution.

## Acceptance Criteria

- [ ] **A new LexiStats API client exists** alongside the existing LexiconDiscovery service
  - Fetches and caches the full lexicon catalog from `/api/v1/lexicon-meta`
  - Fetches individual lexicon details from `/api/v1/lexicon-meta/{nsid}`
  - Handles API unavailability gracefully (search and browse degrade but don't break)

- [ ] **Search merges results from both sources**
  - When the user types a search query, both Lexicon Garden and LexiStats are queried
  - Results are merged and deduplicated by NSID
  - Lexicon Garden results appear first, followed by any additional LexiStats-only matches
  - If Lexicon Garden fails, LexiStats results are shown alone (no error state unless both fail)
  - If LexiStats fails, Lexicon Garden results are shown alone (current behavior, no degradation)

- [ ] **Search results show usage stats**
  - Each search result item displays the NSID (as today) plus usage stats when available from LexiStats: weekly active users and/or total events
  - Results without LexiStats data show no stats (no placeholder or "unknown")
  - The source label changes from "via Lexicon Garden" to reflect actual source(s)

- [ ] **A "Browse" mode lets users explore lexicons without a search query**
  - The browse UI has two sub-modes, toggled via tabs or similar control: "Search" (current behavior, enhanced) and "Browse" (new)
  - Browse mode shows a filterable, sortable list of lexicons from LexiStats
  - Category filter: pill/chip buttons for each category (social, identity, gaming, etc.) with lexicon counts; clicking a category filters the list; clicking again clears the filter
  - Sort options: most active users (7d), most total events, newest, alphabetical
  - Results are paginated or virtualized — not all 450+ shown at once
  - Each browse result item shows: NSID, description (if available), category badge, weekly active users, total events
  - Clicking a browse result triggers the same schema resolution + preview flow as clicking a search result today

- [ ] **Schema resolution still uses Lexicon Garden**
  - When a user selects any result (from search or browse), the full schema is resolved via Lexicon Garden's `resolveLexicon` endpoint, exactly as today
  - If Lexicon Garden resolution fails, show an error message (as today) — LexiStats inferred schemas are not used as a substitute for adoption
  - The schema preview and adopt flow are unchanged

- [ ] **Browse mode handles LexiStats unavailability**
  - If LexiStats API is unreachable, the Browse tab shows a message like "Lexicon catalog unavailable" instead of an empty or broken state
  - The Search tab continues to work (via Lexicon Garden alone)

## Scope

**In scope:**

- New `LexiStatsService.ts` API client with caching
- Modifications to `DataPanel.ts` browse UI: merged search, usage stats display, new browse tab
- CSS for new browse UI elements (category pills, stats display, tab toggle)
- Client-side search/filter/sort of the cached LexiStats catalog

**Out of scope:**

- Replacing Lexicon Garden for schema resolution — LG remains the schema authority
- Using LexiStats inferred schemas for the adopt flow
- Embedding the LexiStats chooser widget (script tag / iframe)
- Server-side proxy for LexiStats API (call directly from client, like we do with Lexicon Garden via proxy — see ambiguity below)

## Files Likely Affected

- `src/app/services/LexiStatsService.ts` — **new file**, API client + caching
- `src/app/services/LexiconDiscovery.ts` — may add a merged search function, or this stays unchanged and merging happens in the panel
- `src/app/views/panels/DataPanel.ts` — browse UI changes (tabs, browse mode, stats display, merged search)
- `styles.css` — new styles for category pills, stats badges, tab toggle, browse list

## Ambiguity Warnings

1. **CORS / API proxy**
   Lexicon Garden is accessed via a `/lexicon-garden` proxy (configured in Vite or production server). LexiStats may need a similar proxy if it doesn't serve CORS headers for cross-origin requests from our domain.
   - _Likely assumption:_ We'll need to add a `/lexistats` proxy route, similar to the Lexicon Garden proxy.
   - _Please confirm or clarify._

2. **Cache strategy for the full catalog**
   The `/api/v1/lexicon-meta` endpoint returns all 450+ lexicons. How aggressively should we cache this?
   - _Likely assumption:_ Fetch once per session (on first browse tab open or first search), cache in memory. No TTL-based refresh during a single session.
   - _Please confirm or clarify._

3. **Browse result limit / pagination**
   450+ items is too many to render at once. Should we paginate (e.g., "Show more" button) or use a virtual scroll?
   - _Likely assumption:_ Show first 20-30 results with a "Show more" button that loads the next batch. Simpler to build than virtual scroll and consistent with the existing 10-result limit for search.
   - _Please confirm or clarify._

4. **Category list**
   Categories come from LexiStats data. Should we hardcode a known set with friendly labels, or dynamically extract them from the API response?
   - _Likely assumption:_ Dynamically extract from the API response so we pick up new categories automatically. Display the raw category names (e.g., "social", "gaming") — no mapping to friendly labels unless they look bad.
   - _Please confirm or clarify._

5. **Search tab vs Browse tab interaction**
   When the user switches from Browse to Search, should the category/sort state be preserved? When switching back?
   - _Likely assumption:_ Yes, preserve both tabs' state independently so switching back and forth doesn't lose context.
   - _Please confirm or clarify._

6. **Filtering by record type only**
   LexiStats includes non-record lexicons (queries, procedures). Since only records can be adopted, should Browse mode filter these out, or show them with a visual indicator that they can't be adopted?
   - _Likely assumption:_ Filter to records only in browse mode, since non-records can't be adopted and showing them would be confusing. Users who know a specific non-record NSID can still look it up manually.
   - _Please confirm or clarify._

## Integration Boundaries

### LexiStats API (lexistats.linkedtrust.us)

- **Data flowing in:** Full lexicon catalog (`GET /api/v1/lexicon-meta`) and individual lexicon details (`GET /api/v1/lexicon-meta/{nsid}`)
- **Data flowing out:** Nothing — read-only
- **Expected contract:**
  - Catalog response: `{ lexicons: Array<{ nsid, authority, domain, description, category, tags, schema_type, has_schema, has_example, total_events, unique_users_7d, first_seen, last_seen, spidered }> }`
  - Single lexicon response: Same fields plus `schema` (inferred), `example_record`
- **Unavailability:** Search falls back to Lexicon Garden only. Browse tab shows "catalog unavailable" message. No hard failures.

### Lexicon Garden (existing, unchanged)

- **Data flowing in:** Autocomplete suggestions (`GET /api/autocomplete-nsid?q=...`) and full schema resolution (`GET /xrpc/com.atproto.lexicon.resolveLexicon?nsid=...`)
- **Data flowing out:** Nothing — read-only
- **Expected contract:** Unchanged from current implementation
- **Unavailability:** Search falls back to LexiStats client-side filtering only. Schema resolution failure shows error as today. This is the new behavior — previously, search was fully broken when LG was down.

## Behavioral Scenarios

**Scenario: Search with both services available**

- Setup: Both Lexicon Garden and LexiStats are reachable
- Action: User types "feed" in the search box
- Expected outcome: Results appear showing matches from both sources, deduplicated. Each result shows the NSID and usage stats (if LexiStats has data for it). Lexicon Garden results are listed first.

**Scenario: Search with Lexicon Garden down**

- Setup: Lexicon Garden returns errors, LexiStats is reachable
- Action: User types "feed" in the search box
- Expected outcome: Results appear from LexiStats only (client-side filtered from cached catalog). No error banner — the fallback is seamless. Results include usage stats.

**Scenario: Search with LexiStats down**

- Setup: LexiStats is unreachable, Lexicon Garden is reachable
- Action: User types "feed" in the search box
- Expected outcome: Results appear from Lexicon Garden only, without usage stats. Behavior identical to today's implementation.

**Scenario: Both services down**

- Setup: Both APIs are unreachable
- Action: User types "feed" in the search box
- Expected outcome: Error message displayed: "Search unavailable. You can enter an NSID directly below." (same as today's Lexicon Garden error). Manual NSID lookup still works if resolution recovers.

**Scenario: Browse by category**

- Setup: LexiStats is reachable, user is in the browse UI
- Action: User clicks the "Browse" tab, then clicks the "social" category pill
- Expected outcome: List filters to show only lexicons in the "social" category, sorted by most active users (default sort). Each item shows NSID, description, category badge, and usage stats.

**Scenario: Browse and adopt**

- Setup: LexiStats is reachable, Lexicon Garden is reachable
- Action: User browses to find `app.bsky.feed.like`, clicks it
- Expected outcome: Schema preview loads (resolved via Lexicon Garden) with full field details. "Adopt this lexicon" button is available. Adopt flow proceeds exactly as today.

**Scenario: Browse with LexiStats down**

- Setup: LexiStats is unreachable
- Action: User clicks the "Browse" tab
- Expected outcome: Message reads "Lexicon catalog unavailable." Search tab remains fully functional via Lexicon Garden.

**Scenario: Select a result, resolution fails**

- Setup: User found a result via merged search or browse
- Action: User clicks a result, but Lexicon Garden fails to resolve the schema
- Expected outcome: Error message in the schema preview area: "Failed to load schema. Check the NSID and try again." Same as today.

## How to Verify

1. **Search merging:** Search for a broad term like "feed" — confirm results appear from both sources with usage stats shown.
2. **Fallback:** Temporarily break the Lexicon Garden proxy — confirm search still works via LexiStats. Restore it, break LexiStats — confirm search still works via Lexicon Garden.
3. **Browse:** Open the browse tab — confirm categories load, filtering works, sorting works, and clicking a result opens the schema preview.
4. **Adopt flow:** Find a lexicon via browse, adopt it — confirm fields import correctly (unchanged from today).
5. **Build:** `npm run build` passes with no errors.
6. **Tests:** `npx vitest run` passes.
