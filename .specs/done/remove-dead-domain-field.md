# Spec: Remove dead `appInfo.domain` field

**Status:** ready
**Date:** 2026-04-25

## What
Remove the "Domain" input from the Generate panel and delete the
`appInfo.domain` / `appConfig.domain` fields and all the threading that carries
them through the generator. Every per-record-type NSID will be produced
exclusively from the record's own `namespaceOption` (or its `adoptedNsid`) via
`computeRecordTypeNsid`. As a prerequisite, fix `src/generator/atproto/Api.ts`
which currently bypasses `namespaceOption` and uses the global `appInfo.domain`
to build NSIDs — that produces inconsistent output today (lexicon JSON and API
service use different NSIDs for the same record when `namespaceOption` is set).

This supersedes `.specs/active/review-nsid-undefined-record.md` — the malformed
`com.example.` display in the Review section is a symptom of the dead field,
and removing the field eliminates the symptom without needing display patches.

## Why
The `appInfo.domain` field is vestigial. It was the original mechanism for
computing record NSIDs before per-record `namespaceOption` was introduced
(`f54a2f3 defining data types step 1`), and it has not been load-bearing since
`isRecordTypeReady` (`fbbb5bd warning dialog if data undefined`,
`OutputGenerator.ts:42-45`) started gating generation on `namespaceOption`
being set. Today the field:

- Cannot make an undefined record type generatable (still blocked by
  `isRecordTypeReady`).
- Cannot affect a fully-defined record's NSID in the lexicon path
  (`Lexicon.ts:34-37` is the unreachable fallback branch).
- Conditionally appears in the UI (only when at least one record lacks a
  complete `namespaceOption`), which signals that filling it in matters — but
  it doesn't.
- Surfaces as a confusing/malformed NSID like `com.example.` in the Review
  section when an in-flight record has an empty `name`.
