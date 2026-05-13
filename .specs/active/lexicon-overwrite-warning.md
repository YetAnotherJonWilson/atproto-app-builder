# Spec: Warn on Lexicon Overwrite with Schema Diff

**Status:** draft
**Date:** 2026-05-13

## What

Before publishing lexicons to the PDS, the wizard checks whether each target NSID already has a published schema. If an existing schema is present **and differs** from the one about to be written, the wizard surfaces a diff and requires explicit user confirmation before overwriting. Byte-identical re-publishes and brand-new NSIDs proceed without prompting.

## Why

NSIDs are flat under `com.thelexfiles.<username>.temp.<name>` with no app-scoping segment (`src/generator/Lexicon.ts:14-36`). Combined with the worker calling `com.atproto.repo.putRecord` without `swapRecord` (`worker/index.ts:241-252`), two apps from the same user that re-use the same type name (e.g. `groceryItem`) silently overwrite each other's lexicon schemas. The wizard keeps no record of past publishes and shows no warning today. This protects users from:

1. **Cross-app collisions** — App B accidentally replaces App A's `groceryItem` schema, breaking App A's data validation.
2. **Unintentional schema evolution** — the user changes fields in the same app and republishes without realizing existing records in user repos may no longer match.

Identical re-publishes (same app, same schema) remain silent so iteration on non-schema parts of the wizard isn't disrupted.

## Acceptance Criteria

- [ ] Before any `putRecord` call, the worker (or a new pre-check endpoint) reads the existing record at each target NSID and reports its status to the client.
  - When the NSID has no existing record at `com.atproto.lexicon.schema/<NSID>`, status is `new`.
  - When the NSID has an existing record whose schema is semantically equal to the one being published, status is `unchanged`.
  - When the NSID has an existing record whose schema differs, status is `changed`, and the existing schema body is returned to the client.
- [ ] The client computes which NSIDs are `new`, `unchanged`, and `changed` before showing the existing publish-confirmation dialog.
- [ ] If at least one NSID has status `changed`, the publish-confirmation dialog is replaced (or augmented) with an overwrite-warning state that shows the diff for each changed NSID.
  - The warning lists each changed NSID with a human-readable summary of differences (added fields, removed fields, type/constraint changes per field).
  - The full existing and new schemas are accessible (e.g. expandable JSON blocks) for users who want raw detail.
  - The dialog has two destructive choices: a primary "Cancel" button and a secondary "Overwrite and publish" button that proceeds with the publish.
  - `new` and `unchanged` NSIDs are still listed in the same dialog so the user sees the full set, but they are visually distinguished from `changed` NSIDs and don't require individual confirmation.
- [ ] If all NSIDs are `new` and/or `unchanged`, the existing confirmation flow is preserved unchanged (no extra clicks, no diff UI).
- [ ] If the pre-check itself fails (network error, PDS unavailable), the user is shown a clear error and the publish is **blocked** by default; an "Attempt publish anyway" escape hatch is acceptable but must not be the default action.
- [ ] Semantic equality between schemas treats key order and insignificant whitespace as equal but treats any structural difference (field set, types, constraints, descriptions, required-ness) as a difference.

## Scope

**In scope:**
- Pre-publish existence and diff check against the PDS for every target NSID.
- Semantic-equality comparison of lexicon schemas (not byte equality).
- Diff summary UI for changed NSIDs in the publish-confirmation dialog.
- Explicit overwrite confirmation gated on the presence of any `changed` NSID.
- Error handling for an unavailable pre-check.

**Out of scope:**
- Restructuring NSIDs to add app-scoping (e.g. `com.thelexfiles.<username>.temp.<appslug>.<name>`). Tracked separately.
- Schema versioning, multiple revisions per NSID, or rollback.
- Lexicon-level breaking-change classification (e.g. "this is a backwards-incompatible change"). The diff is structural, not semantic-version-aware.
- Preventing overwrite outright — the user is always allowed to overwrite after confirmation.
- Tracking previously-published NSIDs in localStorage or wizard state. The PDS is the source of truth.

