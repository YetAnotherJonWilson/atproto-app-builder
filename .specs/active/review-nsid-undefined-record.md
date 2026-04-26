## Spec: Fix "com.example." display in Review section for undefined record types

**Status:** draft
**Date:** 2026-04-25

## What
In the Generate panel's **Review** section, the "Record Types" line displays an
NSID like `com.example.` (with a trailing dot, no record name) when a record
type has not yet been fully defined (empty `rt.name`) and the user has typed
`example.com` (or any value) into the Domain field. The literal `com.example.`
string is not in the codebase — it is produced by `computeRecordTypeNsid` when
`rt.name` is empty: the function reverses the domain and joins with an empty
name segment, yielding a malformed NSID with a trailing dot.

This spec covers detecting and surfacing partially-defined record types in the
Review section instead of rendering a malformed NSID.

## Why
The malformed `com.example.` display is confusing — it looks like a generated
NSID but is actually a sign the record type is missing data. Worse, the same
malformed value would flow into `generateRecordLexicon` if the user proceeds to
download, putting an invalid `id` into the lexicon JSON.

## Reproduction (verified by reading code, not yet manually reproduced)
1. Add a record type via the Data panel but leave its `name` empty (or in a
   state where `rt.name` is empty/whitespace).
2. Navigate to Generate. In App Identity, type `example.com` in the Domain
   field.
3. Observe the Review section's "Record Types" row: it shows
   `<displayName> (com.example.)` — trailing dot, no record name segment.

The path producing the bad string:
- `src/app/views/panels/GeneratePanel.ts:127` calls `displayNsid(rt, domain)`.
- `displayNsid` (line 18) — when `domain` is truthy, calls
  `computeRecordTypeNsid(rt, domain)` regardless of whether `rt.name` is set.
- `src/generator/Lexicon.ts:34-37` — the fallback branch builds the NSID from
  `[...reversedDomainParts, name.toLowerCase().replace(/[^a-z0-9]/g, '')]`. With
  empty `name`, this produces `com.example.`.

## Acceptance Criteria

- [ ] In the Generate panel's Review section, a record type with an empty/missing
      `name` does not render a malformed NSID like `com.example.`.
  - When `rt.name` is empty/whitespace, the Review row shows the record's
    `displayName` (or a fallback like "(unnamed)") followed by a clear
    placeholder such as `(NSID pending — record name not set)` instead of an
    NSID in parentheses.
  - The lexicon preview `<details>` block for that record type is suppressed
    (or replaced with a hint that the record needs to be completed) — do not
    render a `<pre>` containing a lexicon with an invalid `id`.
- [ ] The same protection applies to the confirmation dialog: the NSID list
      shown before "Generate & Publish" must not include malformed entries.
  - Records with empty `name` are excluded from the publishable list (this is
    likely already true via `getPublishableRecordTypes`, but verify).
- [ ] `computeRecordTypeNsid` itself does not silently emit a trailing-dot NSID.
      Decide between (a) returning a sentinel/empty string when `rt.name` is
      empty and letting callers handle it, or (b) throwing. Pick whichever
      requires the fewest call-site changes; document the choice in the spec
      before implementing.
- [ ] The download button stays disabled (or download is blocked) when any
      record type would produce a malformed NSID, with a clear message in the
      review area indicating which record(s) need attention. (May already be
      partially covered by `isRecordTypeReady` in `OutputGenerator.ts:15` —
      verify and reuse rather than duplicating.)

## Scope
**In scope:**
- `displayNsid` in `GeneratePanel.ts` — handle empty-name record types
  explicitly.
- Suppress lexicon preview `<details>` for incomplete record types.
- Tighten `computeRecordTypeNsid` so it never returns a trailing-dot NSID.
- Verify download blocking already covers this case; if not, add it.

**Out of scope:**
- Redesigning how the Data panel signals incomplete record types.
- Changing the namespace-option UI or lexicon publishing flow.
- The unrelated form-hint text on line 88 (`com.example.myRecord`) — that's
  documentation, not a bug.