- Actively produces wrong output via `Api.ts:45`'s `generateNSID(domain,
  record.name)` call, which ignores `namespaceOption` and uses
  `appInfo.domain` for every record in the generated API service. A user who
  picks `thelexfiles` for a record gets a lexicon JSON saying
  `com.thelexfiles.alice.foo` and an `api.ts` saying `com.example.foo` — the
  generated app wouldn't actually work end-to-end.

Removing the field collapses the only-partially-correct fallback path,
eliminates the misleading UI, and forces the generator onto a single,
consistent NSID source (`computeRecordTypeNsid`).

## Acceptance Criteria

- [ ] `src/generator/atproto/Api.ts` calls `computeRecordTypeNsid(record)` to
      derive the NSID for each record type instead of `generateNSID(domain,
      record.name)`. The `domain` parameter is removed from `generateApiTs`'s
      signature.
  - When a record has `namespaceOption: 'thelexfiles'` and `lexUsername:
    'alice'` and `name: 'groceryItem'`, the generated `api.ts` references
    `'com.thelexfiles.alice.groceryItem'` for that record's `$type` and
    `collection` strings — matching its lexicon JSON.
  - When a record has `source: 'adopted'` and `adoptedNsid:
    'app.bsky.feed.post'`, the generated `api.ts` uses `'app.bsky.feed.post'`.
- [ ] `src/generator/atproto/Types.ts` removes the unused `domain` parameter
      from `generateTypesTs`. (It is currently in the signature but never read.)
- [ ] `src/generator/Readme.ts` removes the unused `domain` parameter from
      `generateReadme`. (It is currently in the signature but never read; the
      `your-domain.com` strings inside the README body are literal placeholder
      text and stay as-is.)
- [ ] `src/generator/Lexicon.ts`'s `computeRecordTypeNsid` no longer takes a
      `fallbackDomain` parameter. The fallback branch (currently lines 33-37,
      producing `[reversedDomain, sanitizedName].join('.')`) is removed
      entirely. When called with a record that has no `namespaceOption` and is
      not `adopted` with `adoptedNsid`, the function returns the bare
      `rt.name` (existing line 39 behavior preserved).
  - Callers updated to call `computeRecordTypeNsid(rt)` with a single argument.
- [ ] `src/generator/Lexicon.ts`'s `generateRecordLexicon` removes the `domain`
      parameter from its signature. Its body uses
      `computeRecordTypeNsid(recordType)` (no second argument).
- [ ] `src/generator/index.ts` no longer reads `appInfo.domain` and no longer
      threads a `domain` argument into `generateApiTs`, `generateTypesTs`,
      `generateReadme`, `generateRecordLexicon`, or
      `computeRecordTypeNsid`.
- [ ] `src/utils/nsid.ts` and the `generateNSID` export in
      `src/utils/index.ts` are deleted, along with `tests/utils/nsid.test.ts`.
      (No other code in `src/` calls `generateNSID` after the `Api.ts` change.)
- [ ] `src/types/wizard.ts` removes the `domain` field from the `AppInfo`
      interface and the optional `domain` field from `AppConfig`.
- [ ] `src/app/state/WizardState.ts`:
  - The default `AppInfo` no longer includes `domain`.
  - `hasMeaningfulState` (line 381) no longer references
    `state.appInfo.domain`.
  - The state-loading path (whatever validates/migrates a loaded
    `WizardState`) silently drops a legacy `domain` property if present on
    persisted state. New saves do not include it. Identify the loader path
    during implementation; if it spreads loaded objects into typed shapes,
    the property is implicitly discarded and no further code is needed —
    confirm by reading the loader.
- [ ] `src/app/views/panels/GeneratePanel.ts`:
  - The Domain `<input>`, its label, and its hint are removed from
    `renderAppInfoSection`.
  - `isDomainNeeded` is deleted (also unexport it from this module — search
    the codebase for any other importers and remove those imports).
  - `displayNsid` no longer takes a `domain` argument and no longer has the
    `if (domain) ...` branch. It returns
    `computeRecordTypeNsid(rt)` for adopted/`namespaceOption`-set records;
    for incomplete records (no `adoptedNsid`, no `namespaceOption`) it
    returns the placeholder `[namespace].${rt.name}` (mirroring today's
    `[domain].${rt.name}` placeholder, just with `[namespace]` since that's
    the missing piece now).
  - `renderReviewSection` no longer reads `appInfo.domain`. Lexicon preview
    `<details>` blocks are skipped for any record type where `displayNsid`
    returns the placeholder form (i.e., contains `[namespace]` or `rt.name`
    is empty) — there is no valid lexicon to preview yet.
  - `renderExportSection` and `updateDownloadButtonState` set the disabled
    expression to `!appInfo.appName.trim()` only — drop the
    `(needsDomain && !appInfo.domain.trim())` clause.
  - The domain-input event listener in `wireGeneratePanel` is removed.
  - The confirmation dialog and `executePublishAndGenerate` call
    `computeRecordTypeNsid(rt)` with one argument.
- [ ] `src/app/export/OutputGenerator.ts:27` (`wizardState.appConfig.domain =
      wizardState.appInfo.domain;`) is deleted. `appConfig.domain` is no
      longer set anywhere.
- [ ] `tests/generator/Lexicon.test.ts` is updated:
  - The "falls back to domain-based NSID" test is removed.
  - Existing `computeRecordTypeNsid` and `generateRecordLexicon` tests are
    updated to match the new (single-argument) signatures.
- [ ] All existing tests pass and `npm run verify` is clean (build + vitest +
      playwright e2e smoke).

## Scope
**In scope:**
- Migrate `Api.ts` to `computeRecordTypeNsid` (prerequisite — fixes the
  inconsistency bug).
- Delete `appInfo.domain` and `appConfig.domain` from types, defaults, state
  persistence, UI, and the generator pipeline.
- Delete the `fallbackDomain` parameter and fallback branch in
  `computeRecordTypeNsid`; collapse `generateRecordLexicon` and the rest of
  the generator entry points to no-domain signatures.
- Delete `src/utils/nsid.ts` and its test file.
- Update tests that reference removed signatures.

**Out of scope:**
- Any UX changes to the Data panel or how `namespaceOption` is collected.
- The conceptually-related but separately-needed cleanup of the
  `your-domain.com` placeholder strings *inside* the generated README — those
  are literal documentation, not generator inputs.
- New tests beyond updates to existing ones (a separate test-coverage spec
  exists in the backlog).
- Saved-state forward-migration tooling beyond "loader silently ignores the
  legacy field." Re-saving a session removes the property naturally.
- Anything in `Readme.ts` body content (the `VITE_APP_URL=https://...` line
  and similar) — only the unused parameter is removed.

## Files Likely Affected
- `src/generator/atproto/Api.ts` — switch to `computeRecordTypeNsid`; drop
  `domain` param.
- `src/generator/atproto/Types.ts` — drop unused `domain` param.
- `src/generator/Readme.ts` — drop unused `domain` param.
- `src/generator/Lexicon.ts` — drop `fallbackDomain`/fallback branch from
  `computeRecordTypeNsid`; drop `domain` param from `generateRecordLexicon`.
- `src/generator/index.ts` — stop reading `appInfo.domain`; drop the threaded
  `domain` argument from all generator calls.