## Files Likely Affected

- `worker/index.ts` — add an existence/diff lookup step (either inside `/api/publish` or as a new `/api/preflight` endpoint) that calls `com.atproto.repo.getRecord` for each target NSID and returns the existing schema if any.
- `src/app/services/LexiconPublisher.ts` — add a preflight call (or extend the publish request/response) and surface per-NSID status to callers.
- `src/app/views/panels/GeneratePanel.ts` — branch the confirmation dialog when any NSID returns `changed`, render the diff, and add the overwrite-confirmation step.
- Possibly a new helper module (e.g. `src/generator/lexiconDiff.ts` or `src/utils/lexiconDiff.ts`) for semantic-equality and diff-summary logic, with unit tests in `tests/`.
- `styles.css` — styling for the diff display, if not handled by existing dialog patterns.

## Ambiguity Warnings

1. **Preflight endpoint shape**
   Should the check live in a new `/api/preflight` (or `/api/check`) endpoint that returns per-NSID status without writing, or should `/api/publish` itself do a two-phase "check, return for confirmation, then write" flow keyed by a client-supplied "force" flag?
   - _Likely assumption:_ a new read-only `/api/preflight` endpoint is cleaner — it keeps publish semantics simple (publish always writes) and lets the client orchestrate the confirm step. The client would call preflight → show dialog → call publish with the user's decision.
   - _Please confirm or clarify._

2. **Diff granularity**
   How structural should the diff be? Options range from "schemas differ" (boolean) to a full field-by-field breakdown with type changes highlighted.
   - _Likely assumption:_ field-level summary — list added fields, removed fields, and changed fields (with old type → new type). Full JSON of both schemas is accessible via an expandable section for users who want the raw view.
   - _Please confirm or clarify._

3. **Equality definition for "unchanged"**
   The record stored on the PDS is `{ $type: 'com.atproto.lexicon.schema', ...schema }`. When comparing, do we compare the full stored record (including `$type` and any PDS-added fields like `createdAt`) or only the schema body?
   - _Likely assumption:_ compare only the schema body (strip `$type` and any PDS-injected metadata before comparing). The user cares about the lexicon definition, not the wrapper.
   - _Please confirm or clarify._

4. **Partial-conflict handling**
   If a publish involves 3 NSIDs and only 1 is `changed`, does the user confirm just that one, or do they confirm the whole batch?
   - _Likely assumption:_ batch confirmation. The dialog shows all 3 NSIDs with their statuses; the "Overwrite and publish" button publishes the whole batch. We don't offer per-NSID skip/cancel in v1.
   - _Please confirm or clarify._

5. **Authenticated read**
   `com.atproto.repo.getRecord` is unauthenticated for public records on most PDSes, but the worker currently authenticates for `putRecord`. Should preflight reuse the auth session or call `getRecord` anonymously?
   - _Likely assumption:_ anonymous `getRecord` is sufficient and avoids unnecessary auth churn; lexicon schema records are public.
   - _Please confirm or clarify._

## Integration Boundaries

### PDS (`protopunx.bsky.social`)
- **Data flowing in:** the existing `com.atproto.lexicon.schema` record at each target NSID (if any), used to compute diff/equality.
- **Data flowing out:** unchanged — the existing `putRecord` write is the only mutation.
- **Expected contract:** `com.atproto.repo.getRecord` returns either the record body or a 404-style error for missing records. The worker must distinguish "not found" (treat as `new`) from other errors (surface to user, block by default).
- **Unavailability:** if the PDS is unreachable for preflight, the publish is blocked with a clear error. An "Attempt publish anyway" escape hatch may be offered but must not be the default.

## Behavioral Scenarios

