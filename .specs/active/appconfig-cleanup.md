# Spec: AppConfig cleanup — drop dead `primaryRecordType` and `listDisplayFields`

**Status:** ready
**Date:** 2026-05-05

## What

Delete `primaryRecordType` and `listDisplayFields` from the `AppConfig` type and
from every place that reads or writes them. Delete the three legacy generator
files that consumed them (`RecordList.ts`, `RecordDetail.ts`, `RecordForm.ts`),
which are no longer called anywhere in `src/`. `AppConfig` is retained as a
one-field shape (`outputMethod` only) so that the migration to existing
PDS-saved state stays minimal and there's an obvious home for future app-level
output config.

This supersedes the placement question raised in the now-deleted
`.specs/active/app-config-placement.md` — the right answer turned out to be
"there's nothing to place; it's vestigial state from the pre-views generator."

## Why

The current generator (`src/generator/index.ts`) is **view-driven**: pages are
composed from user-defined views and components, and any record-type binding
flows through a component's requirement (see `findBoundRecordTypeFor` at
`src/generator/index.ts:254`).

`primaryRecordType` and `listDisplayFields` are leftovers from the old
"primary record drives canned List/Detail/Form pages" generator that was
replaced by the view-driven generator (see
`.specs/done/generator-view-driven-pages.md`, 3/23/26). Today:

- `generateListViewTs`, `generateDetailViewTs`, `generateFormViewTs`
  (`src/generator/components/RecordList.ts`,
  `src/generator/components/RecordDetail.ts`,
  `src/generator/components/RecordForm.ts`) are defined but never called from
  `src/` — only their own files reference them.
- `appConfig.primaryRecordType` is auto-cleared on record delete
  (`src/app/operations/RecordTypeOps.ts:103`) and auto-set to the first record
  at export (`src/app/export/OutputGenerator.ts:22`), but no caller consumes
  the value.
- `appConfig.listDisplayFields` is initialized to `[]`, has no UI, and no
  caller consumes it.
- `generateAllFiles(wizardState, wizardState.appConfig)` accepts an
  `appConfig` parameter (`src/generator/index.ts:88`) that the body never
  reads.

Keeping these fields creates two ongoing costs: (1) a misleading "App Config"
mental model that suggests there's per-app config to capture (which sent the
prior placement spec down a dead end), and (2) dead code that future readers
have to trace through before realizing nothing calls it.

`outputMethod` stays on `AppConfig` because it's a real, consumed setting
written by `GeneratePanel.ts` and read by `OutputGenerator.ts`. `AppConfig`
is retained as a one-field type rather than inlined onto `WizardState`
because (a) the migration to existing PDS-saved state is smaller — the
property still lives at the same path, just with two fewer keys — and (b)
new app-level output config has a natural home.

## Acceptance Criteria

- [ ] `src/types/wizard.ts` — `AppConfig` is reduced to a single field:
      `{ outputMethod: 'zip' | 'github' }`. `primaryRecordType` and
      `listDisplayFields` are removed.
- [ ] `src/app/state/WizardState.ts`:
  - The default `AppConfig` produced by `initializeWizardState` is
    `{ outputMethod: 'zip' }`.
  - The existing legacy-field migration block (currently lines 165–174,
    which deletes `state.appInfo.domain` and `state.appConfig.domain`)
    is extended to also delete `state.appConfig.primaryRecordType` and
    `state.appConfig.listDisplayFields` if present on persisted state. New
    saves do not include them.
- [ ] `src/app/operations/RecordTypeOps.ts` — the `Auto-clear
      primaryRecordType` block (lines 102–105 in `performDelete`) is removed.
      No replacement is needed; nothing else depends on the field.
- [ ] `src/app/export/OutputGenerator.ts`:
  - The "Ensure appConfig has a primary record type" block (lines 21–24) is
    removed.
  - The `generateAllFiles` call drops the second argument:
    `await generateAllFiles(wizardState)`.
  - The `outputMethod` read at line 30 stays (still consumed).
- [ ] `src/generator/index.ts`:
  - `generateAllFiles` signature drops the `appConfig: AppConfig` parameter.
    The body does not currently read `appConfig`, so no further code change is
    needed inside the function.
  - The `AppConfig` import is removed if it has no other use in the file.
- [ ] `src/generator/components/RecordList.ts`,
      `src/generator/components/RecordDetail.ts`,
      `src/generator/components/RecordForm.ts` are deleted. (No callers exist
      in `src/` and no test files reference these specific generators.)
- [ ] `src/types/generation.ts` — `AppConfig` is no longer reimported or
      reexported here unless something still needs it. (Currently the only
      remaining consumer would be `GenerationContext`, which is itself
      unused — leave `GenerationContext` alone for this spec; just keep the
      file's imports/exports consistent with whatever remains used.)
- [ ] Test fixtures are updated to drop the removed fields:
  - `tests/generator/ViewPage.test.ts` (lines 104–106)
  - `tests/generator/checklist.test.ts` (lines 79–81)
  - `tests/services/ProjectService.test.ts` (line 48)
  - Each fixture's `appConfig` becomes `{ outputMethod: 'zip' }` (or whatever
    the test was using; keep `outputMethod` value as-is per fixture).
