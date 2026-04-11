# Spec: Sidebar Sections Stale on Reload / Section Switch

**Status:** done
**Date:** 2026-04-10

## What

On page load or reload, the sidebar only reflects saved state for the
*active* section. Every other section shows its static "None yet"
placeholder from `workspace.html` until the user clicks into it. Fix it
so all five sidebar sections (Requirements, Data, Components, Views,
Generate) always render their counts, badges, and summary items from
state, regardless of which section is active.

## Why

`WorkspaceLayout.switchSection()` only calls the per-section sidebar
updater (`updateRequirementsSidebar`, `updateComponentsSidebar`,
`updateViewsSidebar`, `updateGenerateSidebar`) inside the per-section
`if` branch. The only exception is `updateDataSidebar()`, which is
already called unconditionally.

Concrete symptom caught by the new Playwright e2e test: after adding a
Requirement, switching to the Generate panel, then reloading the page,
the Requirements entry in the sidebar shows "None yet" — even though
the requirement is still in `localStorage` and is correctly reflected
in the Generate panel's Review section.

This is also confusing when users switch between sections. Clicking
from Requirements to Views while on a saved project currently leaves
the Requirements sidebar stale (the count updates because `updateBadge`
reads fresh state on each call, but if new requirements were added via
another tab or a PDS sync, the item list wouldn't refresh).

## Acceptance Criteria

- [ ] All five `update*Sidebar()` functions run on every call to
      `switchSection`, not just the one matching the active section
  - Order: Requirements → Data → Components → Views → Generate
  - Moved out of the per-section `if/else if` block so they run
    unconditionally
  - Panel wiring functions (`wireRequirementsPanel`,
    `wireDataPanel`, `wireComponentsPanel`, `wireViewsPanel`,
    `wireGeneratePanel`) stay in the per-section branch — they bind
    events to freshly-rendered DOM and should only run for the
    active section

- [ ] Reloading the page on any section with saved state shows the
      correct sidebar state for all five sections
  - Requirements sidebar reflects `state.requirements`
  - Data sidebar reflects `state.recordTypes`
  - Components sidebar reflects `state.components`
  - Views sidebar reflects `state.views`
  - Generate sidebar reflects whatever it normally displays (derived
    counts)

- [ ] The existing Playwright e2e test (`e2e/smoke.spec.ts`) can be
      simplified to assert post-reload sidebar state directly, without
      the current workaround of clicking back into the Requirements
      section after reload

- [ ] `npm run build` passes
- [ ] `npx vitest run` passes (523 tests)
- [ ] `npx playwright test` passes

## Scope

**In scope:**
- `src/app/views/WorkspaceLayout.ts` — move the four per-section
  sidebar updater calls out of the `if/else if` block so they run
  alongside `updateDataSidebar()`
- `e2e/smoke.spec.ts` — drop the "click Requirements after reload"
  workaround and assert the sidebar item directly

**Out of scope:**
- Any refactor of how `update*Sidebar` functions read state or
  render DOM — the fix is purely about *when* they're called
- Any change to the panel wiring functions
- Any change to the static `workspace.html` template
- Fixing drift between tabs (cross-tab synchronization is a bigger
  concern; this spec only addresses single-tab reload state)

## Files Likely Affected

- `src/app/views/WorkspaceLayout.ts` — move 4 function calls
- `e2e/smoke.spec.ts` — simplify reload assertion

## How to Verify

1. `npm run build` passes
2. `npx vitest run` passes
3. `npx playwright test` passes
4. Manual: add a Requirement, click Generate in sidebar, reload the
   page. The Requirements section in the sidebar should show the
   requirement text (not "None yet")
