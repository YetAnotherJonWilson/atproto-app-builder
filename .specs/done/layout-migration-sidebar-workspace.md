# Spec: Layout Migration — Sidebar + Workspace (Mockup 3b)

**Status:** done
**Date:** 2026-03-14 (completed 2026-04-10)

## What

Replace the current sequential step-based wizard (steps 2–7) with a sidebar + workspace layout based on mockup 3b. The sidebar shows a vertical progress track with 4 sections (Requirements, Data, Components, Views), each with summary item lists. The workspace shows the active section's full editing interface. Navigation between sections is non-linear — users can click any section at any time.

Step 0 (landing page) and the global header are redesigned in a prerequisite spec (`landing-page-header-redesign.md`), which also deletes Step 1. That spec should be implemented first. The sidebar layout replaces what was previously steps 2–7. The landing-to-wizard transition animation (sidebar slide-in, overlay flash, header shrink) is demonstrated in `mockups/4-landing-to-wizard-transition.html` and should be implemented as part of Phase 1 below.

## Why

The current sequential step flow doesn't match the iterative nature of app design. Users need to move freely between defining requirements, data types, components, and views — and see the state of other sections while working in one. The sidebar layout provides persistent cross-section visibility with ample workspace for forms and content.

## Guiding Principles

- **Don't break what works.** Dialogs, operations, state management, and the generator are decoupled and stay untouched.
- **Migrate incrementally.** Each phase should leave the app in a working state.
- **Reuse existing code.** The deprecated step renderers contain working logic for rendering lists, wiring events, and managing state — extract and adapt, don't rewrite from scratch.
- **Test as you go.** Add tests for each new workspace panel before moving to the next.

---

## Codebase Audit Summary

### Fully Reusable (no changes needed)

- `src/app/operations/` — All 4 Ops modules (RecordTypeOps, FieldOps, QueryOps, ProcedureOps)
- `src/app/dialogs/` — DialogHandlers, DialogHelpers
- `src/app/state/WizardState.ts` — state singleton, persistence (minor: `showSaveConfirmation` references `#wizard-progress-text` which may not exist)
- `src/types/wizard.ts` — full type definitions
- `src/utils/` — all utilities (html, id, nsid, text)
- `src/generator/` — entire generator pipeline
- `index.html` — dialog HTML stays in place
- CSS component classes — `.wizard-form`, `.wizard-field`, `.wizard-input`, `.wizard-list-item`, `.wizard-button`, `.wizard-badge`, `.dialog-*`, etc.

### Needs Rework

- `src/app/views/StepRenderer.ts` — currently dispatches by step number; needs to become a section-based renderer or be replaced
- `src/app/navigation/StepNavigation.ts` — linear next/prev logic replaced by section switching; `STEP_NAMES` array, progress bar math, and `generateApp()` trigger at step 7 all need rethinking
- `src/app/navigation/HistoryManager.ts` — URL scheme changes from `?step=N` to section-based (e.g., `?section=requirements`)
- `src/app/bootstrap/Initialization.ts` — next/back button wiring changes; may need sidebar click wiring instead
- `src/app/views/step2.html` / `Step2.ts` — current WIP column layout, replaced by new sidebar template
- CSS: `.wizard-columns`, `.wizard-column-*` rules (experimental, can be removed); `.wizard-nav` (back/next bar, replaced by sidebar nav); `.wizard-progress-*` (progress bar, replaced by sidebar progress track)

### Can Be Deleted (after migration is complete)

- `src/app/views/deprecatedStep1AppInfo.ts` — form fields moved into App Info section or merged into intro
- `src/app/views/deprecatedStep2RecordTypes.ts` — logic migrates to Data workspace panel
- `src/app/views/deprecatedStep3Fields.ts` — logic migrates to Data workspace panel (sub-view)
- `src/app/views/deprecatedStep4Queries.ts` — logic migrates to Data or Requirements panel
- `src/app/views/deprecatedStep5Procedures.ts` — logic migrates to Data or Requirements panel
- `src/app/views/deprecatedStep6Config.ts` — logic migrates to a config section or Views panel
- `src/app/views/deprecatedStep7Generate.ts` — logic migrates to a Generate action/panel
- `src/app/data/DataCollector.ts` — all data capture moves to dialogs; no more form scraping on navigation
- `src/app/views/ComparisonChart.html` — orphan, unused
- `src/app/views/GettingStarted.html` — orphan, unused
- `src/app/views/GetStartedButton.html` — orphan, unused