- [ ] No new tests are added for the removals themselves; existing tests
      passing demonstrates nothing else depended on the fields.
- [ ] `npm run verify` passes (build + vitest + playwright e2e smoke).

## Scope

**In scope:**
- Remove `primaryRecordType` and `listDisplayFields` from the `AppConfig`
  type, the default state, the delete-time housekeeping, and the export-time
  housekeeping.
- Delete the three legacy generator files (`RecordList.ts`, `RecordDetail.ts`,
  `RecordForm.ts`).
- Drop the unused `appConfig` parameter from `generateAllFiles`.
- Add a state-load migration that strips the two legacy keys from previously
  persisted `appConfig` objects.
- Update test fixtures that still set the removed keys.

**Out of scope:**
- Any change to `outputMethod` or to the Generate panel's output-method UI —
  that field stays exactly as it is.
- Inlining `AppConfig` onto `WizardState`. We are intentionally keeping the
  one-field type.
- Removing `GenerationContext` from `src/types/generation.ts` even though it
  is unused — that's a separate cleanup and outside this spec.
- Any UI to capture per-app output config beyond what already exists.
- Generator behavioral changes. The generator already does not read these
  fields; this spec just removes the threading.

## Files Likely Affected

- `src/types/wizard.ts` — reduce `AppConfig` to `{ outputMethod }`.
- `src/app/state/WizardState.ts` — update default state and extend the
  legacy-field migration block.
- `src/app/operations/RecordTypeOps.ts` — remove `primaryRecordType`
  auto-clear in `performDelete`.
- `src/app/export/OutputGenerator.ts` — remove the `primaryRecordType`
  defaulting; drop the second argument when calling `generateAllFiles`.
- `src/generator/index.ts` — drop the `appConfig` parameter from
  `generateAllFiles`; remove now-unused `AppConfig` import if applicable.
- `src/generator/components/RecordList.ts` — delete.
- `src/generator/components/RecordDetail.ts` — delete.
- `src/generator/components/RecordForm.ts` — delete.
- `src/types/generation.ts` — leave `AppConfig` reexport in place (still
  used as a type alias by anything that imports from this module; remove
  only if nothing imports it after the cleanup — verify during
  implementation).
- `tests/generator/ViewPage.test.ts` — update fixture.
- `tests/generator/checklist.test.ts` — update fixture.
- `tests/services/ProjectService.test.ts` — update fixture.

## Behavioral Scenarios

**Scenario: Generate an app after the cleanup**
- Setup: A wizard state with one record type `note`, one view containing one
  checklist component bound to `note`. `appConfig.outputMethod = 'zip'`.
- Action: User clicks Download ZIP and confirms.
- Expected outcome: Generation succeeds. The generated file set is identical
  to what the same state produced before the cleanup. Nothing in the
  generated app references the removed `primaryRecordType` or
  `listDisplayFields` (it never did).

**Scenario: Delete a record type after the cleanup**
- Setup: Two record types `note` and `tag` exist. (Pre-cleanup,
  `appConfig.primaryRecordType` might have been auto-set to one of them.)
- Action: User deletes `note`.
- Expected outcome: Deletion proceeds normally via the existing
  cannot-delete-if-referenced check. There is no `primaryRecordType` to
  reconcile and no error path triggered by its absence.

**Scenario: Loading a session saved before this change**
- Setup: Persisted `WizardState` JSON contains
  `appConfig: { primaryRecordType: 'note', listDisplayFields: ['title'],
  outputMethod: 'zip' }` from a prior version.
- Action: User loads/resumes the session.
- Expected outcome: The loader produces an in-memory `appConfig` with only
  `outputMethod: 'zip'`; the two legacy keys are silently dropped. Nothing in
  the UI references them. On next save, only `outputMethod` is persisted.

**Scenario: Loading a session with an unknown `outputMethod`**
- Setup: Persisted `appConfig: { outputMethod: 'github' }`.
- Action: User loads/resumes and clicks Download.
- Expected outcome: Behaves identically to before the cleanup — the GitHub
  export path runs (existing behavior; this spec does not change it).

## How to Verify

- Build: `npm run build` is clean — no orphan references to
  `primaryRecordType`, `listDisplayFields`, `generateListViewTs`,
  `generateDetailViewTs`, or `generateFormViewTs`. The signature change to
  `generateAllFiles` propagates without TypeScript errors.
- Unit: `npx vitest run` — updated fixtures pass; no new tests are required.
- E2E: `npx playwright test` — the smoke spec (`e2e/smoke.spec.ts`) still
  drives a wizard flow ending in a successful download.
- Manual: open the wizard, build a small app (one record type, one view,
  one component), generate ZIP, confirm the output looks the same as before
  the cleanup.
- `npm run verify` is the gate — must pass.
