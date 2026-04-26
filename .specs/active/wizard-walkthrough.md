# Spec: Wizard Walkthrough / Guided Tour

**Status:** draft
**Date:** 2026-03-14 (updated 2026-04-25 with dialog-chain approach)

## What

An interactive walkthrough that introduces first-time users to the wizard interface as a chain of dialogs — one per major panel — explaining what each panel is for and the iterative, non-linear workflow between them. The walkthrough auto-launches on first visit, can be navigated forward or backward through the chain, can be skipped without permanently dismissing it, can be permanently dismissed, and is re-launchable at any time from a persistent UI element visible from every panel.

## Why

The wizard has multiple panels (Requirements, Data, Components, Views) and a non-linear, iterative workflow. First-time users need orientation to understand how the pieces fit together and how to move between them. A chain of per-panel dialogs is enough to do this without building a heavy "guided tour" overlay — each dialog appears in context, on the panel it describes, and the user controls whether to keep advancing, drop in and try the panel themselves, back up, or stop.

## Walkthrough Flow

The walkthrough is a sequence of one dialog per panel, in the panel order: **Requirements → Data → Components → Views.**

### First dialog (Requirements panel)

Auto-opens on first visit to the wizard. Content:
- A short introduction to the Requirements panel (what it's for).
- A pointer to where the persistent "open walkthrough" button lives, with reassurance that it's accessible from every panel so the walkthrough can be re-opened at any time.

Options (3):
1. **Begin working on requirements** — closes the dialog. Does *not* permanently dismiss the walkthrough; the next session may auto-show it again (see Ambiguity #2).
2. **See how to create data types** — navigates to the Data panel and opens its walkthrough dialog.
3. **Close and don't show this again** — closes the dialog and permanently dismisses the walkthrough so it does not auto-show in future sessions. The persistent re-launch button still works.

### Subsequent dialogs (Data, Components, Views panels)

Same shape as the first dialog, but with one additional option prepended to the option list — so subsequent dialogs have **4 options**:

1. **Return to the previous panel** — navigates back to the previous panel and reopens its walkthrough dialog.
2. **Begin working on [this panel's domain]** — closes the dialog. Same not-permanently-dismiss semantics as option 1 on the first dialog.
3. **See how to [next panel's topic]** — navigates forward and opens the next panel's walkthrough dialog. (Omitted on the final panel — see Ambiguity #1.)
4. **Close and don't show this again** — same permanent-dismiss as option 3 on the first dialog.

### Re-launching from the persistent button

Clicking the persistent button at any time opens the dialog **for the panel the user is currently on**. From there the user can navigate the chain forward or backward as above. (Alternative: always restart from the Requirements dialog. See Ambiguity #3.)

## Acceptance Criteria

- [ ] **Auto-launch on first visit** — the Requirements walkthrough dialog opens automatically the first time the user enters the wizard, gated by a persisted flag.
- [ ] **Persistent re-launch UI element, visible from every panel** — a button (or icon) is present in shared chrome (sidebar / header / similar — to be decided in mockups) so the walkthrough is reachable from any panel at any time.
- [ ] **Per-panel dialog content** — each major panel (Requirements, Data, Components, Views) has its own walkthrough dialog with content describing what that panel is for.
- [ ] **First dialog has 3 options** — "Begin working on requirements," "See how to create data types," "Close and don't show this again."
- [ ] **Subsequent dialogs have 4 options** — "Return to [previous panel]" prepended to the same three.
- [ ] **Forward navigation** — selecting "See how to ..." navigates to the named panel and opens its walkthrough dialog.
- [ ] **Backward navigation** — selecting "Return to ..." navigates to the previous panel and opens its walkthrough dialog.
- [ ] **Soft close vs. permanent dismiss are distinct** — the "Begin working on ..." option does not set the persisted flag; only "Close and don't show this again" does. After a soft close, auto-launch may still occur in a future session (see Ambiguity #2). After a permanent dismiss, auto-launch never occurs again.
- [ ] **Re-launch always works** — clicking the persistent button opens the walkthrough regardless of dismiss state.
- [ ] **Walkthrough state is persisted** — the dismiss flag survives reload (mechanism to be decided — likely the same WizardState pattern used for `hasSeenWelcome`).
- [ ] **Mockups approved before this spec is marked `ready`** — at least one mockup of the dialog (covering both the 3-option and 4-option variants) is created, reviewed, and signed off. Until that's done, this spec stays in `draft`.

## Scope

**In scope:**
- The dialog chain UI and per-dialog content.
- First-visit detection and auto-launch.
- Persistent re-launch UI element and its location.
- Forward and backward navigation between panels via dialog options.
- Soft-close vs. permanent-dismiss state handling.

**Out of scope:**
- Video tutorials or external documentation.
- Per-field tooltips, contextual help bubbles, or empty-state hints inside panels — separate features.
- Branched paths through the walkthrough (the user only ever moves linearly through the panel order — Requirements ↔ Data ↔ Components ↔ Views).
- Localization / multiple languages.

## Files Likely Affected

To be determined once the mockup is approved. Likely candidates based on current layout:
- `src/app/views/WorkspaceLayout.ts` — for the persistent re-launch UI element.
- A new dialog module under `src/app/dialogs/` (e.g., `WalkthroughDialog.ts`) following the same `wizard-dialog` pattern as `PromptDialog`, `ProjectPickerDialog`, `LoginDialog`.
- `src/types/wizard.ts` — add a persisted dismiss flag to `WizardState` (e.g., `hasDismissedWalkthrough`).
- The panel render entry points (`RequirementsPanel`, `DataPanel`, `ComponentsPanel`, `ViewsPanel`) may need a hook to know the dialog should open when navigated-to from another walkthrough dialog.

## Ambiguity Warnings

1. **Last-panel behavior (Views).**
   The forward "See how to ..." option needs a different shape on the final panel — there's nothing to advance to. Likely options for the Views dialog: (a) drop the forward option entirely, leaving 3 options ("Return to Components" + "Begin working on views" + "Close and don't show this again"); or (b) replace it with a "You're all set" affordance that closes and permanently dismisses, since reaching the end of the chain is a strong "I've seen the tour" signal.
   - _Likely assumption:_ option (a) — drop the forward option, keep the soft-close vs. permanent-dismiss distinction, let the user end the tour by either closing option.
   - _Decide during mockup._

2. **Soft-close auto-show semantics.**
   "Begin working on requirements" closes the dialog without permanently dismissing — but what triggers a re-show in the next session? Options: (a) auto-show every session until permanently dismissed (annoying); (b) auto-show only if the user has not yet completed any meaningful work in the wizard (better but vague — what counts?); (c) never auto-show after the first dismissal of any kind, including soft (simpler but blurs the distinction).
   - _Likely assumption:_ (b) with a concrete signal — e.g., auto-show on any session where the project still has zero record types, components, and views (i.e., the user genuinely hasn't started). Otherwise the user has already engaged and the persistent button is sufficient.
   - _Confirm during mockup / before marking ready._

3. **Re-launch starting point.**
   When the user clicks the persistent button, does the dialog open at (a) the panel the user is currently on, or (b) always at the Requirements dialog (start of the chain)?
   - _Likely assumption:_ (a) — opens for the current panel. The user clicked the button on this panel because they want context for it, not because they want to restart the tour from the top. Forward/backward navigation is still available from there.
   - _Confirm during mockup._

4. **Persistent-button location.**
   The button must be visible from every panel. Candidate locations: sidebar (alongside save/login), header, a floating help icon. Each has tradeoffs around visibility and discoverability.
   - _Likely assumption:_ in the sidebar near the save/login controls, since that's already the persistent chrome users glance at.
   - _Decide during mockup._

5. **Narrow / accordion layout.**
   The wizard has a responsive narrow layout (per `.specs/done/narrow-accordion-layout.md`). The dialog chain needs to work there too — both the dialog itself (already a `wizard-dialog`, which presumably handles narrow viewports) and the persistent button location.
   - _Likely assumption:_ standard `wizard-dialog` behavior covers the dialog; the persistent button location is the same UI element as on desktop.
   - _Confirm during mockup._

6. **Adopted vs. fresh data type panel content.**
   The Data panel covers both creating new lexicons and adopting existing ones. The walkthrough dialog needs to decide whether to mention both or focus on one (e.g., "create a new data type" vs. "create or adopt a data type").
   - _Likely assumption:_ mention both briefly; users with existing lexicons in mind benefit from knowing adoption is supported.
   - _Decide during mockup / content draft._

## Behavioral Scenarios

**Scenario: First-time visitor completes the tour forward**
- Setup: fresh browser, no saved wizard state.
- Action: user enters the wizard. Requirements dialog auto-opens. User clicks "See how to create data types." Data dialog opens on the Data panel. User clicks "See how to create components." Components dialog opens. User clicks "See how to create views." Views dialog opens.
- Expected: each click navigates to the next panel and opens the next dialog. The persistent re-launch button is visible the whole time.

**Scenario: First-time visitor backs up mid-tour**
- Setup: same as above, user has reached the Components dialog.
- Action: user clicks "Return to Data."
- Expected: navigates back to the Data panel and re-opens the Data dialog. From there they can go forward, back to Requirements, or close.

**Scenario: User soft-closes from the first dialog**
- Setup: fresh browser, Requirements dialog has just auto-opened.
- Action: user clicks "Begin working on requirements."
- Expected: dialog closes. Persistent re-launch button remains visible. The dismiss flag is *not* set; per Ambiguity #2's assumption, the next session may auto-show again if the user still has an empty project.

**Scenario: User permanently dismisses**
- Setup: any panel, walkthrough dialog open.
- Action: user clicks "Close and don't show this again."
- Expected: dialog closes. Dismiss flag is set. No auto-show in future sessions. Persistent button still works.

**Scenario: User re-launches from the persistent button after dismissing**
- Setup: walkthrough was permanently dismissed in a prior session.
- Action: user navigates to the Components panel, clicks the persistent button.
- Expected: the Components walkthrough dialog opens. Forward/backward navigation works. Closing it (either option) does not change the existing dismiss flag.

**Scenario: Returning user with in-progress project — no auto-show**
- Setup: returning user with several record types and components defined; has never explicitly dismissed.
- Action: user enters the wizard.
- Expected (per Ambiguity #2's assumption): no auto-show, because the project is no longer empty. Persistent button still available.

## How to Verify

- Mockup approval recorded before this spec moves to `ready`.
- Manual exercise of every Behavioral Scenario above against the implemented UI.
- Unit tests for the dismiss-flag persistence and the auto-show predicate (whichever rule wins from Ambiguity #2).
- Playwright smoke test extension to cover the auto-launch and one full forward traversal.

## Pre-Ready Checklist

This spec stays in `draft` until all of these are complete:

- [ ] Mockup(s) of the dialog created (3-option and 4-option variants, plus the final-panel variant).
- [ ] Mockup approved.
- [ ] Ambiguities #1–#6 resolved (or explicitly punted with a clear rationale).
- [ ] Final dialog content (text) drafted for each panel.
- [ ] "Files Likely Affected" updated with concrete paths.
- [ ] "How to Verify" expanded with specific test names / scenarios.
