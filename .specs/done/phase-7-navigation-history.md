# Spec: Phase 7 — Navigation and History Rework

**Status:** done
**Date:** 2026-04-10
**Parent spec:** `.specs/active/layout-migration-sidebar-workspace.md` (Phase 7)

## What

Replace the wizard's linear step-based navigation and URL scheme with
section-based navigation that matches the sidebar + workspace layout delivered
in Phases 0–6. After this phase, `currentStep` is only used internally as a
landing-vs-wizard binary (0 or 2); all in-wizard navigation flows through
`activeSection` and `switchSection()`. The URL reflects the active section
(`/wizard?section=<name>`) and browser back/forward cycle through visited
sections before eventually returning to the landing page.

## Why

Phases 0–6 delivered the sidebar layout but left the navigation and history
plumbing in its original step-based form. The result is that:

- Browser back/forward don't move between sidebar sections
- The URL says `?step=2` regardless of which panel the user is on
- `StepNavigation.ts`, `HistoryManager.ts`, `DataCollector.ts`, and
  `StepValidator.ts` contain large amounts of dead logic for deprecated
  steps 3–7 that no longer exist in the UI
- `StepRenderer.ts` still has case branches importing deleted-but-not-deleted
  step files, keeping deprecated code alive in the bundle

Cleaning this up removes the last of the step-based scaffolding and lets
Phase 8 delete the deprecated step files without blockers.

## Acceptance Criteria

- [ ] URL reflects the active section in the wizard
  - When the user is on the landing page, the URL is `/`.
  - When the user enters the wizard, the URL becomes
    `/wizard?section=<activeSection>`, where `<activeSection>` is whatever
    section is currently active in state (default `requirements`).
  - When the user clicks a sidebar or accordion section, the URL updates to
    `/wizard?section=<newSection>` and a new history entry is pushed.

- [ ] Browser back/forward cycles through visited sections
  - From `/wizard?section=data`, pressing back returns to the previously
    visited section (e.g. `?section=requirements`) without re-entering the
    wizard and without prompting to leave.
  - Pressing forward returns to `?section=data`.
  - `switchSection()` must not push a history entry when it is called as a
    result of a popstate event (otherwise back would be a no-op).

- [ ] Back navigation from the first wizard entry returns to the landing page
  - When the current history entry is the first `?section=<name>` entry the
    user pushed on entering the wizard, pressing back returns to `/`.
  - If `hasMeaningfulState(state)` is true, this back navigation is gated by
    the existing `guardedLeaveWizard` confirmation dialog. Canceling keeps
    the user on the current section (and restores the URL to that section).
  - Confirming transitions to the landing page with `transitionToLanding`.

- [ ] Direct section URLs load the correct panel
  - Visiting `/wizard?section=views` directly loads the wizard with the
    `views` panel active and sets `activeSection = 'views'` in state.
  - Visiting `/wizard?section=bogus` (or with no section param) falls back
    to `activeSection` from saved state, or `requirements` if none.
  - Visiting `/wizard` with no query parameters also falls back to the same
    default.

- [ ] Legacy `?step=N` URLs redirect gracefully
  - Visiting `/wizard?step=2` (or any `?step=N`) is treated the same as
    visiting `/wizard` with no parameters: fall back to the default section,
    and replace the URL with the canonical `?section=<name>` form using
    `history.replaceState` (no extra history entry).

- [ ] Dead navigation code is removed
  - `src/app/state/DataCollector.ts` is deleted.
  - `src/app/validation/StepValidator.ts` is deleted.
  - `StepRenderer.ts` no longer has case branches for steps 3–7 and no
    longer imports `deprecatedStep3Fields` through `deprecatedStep7Generate`.
    (The deprecated files themselves remain until Phase 8.)
  - `StepNavigation.ts` is reduced to two functions: `enterWizard()` (which
    handles the step 0 → wizard transition with the app-name prompt and
    transition animation) and `leaveWizard()` (which handles the wizard →
    landing transition via `guardedLeaveWizard` + `transitionToLanding`).
    The module may be renamed to `WizardEntry.ts` if convenient.
  - The old `updateProgressBar` function is deleted. The only remaining
    button-state work it did (changing the label of the landing-page
    `#wizard-next` button between "Start Building →" states) is either
    folded into `Step0.ts`/`enterWizard()` or removed if static.
  - All callers of the deleted exports are updated.

- [ ] Existing save/resume behavior is preserved
  - Saved states (localStorage and PDS) with `currentStep >= 2` still load
    into the wizard correctly.
  - `hasMeaningfulState()` continues to work (it reads `currentStep`).
  - `WizardState.currentStep` remains in the schema. It is set to 0 on
    landing and 2 in the wizard. No other values are written.

- [ ] Build and tests pass
  - `npm run build` passes.
  - `npx vitest run` passes. No existing tests need changes; if any fail
    because they import a deleted module, update them to use the new API.

## Scope