**Scenario: First-time publish (all NSIDs are new)**
- Setup: User generates an app with one record type `groceryItem`. No prior publish for this NSID exists on the PDS.
- Action: User clicks "Publish".
- Expected outcome: Preflight returns `new` for the NSID. The current confirmation dialog appears unchanged (no diff section). User confirms and publish proceeds.

**Scenario: Identical re-publish**
- Setup: User has previously published `groceryItem` and re-generates the same app with the same data type and fields. The NSID exists on the PDS with a byte-equivalent schema.
- Action: User clicks "Publish".
- Expected outcome: Preflight returns `unchanged`. The current confirmation dialog appears unchanged. User confirms and publish proceeds, overwriting with the same content (no diff shown).

**Scenario: Cross-app collision with different schema**
- Setup: User previously published `com.thelexfiles.alice.temp.groceryItem` with fields `{name, quantity}` from App A. They now generate App B with a `groceryItem` data type defined as `{title, price}`.
- Action: User clicks "Publish" in App B's wizard.
- Expected outcome: Preflight returns `changed` with the existing schema. The overwrite-warning dialog appears, listing the NSID with a summary: `Removed: name, quantity. Added: title, price.` and an expandable raw-JSON view. User must click "Overwrite and publish" to proceed, or "Cancel" to abort.

**Scenario: Same-app schema evolution**
- Setup: User previously published `groceryItem` with fields `{name, quantity}`. They add a `note` string field and re-publish from the same app.
- Action: User clicks "Publish".
- Expected outcome: Preflight returns `changed`. Diff summary: `Added: note (string).` User confirms via "Overwrite and publish" and the new schema is written.

**Scenario: Mixed batch with one collision**
- Setup: User's app defines `groceryItem` and `shoppingTrip`. `groceryItem` exists on the PDS with different fields; `shoppingTrip` is brand new.
- Action: User clicks "Publish".
- Expected outcome: Preflight returns `changed` for `groceryItem` and `new` for `shoppingTrip`. The dialog shows both NSIDs with their statuses, the diff for `groceryItem`, and a single "Overwrite and publish" button that writes both.

**Scenario: Preflight fails (PDS unreachable)**
- Setup: PDS is temporarily unavailable.
- Action: User clicks "Publish".
- Expected outcome: Preflight call fails. The wizard shows an error like "Couldn't check existing lexicons — publish is blocked. Try again in a moment." Publish does not proceed. An optional secondary action "Publish without checking" may be offered but is not the default.

**Scenario: NSID exists but schema is corrupt or non-schema-shaped**
- Setup: A record exists at the NSID but its body doesn't look like a lexicon schema (e.g. external tooling wrote something else).
- Action: User clicks "Publish".
- Expected outcome: Preflight treats it as `changed` (any non-equal body counts as changed). Diff display falls back to "Existing record has unexpected shape; raw view below." User can still overwrite.

## How to Verify

**Manual:**
1. Generate a grocery app with type `groceryItem` having fields `{name, quantity}`. Publish.
2. Without changing anything, click Publish again — verify no diff dialog appears.
3. Add a `note` field to `groceryItem`. Click Publish — verify diff dialog appears showing the added field, and that "Cancel" aborts while "Overwrite and publish" succeeds.
4. Generate a different app with a `groceryItem` type defined as `{title, price}` (same username). Publish — verify the diff dialog correctly shows removed and added fields.
5. With the worker offline (or block `protopunx.bsky.social` in devtools), attempt publish — verify the blocked-with-error path.

**Automated:**
- Unit tests for the semantic-equality helper: identical schemas, reordered keys, added/removed fields, changed types.
- Unit tests for the diff-summary helper: correctly classifies added/removed/changed fields.
- A vitest test for `LexiconPublisher` that mocks the preflight response and verifies the client surfaces the right status to the caller.
- Optionally an e2e smoke test that intercepts the preflight network call and verifies the dialog renders the diff state.
