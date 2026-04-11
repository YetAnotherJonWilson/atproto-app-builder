#  Spec: Phase 8 — Layout Migration Cleanup

**Status:** done
**Date:** 2026-04-10
**Parent spec:** `.specs/active/layout-migration-sidebar-workspace.md` (Phase 8)

## What

Delete the deprecated step view files and remaining dead DOM / code left
over from the sidebar layout migration. After Phases 0–7, the wizard is
fully driven by `WorkspaceLayout` + the panel modules, but the old
step-based view files (`deprecatedStep1AppInfo.ts` through
`deprecatedStep7Generate.ts`, plus `step2.html` and `Step2.ts`) are still
sitting in the tree, unused. A handful of commented-out HTML, dead DOM
ids, and dead functions also remain. This phase removes all of it so the
codebase no longer references concepts that don't exist anymore.

## Why

The deprecated files still compile as part of `tsc`, still ship in
editor search results, and continue to confuse anyone exploring the
codebase (new contributors or AI agents) because they describe a flow
the app no longer has. The `showSaveConfirmation()` function writes to a
DOM node (`#wizard-progress-text`) that no longer exists, meaning the
"Progress saved!" feedback has been silently broken since Phase 1.
Removing these leaves the codebase honest about what it actually does.

## Acceptance Criteria

- [ ] Deprecated step view files are deleted
  - `src/app/views/deprecatedStep1AppInfo.ts`
  - `src/app/views/deprecatedStep2RecordTypes.ts`
  - `src/app/views/deprecatedStep3Fields.ts`
  - `src/app/views/deprecatedStep4Queries.ts`
  - `src/app/views/deprecatedStep5Procedures.ts`
  - `src/app/views/deprecatedStep6Config.ts`
  - `src/app/views/deprecatedStep7Generate.ts`
  - `src/app/views/step2.html`
  - `src/app/views/Step2.ts`
  - After deletion, nothing in `src/`, `tests/`, or `index.html`
    references any of these files. A repo-wide grep for `deprecatedStep`,
    `Step2`, `step2.html`, `renderStep2`, or `wireStep2` returns no hits
    in production code (spec files may still reference them).

- [ ] `index.html` no longer contains dead markup
  - The commented-out `<!-- <div class="wizard-progress">...</div> -->`
    block (the old step progress bar) is removed entirely.
  - The hidden `<button id="wizard-back">` element is removed. The
    sidebar layout has no concept of "back", and `Initialization.ts`
    already does not wire it up.
  - The `#wizard-next` button stays. It is the landing-page
    "Start Building →" button and is still wired in `Initialization.ts`
    via `enterWizard()`.
  - The `.wizard-nav` / `.wizard-nav-main` wrapper divs may stay as the
    container for `#wizard-next`. They have no CSS rules anymore but
    removing them is out of scope for this phase.

- [ ] Dead progress-text code is removed from `WizardState.ts`
  - `showSaveConfirmation()` is deleted (it writes to
    `#wizard-progress-text`, which no longer exists in the DOM).
  - Its single caller inside `saveWizardState()` (around line 344) is
    also removed. Save still persists state; it just no longer tries to
    flash a "Progress saved!" message into a non-existent element.
  - No replacement "save confirmation" UI is added — if we want one
    later, it's a separate spec.

- [ ] Stale "Phase 8" comment in `Initialization.ts` is removed
  - The comment block above the `#wizard-next` wiring that says
    `"(#wizard-back) is hidden in HTML and unused in the sidebar layout;`
    `it will be removed in Phase 8."` is removed along with the button.
    A shorter one-line comment explaining what the click handler does is
    acceptable but not required.

- [ ] Build and tests pass
  - `npm run build` passes with no new TypeScript errors.
  - `npx vitest run` passes with no failing tests. No test files should
    need changes (existing tests don't import any of the deprecated
    modules — verified by grep), but if any test fails due to an
    unexpected import it should be updated to reference the live module.