**In scope:**
- Rewriting `HistoryManager.ts` around sections
- Shrinking `StepNavigation.ts` (possibly renaming to `WizardEntry.ts`)
- Cleaning up `StepRenderer.ts` dead branches
- Deleting `DataCollector.ts` and `StepValidator.ts`
- Wiring `switchSection()` to push history entries
- Updating callers in `Initialization.ts` and `ProjectPickerDialog.ts`
- Handling legacy `?step=N` URLs

**Out of scope:**
- Deleting the deprecated step view files (`deprecatedStep3Fields.ts` …
  `deprecatedStep7Generate.ts`, `step2.html`, `Step2.ts`) — these go in
  Phase 8 along with other CSS cleanup
- Removing `#wizard-next` / `#wizard-back` from `index.html` — also Phase 8.
  Phase 7 only rewires the Next click handler (via `enterWizard`) and leaves
  the Back button hidden as it already is
- Removing `currentStep` from `WizardState` — deferred indefinitely to keep
  save-state compatibility
- Any UX-visible changes beyond URL behavior and browser back/forward

## Files Likely Affected

### Modified
- `src/app/navigation/HistoryManager.ts` — full rewrite around sections
- `src/app/navigation/StepNavigation.ts` — shrunk to `enterWizard` /
  `leaveWizard`
- `src/app/views/StepRenderer.ts` — remove deprecated step branches
- `src/app/views/WorkspaceLayout.ts` — `switchSection` pushes history
- `src/app/bootstrap/Initialization.ts` — update imports / wiring
- `src/app/auth/ProjectPickerDialog.ts` — update imports if any are broken

### Deleted
- `src/app/state/DataCollector.ts`
- `src/app/validation/StepValidator.ts`

### Untouched (on purpose)
- `index.html` — `#wizard-next` / `#wizard-back` stay
- `src/types/wizard.ts` — `currentStep` stays in `WizardState`
- All deprecated step `.ts` / `.html` files — deferred to Phase 8

## Ambiguity Warnings

1. **History entry for the initial wizard entry**
   When the user clicks "Start Building →" on the landing page, should we
   push one history entry (`?section=requirements`) or two (first `/wizard`,
   then `?section=requirements`)?
   - _Likely assumption:_ Push exactly one entry for the entry transition,
     so that pressing back returns directly to `/`. This matches the current
     behavior of `pushStepToHistory(2)`.

2. **switchSection called during initial render**
   `wireWorkspaceLayout()` calls `switchSection(activeSection)` during the
   initial setup. This must not push a duplicate history entry on top of the
   one from entering the wizard.
   - _Likely assumption:_ Add an internal `suppressHistoryPush` flag (or a
     second parameter to `switchSection`) that the initial-render and
     popstate-driven calls use to skip the history push.

## Behavioral Scenarios

**Scenario: Enter wizard and move through sections**
- Setup: user on `/` (landing page), no saved state
- Action: click "Start Building →", enter app name in the prompt, then click
  Data in the sidebar, then click Views
- Expected: URL progresses `/` → `/wizard?section=requirements` →
  `/wizard?section=data` → `/wizard?section=views`; history has 4 entries

**Scenario: Back through sections, then to landing**
- Setup: continuing from the previous scenario (history has 4 entries)
- Action: press back 3 times
- Expected:
  - 1st back: URL becomes `/wizard?section=data`, Data panel renders,
    no confirmation dialog
  - 2nd back: URL becomes `/wizard?section=requirements`, Requirements
    panel renders, no confirmation dialog
  - 3rd back: `guardedLeaveWizard` dialog shows (because state has an
    app name and we're at the initial wizard entry). If confirmed:
    transition to landing, URL `/`. If canceled: URL and active section
    stay on `requirements`.

**Scenario: Direct section URL**
- Setup: user navigates directly to `/wizard?section=views`
- Action: page loads
- Expected: wizard layout renders with Views panel active,
  `activeSection = 'views'` in state

**Scenario: Legacy step URL**
- Setup: user has a bookmark to `/wizard?step=2`
- Action: visit that URL
- Expected: wizard loads on the saved `activeSection` (or `requirements`
  by default); URL is replaced in place with `/wizard?section=<name>`;
  no extra history entry

**Scenario: Unknown section name**
- Setup: user visits `/wizard?section=bogus`
- Action: page loads
- Expected: treated like no section param — wizard loads on the saved
  `activeSection` or `requirements`; URL replaced with the canonical
  `?section=<name>` form

**Scenario: Saved-state load from PDS project picker**
- Setup: user is logged in, opens project picker, selects a saved project
- Action: click Load
- Expected: `reloadUI()` in `ProjectPickerDialog.ts` correctly renders the
  wizard with the project's `activeSection` active, URL reflects that
  section. (No regression from current behavior.)

## How to Verify

- `npm run build` passes after each atomic commit
- `npx vitest run` passes after each atomic commit
- Manually walk each behavioral scenario in a local dev build
- DevTools → Application → History: confirm entries look correct
- DevTools console: confirm no errors from missing imports
