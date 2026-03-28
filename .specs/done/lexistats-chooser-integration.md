# Spec: LexiStats Lexicon Chooser Integration

**Status:** done
**Date:** 2026-03-28

## What

Add a "Browse by popularity" tab to the DataPanel's browse/adopt flow that fetches real ATProto lexicons from the LexiStats API (`lexistats.linkedtrust.us/api/v1/lexicons`), ranked by actual network usage. When a user picks a lexicon from the list, it feeds into the existing adopt-lexicon flow (same as the Lexicon Garden search).

## Why

The existing browse mode requires users to search by name or NSID fragment — you need to already know what you're looking for. LexiStats exposes which lexicons are actually being used on the ATProto network, letting users discover real schemas they might not know to search for. This is especially useful for new app builders who don't yet know the ecosystem.

## Acceptance Criteria

- [ ] A new `LexiStats` service module fetches lexicons from `https://lexistats.linkedtrust.us/api/v1/lexicons`
  - Returns a list with `nsid`, `description`, `category`, `unique_users_7d`, `total_events`, `domain`

- [ ] The DataPanel browse view gains a toggle between two sub-modes: `search` (existing Lexicon Garden search) and `popular` (LexiStats ranked list)
  - When the detail view opens in browse mode, two tabs appear: **"Search"** and **"Popular"**
  - Clicking "Popular" fetches from LexiStats and renders a ranked list
  - Clicking "Search" shows the existing search input (no change to existing behavior)
  - Default sub-mode is `search` (no behavior change on first open)

- [ ] The Popular tab shows lexicons as a scrollable list, each card displaying:
  - NSID (monospace)
  - Description (if available)
  - Category badge (if available)
  - Usage stats: unique users (7d) and total events

- [ ] Clicking a lexicon in the Popular list resolves its full schema (via existing `resolveLexicon` from LexiconDiscovery) and adopts it — same flow as picking a result from the existing search
  - If resolution fails, show an inline error: "Could not load schema for [nsid]"

- [ ] If LexiStats is unavailable, show: "Could not load popular lexicons. Try searching instead."

- [ ] While loading the Popular list, show a loading state

## Scope

**In scope:**
- New `LexiStats` service in `src/app/services/LexiStats.ts`
- Search/Popular toggle in DataPanel browse view
- Popular lexicon list rendering and wiring
- Reuse of existing `resolveLexicon` for schema adoption

**Out of scope:**
- Replacing or modifying the existing Lexicon Garden search
- Iframe embed of the full LexiStats chooser UI
- Usage history charts or per-lexicon detail pages
- Any changes outside DataPanel and the new service file

## Files Likely Affected

- `src/app/services/LexiStats.ts` — new file, API client for `lexistats.linkedtrust.us`
- `src/app/views/panels/DataPanel.ts` — add sub-mode toggle + popular list rendering/wiring

## Integration Boundaries

### LexiStats API
- **Endpoint:** `GET https://lexistats.linkedtrust.us/api/v1/lexicons`
- **Data flowing in:** List of lexicons with usage stats
- **Expected shape:** `{ lexicons: Array<{ nsid, description, category, unique_users_7d, total_events, domain, ... }> }`
- **Unavailability:** Show error message, leave "Search" tab functional

### LexiconDiscovery (existing)
- **Used for:** `resolveLexicon(nsid)` — fetches full schema after user picks from popular list
- **No changes** to this module

## Behavioral Scenarios

**Scenario: User browses popular lexicons and adopts one**
- Setup: User has a RecordType open in detail view, is in browse mode
- Action: Clicks "Popular" tab → list loads → clicks a lexicon card
- Expected outcome: Schema resolves, adopt button appears (same as existing search flow), user confirms and lexicon is adopted

**Scenario: User switches between Search and Popular**
- Setup: User typed a search query in the Search tab
- Action: Clicks "Popular" tab, then clicks "Search" tab
- Expected outcome: Search query is preserved, Popular list doesn't affect search state

**Scenario: LexiStats is down**
- Setup: `api/v1/lexicons` returns an error
- Action: User clicks "Popular" tab
- Expected outcome: Error message shown, Search tab still works normally

**Scenario: Schema resolution fails for a popular lexicon**
- Setup: User clicks a lexicon in the Popular list
- Action: `resolveLexicon` throws
- Expected outcome: Inline error shown under that card: "Could not load schema for [nsid]"

## How to Verify

1. Run `npm run dev`, open the app, go to the Data panel
2. Open a RecordType detail view → choose "Browse / Adopt existing"
3. Verify "Search" and "Popular" tabs appear
4. Click "Popular" — list should load with usage stats
5. Click a lexicon — schema should resolve and adopt flow should trigger
6. Simulate network failure (DevTools → block `lexistats.linkedtrust.us`) — verify error message
7. Run `npx vitest run` — no regressions