- [ ] BACKLOG and migration spec are updated
  - `BACKLOG.md` Phase 8 checkbox is marked `[x]`.
  - `.specs/active/layout-migration-sidebar-workspace.md` Phase 8
    checklist items are marked `[x]` where they are actually done (see
    Scope → Explicitly deferred below for items we are intentionally
    skipping).
  - `.specs/active/layout-migration-sidebar-workspace.md` is moved to
    `.specs/done/layout-migration-sidebar-workspace.md` since all
    phases are now complete.
  - This spec (`phase-8-cleanup.md`) is moved to `.specs/done/` with
    `Status:` updated to `done`.

## Scope

**In scope:**
- Deleting the 9 deprecated view files listed above
- Removing the commented-out progress bar block from `index.html`
- Removing the `#wizard-back` button from `index.html`
- Deleting `showSaveConfirmation()` and its caller in `WizardState.ts`
- Removing the stale Phase 8 comment in `Initialization.ts`
- Marking spec checkboxes and moving specs to `.specs/done/`

**Out of scope:**
- Removing `window.wizardOps` / replacing it with event delegation
  (the Phase 8 checklist marks this as optional and we are skipping it)
- Removing the `.wizard-nav` / `.wizard-nav-main` wrapper divs from
  `index.html` (they are dead CSS class names but still hold the live
  `#wizard-next` button; removing them requires touching CSS /layout
  and is not worth the risk here)
- Removing `currentStep` from `WizardState` (Phase 7 explicitly
  deferred this indefinitely for save-state compatibility)
- Any CSS rule removal. Step-specific rules (`.wizard-columns`,
  `.wizard-column-*`, `.wizard-progress-*`) were already removed in
  an earlier phase — a grep of `styles.css` returns zero hits for
  these names. There is nothing left to delete on the CSS side.
- Adding any new "save confirmation" UI to replace the one being
  removed — deferred to a separate spec if we decide we want it.

## Files Likely Affected

### Deleted
- `src/app/views/deprecatedStep1AppInfo.ts`
- `src/app/views/deprecatedStep2RecordTypes.ts`
- `src/app/views/deprecatedStep3Fields.ts`
- `src/app/views/deprecatedStep4Queries.ts`
- `src/app/views/deprecatedStep5Procedures.ts`
- `src/app/views/deprecatedStep6Config.ts`
- `src/app/views/deprecatedStep7Generate.ts`
- `src/app/views/step2.html`
- `src/app/views/Step2.ts`

### Modified
- `index.html` — remove commented progress bar block and
  `#wizard-back` button
- `src/app/state/WizardState.ts` — remove `showSaveConfirmation()` and
  its caller in `saveWizardState()`
- `src/app/bootstrap/Initialization.ts` — remove stale Phase 8 comment
- `BACKLOG.md` — check off Phase 8
- `.specs/active/layout-migration-sidebar-workspace.md` — check off
  Phase 8 items and move to `.specs/done/`
- `.specs/active/phase-8-cleanup.md` — set status to `done` and move
  to `.specs/done/`

## How to Verify

1. After each deletion / edit, run `npm run build` and
   `npx vitest run`. Both must pass.
2. Grep the repo for `deprecatedStep`, `Step2`, `step2.html`,
   `renderStep2`, `wireStep2`, `showSaveConfirmation`,
   `wizard-progress-text`, and `wizard-back`. No hits should appear in
   `src/`, `tests/`, or `index.html` (only in `.specs/`, which is
   expected).
3. Manual smoke test in a dev build:
   - Landing page loads; clicking "Start Building →" enters the wizard
     and prompts for an app name.
   - Inside the wizard, the sidebar renders all 5 panels and clicking
     each one switches the active panel.
   - Editing a record type / field / requirement / block / view still
     works (dialogs open, saves persist in localStorage).
   - No console errors.