- `src/utils/nsid.ts` — delete.
- `src/utils/index.ts` — remove `generateNSID` re-export.
- `src/types/wizard.ts` — remove `AppInfo.domain` and `AppConfig.domain`.
- `src/app/state/WizardState.ts` — drop `domain` from default `AppInfo` and
  from `hasMeaningfulState`; verify loader silently ignores legacy field.
- `src/app/views/panels/GeneratePanel.ts` — remove input, `isDomainNeeded`,
  `displayNsid`'s `domain` arg, gating expressions, event listener, and
  confirm-dialog NSID args.
- `src/app/export/OutputGenerator.ts` — delete the
  `appConfig.domain = appInfo.domain` line.
- `tests/generator/Lexicon.test.ts` — update for new signatures; remove the
  fallback-domain test.
- `tests/utils/nsid.test.ts` — delete.
- Possibly other test files referencing `appInfo.domain` (search and update).

## Behavioral Scenarios

**Scenario: Generate a record with `thelexfiles` namespace**
- Setup: One record type, `name: 'groceryItem'`, `namespaceOption:
  'thelexfiles'`, `lexUsername: 'alice'`. App name `My App`. No domain field
  exists in the Generate panel.
- Action: User clicks Download ZIP and confirms.
- Expected outcome: Both the generated `lexicons/.../groceryItem.json` (the
  lexicon's `id`) and the generated `src/atproto/api.ts` `$type`/`collection`
  strings reference `'com.thelexfiles.alice.groceryItem'`. (Today,
  pre-cleanup, `api.ts` would say `'com.example.groceryItem'` if the domain
  field was `example.com` — that bug is fixed.)

**Scenario: Generate a record with `byo-domain` namespace**
- Setup: One record type, `name: 'note'`, `namespaceOption: 'byo-domain'`,
  `customDomain: 'jon.example'`.
- Action: User clicks Download ZIP and confirms.
- Expected outcome: Lexicon JSON and `api.ts` both reference
  `'example.jon.note'`.

**Scenario: Generate an adopted record**
- Setup: One adopted record with `adoptedNsid: 'app.bsky.feed.post'`.
- Action: User clicks Download ZIP and confirms.
- Expected outcome: `api.ts` and other generated files reference
  `'app.bsky.feed.post'`. (No lexicon JSON file is produced for adopted
  records — existing behavior.)

**Scenario: Review section with an incomplete record**
- Setup: One record type with `displayName: 'My Record'`, `name: ''`, no
  `namespaceOption`. App name set.
- Action: User views the Generate panel.
- Expected outcome: The Review row shows `1 — My Record ([namespace].)` (or
  the existing placeholder formatting — point is, no `com.example.` malformed
  NSID, because no domain field exists). No lexicon `<details>` block is
  rendered for this record. Download button enabled if `appName` is set, but
  clicking it produces the existing "Incomplete data types" dialog (gated by
  `isRecordTypeReady`).

**Scenario: Loading a session saved before this change**
- Setup: Persisted `WizardState` JSON contains `appInfo.domain: 'old.example'`
  from a prior version.
- Action: User loads/resumes the session.
- Expected outcome: The loader produces a valid in-memory state without the
  `domain` property; nothing breaks; nothing in the UI references the old
  value. On next save, the field is no longer persisted.

**Scenario: `hasMeaningfulState` resume detection**
- Setup: User typed only into the (now-removed) domain field on a fresh
  session, then closed the app.
- Action: User reopens.
- Expected outcome: Since the field doesn't exist post-cleanup, this path is
  no longer reachable. For a session loaded from before the change where
  *only* `domain` had been filled, `hasMeaningfulState` returns false (one
  fewer "meaningful" signal). This is acceptable — the user had no real data.

## How to Verify

- Manual: open the Generate panel with a record type that has
  `namespaceOption: 'thelexfiles'` and `lexUsername` set. Confirm there is no
  Domain input. Click Download, inspect the generated `src/atproto/api.ts` —
  every `$type` / `collection` string should match the corresponding
  `lexicons/*.json` `id`. Repeat with `byo-domain` and `adopted` records.
- Unit: run `npx vitest run` — updated `Lexicon.test.ts` passes with
  single-argument `computeRecordTypeNsid` calls; the fallback-domain test is
  gone; no test imports `generateNSID`.
- E2E: `playwright test` smoke passes (wizard flow ends in a successful
  download).
- Build: `npm run build` is clean — TypeScript compiles with no orphan
  references to `appInfo.domain`, `appConfig.domain`, `generateNSID`, or
  `isDomainNeeded`.
- `npm run verify` is the gate — must pass.
