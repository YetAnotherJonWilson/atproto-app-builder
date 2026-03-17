# Spec: Narrow Accordion Layout

**Status:** ready
**Date:** 2026-03-17

## What
Add a narrow-viewport layout that replaces the sidebar + workspace with a vertical accordion. Below 768px, the four wizard sections (Requirements, Data, Components, Views) render as stacked accordion panels with one open at a time. The existing sidebar + workspace layout remains for viewports >= 768px.

## Why
The sidebar + workspace layout requires ~500px+ for the workspace alone. On phones and portrait-oriented tablets, the sidebar eats too much space, leaving the workspace cramped. An accordion layout uses the full viewport width for content while keeping all four sections accessible.

## Acceptance Criteria

- [ ] Below 768px, the sidebar and workspace are hidden and the accordion is shown
  - When the viewport is < 768px, `.sidebar` and `.workspace` are hidden via CSS.
  - A new `.accordion` container is displayed instead.
  - When the viewport is >= 768px, `.accordion` is hidden and sidebar + workspace are shown.
  - No JS viewport listener needed — CSS media query handles the swap.
- [ ] The accordion has four sections matching the sidebar sections
  - Each section has a header with: progress dot, section title, summary text, badge count, chevron.
  - Section order: Requirements, Data, Components, Views.
  - Sections use `data-section` attributes matching the existing sidebar values.
- [ ] Only one accordion section is open at a time
  - When a section header is clicked, that section opens and any other open section closes.
  - The active section gets the `.active` class; its body is displayed, its summary is hidden, and its chevron rotates.
  - Clicking the already-active section's header does nothing (stays open).
- [ ] Collapsed sections show a summary line
  - The `.accordion-summary` shows a condensed preview of the section's items (same text as sidebar items, joined with " · ").
  - If the section has no items, the summary shows "None yet".
  - The summary is hidden when the section is active/open.
- [ ] Progress dots reflect section state
  - Empty section: hollow dot (border only, `--progress-muted`).
  - Section with items (`.has-items`): filled cyan dot.
  - Active section: cyan border with glow ring.
  - Active section with items: filled cyan dot with glow ring.
- [ ] The accordion body renders the same panel content as the workspace
  - The active section's `.accordion-body` is populated by calling the same `render*Panel()` functions used by the workspace.
  - Panel wiring (`wire*Panel()`) is called after rendering.
  - Switching sections re-renders the newly active section's content.
- [ ] The accordion syncs with wizard state
  - `activeSection` in WizardState determines which accordion section is open on load.
  - Switching accordion sections updates `activeSection` in state.
  - Badge counts and summary text update when items are added/removed (same update functions as sidebar).
- [ ] The "Next step" card within a panel opens the next accordion section
  - Clicking the next-step card inside an accordion panel activates the next section, same as clicking that section's header.
- [ ] The accordion header scrolls into view when activated
  - When a section is activated, `scrollIntoView({ behavior: 'smooth', block: 'nearest' })` is called on the section element.
- [ ] Inline forms within accordion panels scroll into view when opened
  - Already implemented in `showForm()` — no change needed.
- [ ] The form row grid stacks to single column on very narrow viewports
  - Below 400px, `.form-row` switches from `grid-template-columns: 1fr 1fr` to `1fr`.
- [ ] No sidebar progress line in the accordion layout
  - The vertical progress track and fill line are part of the sidebar, which is hidden. No equivalent in the accordion.

## Scope

**In scope:**
- CSS media query at 768px to swap sidebar+workspace for accordion
- Accordion HTML structure (rendered in `WorkspaceLayout.ts` or a new `AccordionLayout.ts`)
- Accordion event wiring (section switching, scroll behavior)
- Accordion state sync (active section, badges, summaries)
- Responsive form-row stacking at 400px
- Header height adjustment for narrow viewports (smaller header)

**Out of scope:**
- Changing any panel content (RequirementsPanel, etc.) — accordion body uses the same render functions
- Touch gestures (swipe to switch sections)
- Landscape phone handling (accordion still works, no special treatment)
- Offline / PWA considerations

## Files Likely Affected
- `styles.css` — Media query at 768px: hide sidebar/workspace, show accordion. Accordion styles. Form-row stacking at 400px.
- `src/app/views/WorkspaceLayout.ts` — Render accordion HTML alongside sidebar+workspace. Wire accordion headers. Sync accordion state with sidebar state. Update accordion summaries/badges when items change.
- `index.html` or `workspace.html` — May need an accordion container element in the DOM, or it can be rendered dynamically by WorkspaceLayout.

## Behavioral Scenarios

**Scenario: Page load on narrow viewport**
- Setup: Viewport is 600px wide. WizardState has `activeSection: 'requirements'` and 2 requirements.
- Expected: Sidebar and workspace are hidden. Accordion is visible. Requirements section is open with its panel content rendered. Data/Components/Views sections are collapsed with their summary text. Requirements badge shows "2".

**Scenario: Switch section via accordion header**
- Setup: Requirements section is open.
- Action: User taps the Data section header.
- Expected: Requirements section collapses (summary appears, body hides). Data section opens (body shows with panel content rendered, summary hides). Accordion scrolls so Data header is visible. `activeSection` in WizardState updates to `'data'`.

**Scenario: Switch section via next-step card**
- Setup: Requirements section is open, next-step card says "Define Data".
- Action: User taps the next-step card.
- Expected: Same as clicking the Data accordion header — Requirements collapses, Data opens.

**Scenario: Add a requirement within accordion**
- Setup: Requirements section is open, 0 requirements.
- Action: User clicks "Add Your First Requirement", fills in the form, saves.
- Expected: Requirement card appears. Badge updates to "1". Section gets `has-items` class (dot fills). When collapsed later, summary shows the requirement text.

**Scenario: Resize from narrow to wide**
- Setup: User is on a 600px viewport with the accordion visible, Requirements section active.
- Action: User resizes browser to 900px.
- Expected: Accordion hides, sidebar + workspace appear. Requirements section is active in both (state is shared). No re-render needed — CSS handles visibility; state is already in sync because both layouts share `activeSection`.

**Scenario: Resize from wide to narrow**
- Setup: User is on a 900px viewport with sidebar + workspace, Data section active.
- Action: User resizes browser to 600px.
- Expected: Sidebar and workspace hide, accordion appears with Data section open. Panel content is rendered in the accordion body.

## How to Verify
1. `npm run build` — compiles without errors
2. `npx vitest run` — all tests pass
3. Open app in browser at full width — sidebar + workspace layout unchanged
4. Resize browser below 768px — accordion appears, sidebar/workspace disappear
5. Click accordion headers — sections switch, one open at a time, smooth scroll
6. Add/edit/delete requirements within accordion — same behavior as desktop
7. Click next-step card — switches to next section
8. Resize back above 768px — sidebar + workspace reappear with correct active section
9. Visual reference: `mockups/4-narrow-accordion.html`
