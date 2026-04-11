# Spec: Inlay Component Discovery

**Status:** ready
**Date:** 2026-04-11

## What

Build the discovery layer that fetches `at.inlay.component` records
from a hardcoded list of known Inlay component authors and parses them
into a usable shape for the rest of the wizard. This is the data-
fetching foundation the template-components integration will consume —
it does not include UI polish or the integration itself.

## Why

Any rendering of community Inlay components starts with knowing what
components exist. The wizard can't yet run its own firehose indexer
and inlay.at has no public query API, so discovery flows through
`com.atproto.repo.listRecords` against hardcoded author PDSes.
Isolating this as its own spec lets us verify discovery end-to-end
against real PDSes before any rendering pipeline depends on it.

## Architecture Context

This spec builds infrastructure consumed by
`inlay-template-components.md` § "Inlay component association". It is
independent of `inlay-primitive-expansion.md` and can proceed in
parallel with it.

## Prerequisite

None. Can run before or in parallel with the browser spike and
primitive expansion.

## Acceptance Criteria

- [ ] **Author registry** — a hardcoded list of known authors lives
  in one module, each entry storing handle and DID. Initial list:
  - `danabra.mov` → `did:plc:fpruhuo22xkm5o7ttr2ktxdo`
  - `dansshadow.bsky.social` → `did:plc:rm4mmytequowusm6smpw53ez`

- [ ] **DID/PDS resolution** — a helper resolves an author's DID to
  their PDS URL via `https://plc.directory/{did}`, extracting the
  `#atproto_pds` service entry. Uses `public.api.bsky.app` for any
  unauthenticated XRPC.

- [ ] **Component listing** — for each author, call
  `com.atproto.repo.listRecords?collection=at.inlay.component` on
  the resolved PDS and return the records. Paginates if an author
  has more than one page.

- [ ] **Metadata extraction** — parsed entries expose, at minimum:
  - AT-URI (fully formed)
  - NSID (from rkey)
  - Author handle / DID
  - `description` (if present)
  - `view.accepts` collections (used later for "compatible
    components for data type X" filtering)
  - `body` type (template, external, or primitive) — so later code
    can filter out external-only components this initiative doesn't
    handle

- [ ] **Caching** — results cached in memory for the session. No
  persistence yet; a manual refresh path is out of scope.

- [ ] **Failure handling** — if any author's PDS fails, discovery
  continues for the others and the failure is reported (return
  value or logged warning) without crashing the caller.

- [ ] **Verification harness** — one vitest test that mocks the XRPC
  responses and asserts the parser returns the expected shape, plus
  a way to run the discovery against real PDSes during development
  (a script or temporary init call) to confirm live data works.

## Scope

**In scope:**
- `src/inlay/discovery.ts` — discovery module, author registry,
  resolution helpers, metadata parser
- Unit tests for the parser with mocked inputs

**Out of scope:**
- UI for browsing components (deferred to the integration spec)
- Any generator or rendering work
- Firehose indexing or dynamic author list
- External-body components (filtered out)
- Persistent caching

## Files Likely Affected

- New: `src/inlay/discovery.ts`
- New: `tests/inlay/discovery.test.ts`

## Integration Boundaries

### PLC directory (`https://plc.directory`)
- **Data flowing in:** DID documents; we read the `#atproto_pds`
  service
- **Unavailability:** discovery fails for authors whose DIDs can't
  be resolved; skip that author and continue

### Author PDSes (`com.atproto.repo.listRecords`)
- **Data flowing in:** `at.inlay.component` records per author
- **Expected contract:** records follow the Inlay component lexicon;
  `body`, `view`, `imports`, `description` fields present on
  template-body records
- **Unavailability:** skip that author, continue; surface the error

## Ambiguity Warnings

1. **External-body components** — spec filters them out, but should
   they be reported separately (so the UI can show "N components, M
   unsupported") or silently dropped? Default: filter silently;
   revisit when the selection UI is built.

## How to Verify

- `npx vitest run tests/inlay/discovery.test.ts` — parser tests pass
- Manually (dev-mode): call the discovery function with both
  authors listed above and confirm non-empty results with expected
  metadata fields