### Open Design Questions

1. **Where do Queries and Procedures live?** They're currently separate steps but the generator doesn't use them yet. Options: (a) fold into the Data section as sub-tabs, (b) keep as hidden/advanced sections, (c) defer until the generator supports them.
2. **Where does App Config live?** (primary record type, list display fields) — could be a settings panel, part of the Generate flow, or a sub-section of Views.
3. **Where does Generate live?** Options: (a) a 5th sidebar section, (b) a top-level button that opens a review/generate dialog, (c) part of the Views panel as a final action.
4. **App Info fields** (name, domain, description, author) — currently in the deprecated Step 1. Options: (a) part of the intro step, (b) a settings/config section in the sidebar, (c) collected at generate time.

---

## Migration Phases

### Prerequisite: Landing Page & Header Redesign

See `landing-page-header-redesign.md`. Must be completed before starting this migration. That spec handles:

- Global header resize (smaller, 72px fixed height)
- Step 1 deletion (files and StepRenderer references)
- Version info and "App Wizard" link removal
- Login link restyle

### Phase 0: Preparation

- [x] Delete orphan HTML files: `ComparisonChart.html`, `GettingStarted.html`, `GetStartedButton.html`
- [x] Add the sidebar + workspace HTML template (based on mockup 3b) as new view files
- [x] Add new CSS for sidebar layout, progress track, next-step prompts (from mockup 3b)
- [x] Identify and mark (with comments) which CSS rules are step-layout–specific and will be removed later
- [x] Verify `npm run build` and `npx vitest run` pass

### Phase 1: Scaffold the New Layout

- [x] Create `src/app/views/WorkspaceLayout.ts` — renders the sidebar + workspace shell
- [x] Create `src/app/views/panels/` directory for workspace panel renderers
- [x] Create empty panel renderers: `RequirementsPanel.ts`, `DataPanel.ts`, `ComponentsPanel.ts`, `ViewsPanel.ts`
- [x] Wire `StepRenderer.ts` to render `WorkspaceLayout` when `currentStep === 2` (replacing the WIP step2.html)
- [x] Implement sidebar section switching (click handler updates active panel)
- [x] Implement progress track rendering (filled/hollow dots, progress line)
- [x] Implement the landing-to-wizard transition animation per `mockups/4-landing-to-wizard-transition.html`: sidebar slides in from the left (CSS transform, 500ms cubic-bezier), content area shifts right via margin-left, header shrinks from landing to state-wizard sizes
- [x] Verify build passes; manual test: can navigate to step 2 and see sidebar layout with empty panels

### Phase 2: Data Panel (highest existing code reuse)

- [x] Migrate record type list rendering from `deprecatedStep2RecordTypes.ts` into `DataPanel.ts`
- [x] Migrate field editing from `deprecatedStep3Fields.ts` into `DataPanel.ts` (as sub-view or tab)
- [x] Wire existing dialog operations (RecordTypeOps, FieldOps) — these should work unchanged
- [x] Update sidebar summary to show record type names and count
- [x] Add tests for DataPanel rendering
- [x] Verify: can add/edit/delete record types and fields in the new layout

### Phase 3: Requirements Panel (new functionality)

See `requirements-panel.md` for full behavioral spec, including empty-state intro content.

- [x] Verify Step 1 files are already deleted (handled by `landing-page-header-redesign.md`)
- [x] Design and implement the Requirements panel (this is new — requirements are a new concept not in the old wizard)
- [x] Implement empty state with intro content from the deleted Step 1 (what a decentralized app is, example app ideas)
- [x] Determine how requirements map to the existing state model (may need to extend `WizardState`)
- [x] Implement the 3 requirement types: Information, Data Interactions, Navigation
- [x] Add tests for RequirementsPanel
- [x] Verify: can add/edit/delete requirements

### Phase 4: Blocks Panel (was "Components Panel")

- [x] Design and implement the Blocks panel — see `.specs/done/blocks-panel.md`
- [x] Determine how blocks map to the state model (extended `WizardState` with `blocks` array)
- [x] Blocks reference data types defined in the Data panel
- [x] Add tests for BlocksPanel
- [x] Verify: can add/edit/delete blocks