## Files Likely Affected
- `src/app/views/panels/GeneratePanel.ts` — `displayNsid` (line 18) and
  `renderReviewSection` (line 117); lexicon preview block (lines 134-144).
- `src/generator/Lexicon.ts` — `computeRecordTypeNsid` (line 12); decide on
  empty-name handling.
- `src/app/export/OutputGenerator.ts` — verify `isRecordTypeReady` covers the
  empty-name case; reuse rather than duplicate.
- Tests: add a unit test for `computeRecordTypeNsid` with empty `rt.name` and
  a non-empty `fallbackDomain`. Add (or extend) a jsdom test for
  `renderReviewSection` covering the partially-defined record type case.

## Ambiguity Warnings

1. **Definition of "undefined"**
   The bug report says "data types that haven't been defined." The most likely
   trigger is `rt.name` being empty. But a record type could also be "undefined"
   if it has a name but no fields, or no namespaceOption. This spec assumes the
   trigger is empty `rt.name`; confirm before implementation, and if other
   shapes also produce malformed NSIDs, expand the criteria.
   - _Likely assumption:_ Empty `rt.name` is the only path that produces
     `com.example.`. Other incomplete states either still produce a valid
     (though potentially undesired) NSID or are blocked elsewhere.
   - _Please confirm or clarify after manual repro in the next session._

2. **Empty-name handling in `computeRecordTypeNsid`**
   Should the function return `""`, throw, or return a sentinel like
   `"<incomplete>"`? Throwing is the safest signal but ripples through every
   caller (review render, lexicon preview, generation, publishing). Returning
   `""` is least disruptive but requires every caller to check.
   - _Likely assumption:_ Return `""` and have `displayNsid` (and the lexicon
     preview, and download path) treat empty-string as "incomplete." Confirm
     before implementing.

## Behavioral Scenarios

**Scenario: Partially-defined record type with domain set**
- Setup: One record type exists with `displayName = "My Record"`, `name = ""`,
  no namespaceOption. App Identity domain field = `example.com`.
- Action: User views the Generate panel.
- Expected outcome: Review section shows
  `1 — My Record (NSID pending — record name not set)` (or equivalent). No
  lexicon `<details>` block is rendered for this record. Download button is
  disabled with a hint pointing to the incomplete record.

**Scenario: Fully-defined record type with domain set**
- Setup: One record type with `name = "myRecord"`, no namespaceOption. Domain =
  `example.com`.
- Action: User views the Generate panel.
- Expected outcome: Review row shows `1 — My Record (com.example.myrecord)`.
  Lexicon preview renders normally. (This is the existing happy path — verify
  no regression.)

**Scenario: Mixed — one defined, one undefined**
- Setup: Two record types, one fully-defined and one with empty `name`. Domain
  set.
- Action: User views the Generate panel.
- Expected outcome: Review row lists both, with the defined one showing its
  NSID and the undefined one showing the placeholder. Only the defined one
  gets a lexicon preview. Download is blocked with a message naming the
  incomplete record.

**Scenario: No domain typed yet**
- Setup: One record type with empty `name`, domain field empty,
  `namespaceOption` unset.
- Action: User views the Generate panel.
- Expected outcome: Review row shows the placeholder (no malformed NSID).
  This was already handled by the `[domain].${rt.name}` branch in
  `displayNsid`, but verify the new placeholder logic supersedes it cleanly.

## How to Verify
- Manual: reproduce the bug per the steps above, confirm `com.example.` no
  longer appears, then complete the record type and confirm the NSID renders
  correctly.
- Unit: `computeRecordTypeNsid({ name: '', ... }, 'example.com')` returns the
  chosen sentinel (likely `""`), not `"com.example."`.
- jsdom: render `renderReviewSection` with a state containing one empty-name
  record type and a populated domain; assert the placeholder string is in the
  output and `com.example.` is not.
- `npm run verify` passes.
