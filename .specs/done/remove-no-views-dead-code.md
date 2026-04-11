# Spec: Remove No-Views Dead Code from Navigate Forms

**Status:** done
**Date:** 2026-03-23 (completed 2026-04-10)

## What

Remove the "no views" disabled/placeholder branches from the navigate sub-forms in RequirementsPanel. The app always has at least one view — `initializeWizardState()` seeds a "Home" view, and the Views panel enforces a minimum of one view (delete is blocked when `views.length <= 1`). The no-views code paths are unreachable dead code.

## Why

Dead code adds noise and maintenance burden. Every navigate sub-form has a `hasViews` branch that renders disabled selects and placeholder text with "No views yet" / "Create some views first" hints. These paths can never execute in practice.

## Acceptance Criteria

- [ ] `renderDirectLinkFields` no longer accepts or checks `hasViews` — always renders populated selects
- [ ] `renderMenuFields` no longer accepts or checks `hasViews` — always renders the include-all toggle and checkbox list
- [ ] `renderForwardBackFields` no longer accepts or checks `hasViews` — always renders the page order and control type
- [ ] `renderNavSubtypeFields` no longer passes `hasViews` to sub-renderers
- [ ] The `.nav-no-views-hint` and `.checkbox-list-placeholder` CSS classes can be removed if no longer referenced elsewhere
- [ ] `npm run build` compiles without errors
- [ ] `npx vitest run` passes

## Scope

**In scope:**
- Removing `hasViews` parameter and dead branches from `renderDirectLinkFields`, `renderMenuFields`, `renderForwardBackFields`
- Removing the `hasViews` local in `renderNavSubtypeFields`
- Removing `.nav-no-views-hint` CSS if unused after cleanup
- Updating or removing any tests that assert the no-views behavior

**Out of scope:**
- Changing the Views panel minimum-view enforcement
- Changing `initializeWizardState` seeding

## Files Likely Affected

- `src/app/views/panels/RequirementsPanel.ts` — remove `hasViews` branches from 3 render functions
- `styles/workspace/inline-form.css` — remove `.nav-no-views-hint` if unused
- `styles/workspace/item-card.css` — check if `.checkbox-list-placeholder` is used elsewhere before removing
- `tests/views/RequirementsPanel.test.ts` — remove or update tests asserting no-views placeholder behavior

## How to Verify

1. `npm run build` passes
2. `npx vitest run` passes
3. Grep for `hasViews`, `nav-no-views-hint`, `No views yet`, `Create some views first` in RequirementsPanel — no hits