### Phase 5: Views Panel

- [x] Design and implement the Views panel — see `.specs/done/views-panel.md`
- [x] Views assemble blocks into page layouts
- [x] Include navigation flow definitions between views
- [x] App Config (primary record type, display fields) auto-derived by generator — see `.specs/active/app-config-placement.md` for future overrides
- [x] Add tests for ViewsPanel
- [x] Verify: can add/edit/delete views

### Phase 6: Generate Flow

- [x] Decide on generate UX → 5th sidebar section — see `.specs/active/generate-panel.md`
- [x] Migrate review display from `deprecatedStep7Generate.ts` (lexicon preview, app summary)
- [x] Wire generate/download action (ZIP download via existing ZipExporter flow)
- [x] Add next-step card to Views panel pointing to Generate
- [x] Verify: can generate and download app output from new layout

### Phase 7: Navigation and History Rework

- [ ] Replace linear step navigation with section-based navigation
- [ ] Update `HistoryManager.ts` URL scheme to `?section=<name>`
- [ ] Update or remove `StepNavigation.ts` (next/back may no longer exist)
- [ ] Update or remove `DataCollector.ts` (if all data capture is dialog-based)
- [ ] Handle browser back/forward between sections
- [ ] Verify: URL reflects current section, browser nav works

### Phase 8: Cleanup — see `.specs/done/phase-8-cleanup.md`

- [x] Delete all deprecated step files
- [x] Delete orphaned `DataCollector.ts` if no longer used (done in Phase 7)
- [x] Remove step-specific CSS (`.wizard-columns`, `.wizard-column-*`, `.wizard-progress-*`) — already gone
- [x] Remove unused `STEP_NAMES` and progress bar logic from `StepNavigation.ts` (done in Phase 7)
- [ ] Remove `window.wizardOps` if replaced by event delegation (intentionally deferred — optional)
- [x] Update `index.html` to remove commented-out progress bar HTML
- [x] Final build + test pass

---

## Files Likely Affected

### New Files

- `src/app/views/WorkspaceLayout.ts` — sidebar + workspace shell renderer
- `src/app/views/workspace.html` — HTML template for the layout
- `src/app/views/panels/RequirementsPanel.ts`
- `src/app/views/panels/DataPanel.ts`
- `src/app/views/panels/ComponentsPanel.ts`
- `src/app/views/panels/ViewsPanel.ts`
- `tests/views/DataPanel.test.ts`
- `tests/views/RequirementsPanel.test.ts`
- `tests/views/ComponentsPanel.test.ts`
- `tests/views/ViewsPanel.test.ts`

### Modified Files

- `src/app/views/StepRenderer.ts` — dispatch to WorkspaceLayout for step 2+
- `src/app/navigation/StepNavigation.ts` — section-based nav
- `src/app/navigation/HistoryManager.ts` — URL scheme
- `src/app/bootstrap/Initialization.ts` — event wiring
- `src/app/state/WizardState.ts` — minor fix for `showSaveConfirmation`
- `src/types/wizard.ts` — added `SectionName` type and `activeSection` field to `WizardState` (Phase 1); may need more fields for Requirements/Components/Views
- `styles.css` — new sidebar styles, remove old step-specific styles

### Deleted Files (Phase 8)

- `src/app/views/deprecatedStep1AppInfo.ts`
- `src/app/views/deprecatedStep2RecordTypes.ts`
- `src/app/views/deprecatedStep3Fields.ts`
- `src/app/views/deprecatedStep4Queries.ts`
- `src/app/views/deprecatedStep5Procedures.ts`
- `src/app/views/deprecatedStep6Config.ts`
- `src/app/views/deprecatedStep7Generate.ts`
- `src/app/views/step2.html`
- `src/app/views/Step2.ts`
- `src/app/views/ComparisonChart.html`
- `src/app/views/GettingStarted.html`
- `src/app/views/GetStartedButton.html`
- `src/app/data/DataCollector.ts` (if fully replaced)

## How to Verify

- `npm run build` passes after each phase
- `npx vitest run` passes after each phase
- Manual testing: each panel can render, CRUD operations work, sidebar state updates, navigation between sections works, generate flow produces valid output
