# Spec: Views Panel

**Status:** ready
**Date:** 2026-03-22
**Depends on:** Blocks Panel (Phase 4)
**Visual reference:** `mockups/6-views-panel.html`

## What

Add a "Views" panel (Phase 5 of the layout migration) that lets users define the pages of their app and assign blocks to each one. A view represents a distinct screen in the final app (e.g., Home, Profile, Settings). Users place blocks onto views to define what content appears on each page. The wizard seeds a "Home" view on initial state creation so that navigation requirements have a view to reference immediately.

## Why

Views are the final organizational layer before code generation. Requirements define what the app does, blocks group requirements into buildable pieces, and views arrange those blocks into pages. Without views, there's no way to express which blocks appear on which screen, or to give the generated app a multi-page structure. Seeding a "Home" view ensures navigation requirements can reference at least one view from the start.

## Data Model Changes

### New type: `View`

Add to `src/types/wizard.ts`:

```typescript
export interface View {
  id: string;
  name: string;        // user-given name, e.g. "Home", "Profile", "Settings"
  blockIds: string[];   // ordered list of Block ids placed on this view
}
```

### WizardState (modified)

Add a `views` array:

```typescript
export interface WizardState {
  // ... existing fields ...
  views: View[];
}
```

### Seeding

Initialize with one "Home" view in `initializeWizardState()`:

```typescript
views: [{ id: generateId(), name: 'Home', blockIds: [] }]
```

Add a migration in `setWizardState()` to ensure `views` exists for old saved states:

```typescript
if (!state.views || state.views.length === 0) {
  state.views = [{ id: generateId(), name: 'Home', blockIds: [] }];
}
```

### Block assignment model

A block can belong to **multiple views** (multi-assignment). The `View.blockIds` array holds references; blocks themselves have no back-reference to views. Deleting a view does not affect its blocks.

## UI Structure

### Panel layout

The Views panel follows the same `render*Panel()` / `wire*Panel()` pattern as existing panels.

**Workspace header:**
```html
<div class="workspace-header">
  <h2>Views</h2>
  <button class="add-btn" id="views-add-btn">+ New View</button>
</div>
```

**Workspace body contains (in order):**
1. Description paragraph (`.workspace-desc`)
2. Inline form (when open) — for creating or editing a view
3. View cards grid (`.view-grid`) — existing views in creation order
4. Unassigned blocks section — shown only when unassigned blocks exist
5. Next-step card — TBD (depends on Phase 6 Generate Flow decisions)

**Description text:**
> Views are the pages of your app. Assign blocks to each view to define what content appears on each screen.

### View cards

Each view renders as a card in a responsive grid (`repeat(auto-fill, minmax(280px, 1fr))`).

```html
<div class="view-card">
  <div class="view-card-header">
    <div class="view-card-name">[View name]</div>
    <div class="view-card-actions">
      <button title="Edit">✎</button>
      <button title="Delete">✕</button>
    </div>
  </div>
  <ul class="view-card-blocks">
    <li class="view-card-block">
      <span class="block-order">[n]</span>
      <span>[block name]</span>
      <!-- reorder buttons shown on card hover, only for multi-block views -->
      <span class="reorder-btns">
        <button title="Move up">▲</button>
        <button title="Move down">▼</button>
      </span>
    </li>
  </ul>
  <!-- when no blocks assigned -->
  <div class="view-card-empty">No blocks assigned</div>
</div>
```

**Delete button behavior:**
- Hidden (not rendered) when only one view exists, enforcing the minimum-1-view constraint.
- When 2+ views exist, the delete button is visible on all view cards.

**Reorder buttons:**
- Only shown on view cards with 2+ blocks
- Appear on card hover (opacity transition)
- Up button disabled (opacity 0.3, pointer-events none) on first item
- Down button disabled on last item
- Clicking up/down swaps the block with its neighbor in `blockIds`, re-renders the card

### Inline form (create / edit)

The form appears below the description when the user clicks "+ New View" or a view's edit button. Only one form open at a time (same pattern as BlocksPanel and RequirementsPanel).

```html
<div class="inline-form" id="views-form">
  <div class="form-group">
    <label>View Name</label>
    <input type="text" id="view-name-input"
           placeholder="e.g., Home, Profile, Settings">
  </div>

  <div class="form-group">
    <label>Blocks</label>

    <!-- Selected chips -->
    <div class="selected-chips" id="view-selected-chips">
      <!-- Populated dynamically -->
    </div>

    <div class="form-hint">
      Selected blocks will appear on the view in the order shown. Click ✕ to remove.
    </div>

    <!-- Available blocks list -->
    <div class="available-list-label">Available Blocks</div>
    <ul class="available-list" id="view-available-list">
      <!-- All blocks listed here -->
    </ul>
  </div>

  <div class="form-footer">
    <button class="btn-primary" id="view-save-btn">Save View</button>
    <button class="btn-ghost" id="view-cancel-btn">Cancel</button>
  </div>
</div>
```

**Selected chips area:**
- Shows selected blocks as numbered chip tags at the top
- Each chip: `<span class="chip"><span class="chip-order">[n]</span> [block name] <button class="chip-remove">✕</button></span>`
- When empty, shows placeholder text: "Click blocks below to add them"
- Chips animate in (scale 0.85 → 1, opacity 0 → 1, 0.15s)
- Clicking ✕ on a chip removes it and unchecks the corresponding item in the available list
- Order numbers update when chips are added/removed

**Available blocks list:**
- Shows ALL blocks (including those assigned to other views)
- Each item shows: checkbox area, block name
- Clicking an unselected item: adds it as the next chip (appended to end of selected list), marks item as selected (highlighted background, checkmark)
- Clicking a selected item: removes its chip, un-highlights the item
- Items selected in the current form are highlighted with `var(--chip-bg)` background and a checkmark in the checkbox area

**Validation:**
- Save button is disabled when name is empty (after trimming) or when the trimmed name matches an existing view (excluding the view being edited)
- When the name matches an existing view, a validation message appears below the name input: "A view with this name already exists. Each view needs a unique name."
- Blocks are optional — a view with zero blocks is valid (the user may add blocks later)
- Save button enables/disables in real-time as the user types in the name field

### Unassigned blocks section

Shown below the view grid whenever at least one block is not assigned to any view. A block is "unassigned" if its id does not appear in any view's `blockIds` array.

```html
<div class="unassigned-section" id="views-unassigned">
  <div class="available-list-label">
    Unassigned Blocks
    <span class="unassigned-count"> — [n] remaining</span>
  </div>
  <div class="form-hint">
    These blocks haven't been placed on any view yet.
    Use "+ New View" above or edit an existing view to assign them.
  </div>
  <ul class="available-list">
    <li class="available-item">
      <span class="avail-text">[block name]</span>
    </li>
  </ul>
</div>
```

This section is separated from the view grid by a top border with margin/padding.

When all blocks are assigned to at least one view, this entire section is hidden.

### Sidebar integration

The sidebar Views section shows view names:
```
<div class="sidebar-item"><span class="dot"></span> [View name]</div>
```

Badge count shows the number of views. The section gets `has-items` class when the user has meaningfully engaged with views — specifically, when `views.length > 1` OR any view has at least one block assigned (`views.some(v => v.blockIds.length > 0)`). The seeded Home view alone (with no blocks) does NOT fill the progress indicator circle, since the user hasn't taken any action yet.

### Next-step card

TBD — depends on Phase 6 (Generate Flow) decisions. For now, omit the next-step card from this panel. It can be added when the generate flow is designed.

## Acceptance Criteria

- [ ] A "Home" view is seeded on initial state creation
  - When `initializeWizardState()` is called, the returned state includes `views: [{ id, name: 'Home', blockIds: [] }]`.
  - When `setWizardState()` loads a saved state with no `views` array (or empty), it migrates by adding a seeded Home view.

- [ ] The Views panel renders in the workspace when the Views sidebar section is active
  - When the user clicks the Views section in the sidebar, the workspace renders the Views panel with header, description, view grid, and unassigned section.
  - The "+ New View" button appears in the workspace header.
  - The Views section in the sidebar shows the correct badge count and view names.
  - The sidebar progress indicator (filled circle) for Views is NOT filled when only the seeded Home view exists with no blocks. It fills when the user creates a second view or adds a block to any view.

- [ ] Users can create a view via the "New View" form
  - When the user clicks "+ New View", an inline form opens with a name input and block selector.
  - The block selector shows all blocks. Clicking a block adds it as a numbered chip. Clicking again removes it.
  - The Save button is disabled until a name is entered and the name is unique among existing views. Blocks are optional.
  - If the entered name matches an existing view, a validation message appears: "A view with this name already exists. Each view needs a unique name."
  - When saved, a new View is appended to `wizardState.views` with the entered name and selected block IDs in selection order. The form closes, the view card appears, and the sidebar updates.

- [ ] Users can edit an existing view
  - When the user clicks the edit button on a view card, the inline form opens pre-populated with the view's name and selected blocks (shown as chips, with corresponding items checked in the available list).
  - The user can rename the view, add/remove blocks, and save. The view updates in place (same position in the array).

- [ ] Users can delete a view (except the last one)
  - When 2+ views exist, each view card shows a delete button. Clicking it removes the view from `wizardState.views`. The card disappears, sidebar updates.
  - When only 1 view exists, the delete button is not rendered on the card.
  - Deleting a view does not affect its blocks — they remain in `wizardState.blocks` and become available for other views or appear in the unassigned list.

- [ ] Users can reorder blocks within a multi-block view
  - View cards with 2+ blocks show up/down arrow buttons on hover.
  - Clicking up/down swaps the block with its neighbor in the `blockIds` array.
  - The up button is disabled on the first item; the down button is disabled on the last item.
  - Reorder saves state immediately and re-renders the card.

- [ ] Unassigned blocks are shown below the view grid
  - When at least one block is not in any view's `blockIds`, the "Unassigned Blocks" section appears below the view grid with a count, hint text, and a list of unassigned block names.
  - When all blocks are assigned to at least one view, the section is hidden.

- [ ] Deleted blocks are handled gracefully
  - When a view's `blockIds` references a block id that no longer exists in `wizardState.blocks`, the missing block is filtered out during render.
  - If the user edits such a view, only valid blocks appear as chips. Saving persists the cleaned-up `blockIds`.

- [ ] The panel is responsive
  - At viewports >= 768px, the Views panel renders in the workspace (sidebar + workspace layout).
  - At viewports < 768px, the same panel content renders inside the Views accordion section.
  - View cards stack to single column on narrow viewports (grid switches to `1fr`).
  - The form's name input expands to full width on narrow viewports.
  - The selected chips area remains visible above the available blocks list at all viewport widths.
  - At viewports < 768px, reorder buttons on view cards are always visible (not hover-dependent), since hover is unreliable on touch devices.

- [ ] The accordion section for Views works correctly
  - The Views accordion section shows badge count and summary text when collapsed.
  - Summary text shows view names joined with " · ".
  - Opening the Views accordion section renders and wires the Views panel inside the accordion body.

## Scope

**In scope:**
- `View` type and `views` array on WizardState
- Seeding Home view in `initializeWizardState()` and migration in `setWizardState()`
- ViewsPanel render and wire functions
- Inline form with chip-based block selector
- View cards with reorder controls
- Unassigned blocks section
- Minimum-1-view enforcement (hide delete button on last view)
- Sidebar integration (badge, items, active state, progress indicator logic)
- Accordion integration
- Responsive behavior: sidebar+workspace above 768px, accordion below; always-visible reorder buttons below 768px
- WorkspaceLayout registration of ViewsPanel (wire function, accordion summaries)

**Out of scope:**
- Navigation dropdown wiring in Requirements panel — see `.specs/active/requirements-navigation-wiring.md`
- App Config placement — see `.specs/active/app-config-placement.md`
- Next-step card (depends on Phase 6 Generate Flow)
- Generated code output for views
- Drag-and-drop reordering (using up/down buttons instead)
- View descriptions or metadata beyond name + blocks
- Layout/positioning of blocks within a view (grid, columns, etc.)
- Quick-create shortcuts on unassigned blocks (unlike the Blocks panel, there's no natural block-type-to-name mapping for views)

## Files Likely Affected

### New Files
- `src/app/views/panels/ViewsPanel.ts` — `renderViewsPanel()`, `wireViewsPanel()`, form handling
- `styles/workspace/views-panel.css` — View card, unassigned section styles (may reuse most block-panel patterns)
- `tests/views/ViewsPanel.test.ts` — Unit tests for view creation, editing, deletion, reordering, seeding

### Modified Files
- `src/types/wizard.ts` — Add `View` interface, add `views` to `WizardState`
- `src/app/state/WizardState.ts` — Initialize `views` with seeded Home view in `initializeWizardState()`, add migration in `setWizardState()`
- `src/app/views/WorkspaceLayout.ts` — Register `wireViewsPanel` in `switchSection()`, add `updateViewsSidebar`, update `updateAccordionSummaries()` for views

## Resolved Design Decisions

1. **No quick-create shortcuts on unassigned blocks.** Unlike requirements→blocks (where type-driven name suggestions exist), there's no natural mapping from a block to a view name. The hint text is sufficient.
2. **Seeded Home view is not special.** No visual distinction — it's a regular view that can be renamed freely.
3. **No next-step card for now.** Omitted until Phase 6 (Generate Flow) is designed. Noted in backlog.
4. **Empty blocks list shows a message.** When no blocks exist, the available list area shows: "No blocks created yet. You can assign blocks to this view later."
5. **View names must be unique.** Enforced via validation message: "A view with this name already exists. Each view needs a unique name." Save button disabled while duplicate. Excludes the current view during edit.
6. **View card after all blocks deleted shows "No blocks assigned."** Same message as a newly created empty view — no special "blocks removed" state.

## Integration Boundaries

### ViewsPanel → WizardState
- **Data flowing in:** Reads `wizardState.views` and `wizardState.blocks` to render the panel.
- **Data flowing out:** Writes to `wizardState.views` via `saveWizardState()` when views are created, edited, deleted, or blocks are reordered.
- **Expected contract:** `View.blockIds` contains valid Block ids. Orphaned ids (from deleted blocks) should be tolerated — filter them out during render.

### ViewsPanel → Sidebar
- **Data flowing out:** After any state change, calls the sidebar update function to refresh the Views section badge count and item list.

### ViewsPanel → BlocksPanel
- **No direct coupling.** Views reference blocks by id. If a block is deleted in the BlocksPanel, views that referenced it will have a stale id. The ViewsPanel handles this by filtering out missing block ids during render.

## Behavioral Scenarios

**Scenario 1: Initial state — Home view exists**
- Setup: Fresh wizard state, no blocks exist.
- Action: User clicks the Views section in the sidebar.
- Expected outcome: Views panel shows one view card: "Home" with "No blocks assigned". Sidebar badge shows "1". Delete button is not rendered (only 1 view). "+ New View" button is visible in header. The sidebar progress indicator circle for Views is NOT filled (seeded Home with no blocks doesn't count as user engagement).

**Scenario 1b: Progress indicator fills on first meaningful action**
- Setup: Fresh wizard state with seeded Home view. Blocks "Nav Menu" and "Post Feed" exist. Progress indicator circle for Views is unfilled.
- Action A: User adds "Nav Menu" block to the Home view via edit.
- Expected outcome A: Progress indicator circle fills (a view now has blocks assigned).
- Action B (alternative): User creates a second view "Profile" with no blocks.
- Expected outcome B: Progress indicator circle fills (more than one view exists).

**Scenario 2: Creating a second view with blocks**
- Setup: Home view exists. Blocks "Post Feed" and "Nav Menu" exist.
- Action: User clicks "+ New View". Types "Profile" in name field. Clicks "Post Feed" in the available list — chip "1 Post Feed" appears. Clicks Save.
- Expected outcome: View `{ name: "Profile", blockIds: [postFeedId] }` is created. View card appears showing one block. Sidebar shows "Home" and "Profile" with badge "2". Delete buttons now appear on both view cards. "Nav Menu" appears in unassigned blocks section.

**Scenario 3: Editing a view — adding blocks**
- Setup: "Home" view has no blocks. Blocks "Nav Menu" and "About Section" exist.
- Action: User clicks edit on "Home" card. Form opens with name "Home" and no chips. User clicks "Nav Menu" (chip 1) and "About Section" (chip 2). Clicks Save.
- Expected outcome: Home view now has 2 blocks in selection order. Card updates to show both blocks with reorder buttons on hover.

**Scenario 4: Editing a view — renaming**
- Setup: "Home" view exists.
- Action: User clicks edit on "Home" card. Changes name to "Dashboard". Clicks Save.
- Expected outcome: View card shows "Dashboard". Sidebar item updates from "Home" to "Dashboard".

**Scenario 5: Deleting a view**
- Setup: "Home" and "Profile" views exist. "Profile" references block "Post Feed".
- Action: User clicks delete on "Profile" card.
- Expected outcome: "Profile" view is removed. "Post Feed" block is unaffected — it appears in the unassigned blocks section (assuming Home doesn't reference it). Sidebar badge shows "1". Delete button disappears from the remaining "Home" card.

**Scenario 6: Cannot delete the last view**
- Setup: Only "Home" view exists.
- Action: User looks at the Home view card.
- Expected outcome: No delete button is rendered on the card. User cannot delete the last view.

**Scenario 7: Reordering blocks on a view card**
- Setup: "Home" view has blocks in order: [Nav Menu, Post Feed, About Section].
- Action: User hovers over the card. Clicks the down arrow on "Nav Menu" (position 1).
- Expected outcome: Order becomes [Post Feed, Nav Menu, About Section]. Numbers update to 1-2-3. State is saved immediately.

**Scenario 8: Block used in multiple views**
- Setup: "Home" view uses block "Nav Menu". User edits "Profile" view.
- Action: In the available list, "Nav Menu" is listed (not grayed out). User clicks it — chip appears. Clicks Save.
- Expected outcome: Both "Home" and "Profile" have "Nav Menu" in their `blockIds`. "Nav Menu" does not appear in the unassigned list.

**Scenario 9: Deleted block in a view**
- Setup: "Home" view references block ids [A, B, C]. Block B is deleted via the Blocks panel.
- Action: User navigates to the Views panel.
- Expected outcome: "Home" card shows blocks A and C (B is filtered out). If the user edits the view, only A and C appear as chips. Saving persists the cleaned-up `blockIds`.

**Scenario 10: Creating a view with no blocks**
- Setup: User clicks "+ New View".
- Action: User types "Settings" but selects no blocks. Clicks Save.
- Expected outcome: View is created with empty `blockIds`. Card shows "No blocks assigned". This is valid — the user can assign blocks later via edit.

**Scenario 11: Save button validation**
- Setup: User opens the New View form.
- Action: User selects blocks but enters no name. Then clears blocks and enters a name.
- Expected outcome: Save disabled (no name) → Save enabled (name present, blocks optional).

**Scenario 11b: Duplicate view name validation**
- Setup: "Home" and "Profile" views exist. User clicks "+ New View".
- Action: User types "Home" in the name field.
- Expected outcome: Validation message appears below the name input: "A view with this name already exists. Each view needs a unique name." Save button is disabled.

**Scenario 11c: Duplicate name check excludes current view during edit**
- Setup: "Home" and "Profile" views exist. User clicks edit on "Home".
- Action: Form opens with name "Home" pre-populated.
- Expected outcome: No validation error — the name "Home" is allowed because it's the view being edited. Save button is enabled.

**Scenario 12: Unassigned blocks section visibility**
- Setup: 3 blocks exist. All 3 are assigned to at least one view.
- Action: User views the Views panel.
- Expected outcome: The "Unassigned Blocks" section is not shown. Only the view grid is visible.

**Scenario 13: No blocks exist — form empty state**
- Setup: No blocks have been created yet. "Home" view exists.
- Action: User clicks edit on "Home" card.
- Expected outcome: Form opens with name "Home". The available blocks list shows a message: "No blocks created yet. You can assign blocks to this view later." No chips area interaction is possible.

**Scenario 14: Mobile accordion view**
- Setup: Viewport is < 768px. User has 2 views and 1 unassigned block.
- Action: User taps the Views accordion header.
- Expected outcome: Accordion opens showing view cards (single column), unassigned blocks list, and hint text. The inline form (if opened) shows chips above the available list.

**Scenario 15: Migration of old state without views**
- Setup: User has a saved state from before the Views panel was implemented (no `views` property).
- Action: App loads and calls `setWizardState()` with the saved state.
- Expected outcome: Migration adds `views: [{ id, name: 'Home', blockIds: [] }]`. User sees a Home view when they visit the Views panel.

## How to Verify

1. Fresh state: verify "Home" view is seeded — sidebar shows "Home" with badge "1"
2. Navigate to Views panel — verify header, description, and Home card render correctly
3. Verify delete button is hidden on Home card when it's the only view
4. Click "+ New View" — verify form opens with name input and block selector
5. Select blocks by clicking — verify chips appear numbered, items highlight, save button enables when name is entered
6. Save a view — verify card appears in grid, sidebar updates, form closes
7. Create a view with no blocks — verify it saves successfully with "No blocks assigned" on the card
8. Edit a view — verify form pre-populates correctly (name and block chips)
9. Rename a view — verify sidebar updates with new name
10. Delete a view (when 2+ exist) — verify removal, sidebar update, delete button disappears on last remaining view
11. Reorder blocks on a multi-block view — verify order changes and persists
12. Assign a block to multiple views — verify it works and doesn't appear in unassigned list
13. Delete a block that's in a view, then view the Views panel — verify graceful handling
14. Verify unassigned blocks section appears/disappears correctly
15. Edit a view when no blocks exist — verify empty-state message in the available list
16. Load old saved state without `views` — verify migration adds Home view
17. Resize below 768px — verify accordion layout, single-column cards, chips visible above available list
18. `npm run build` compiles without errors
19. `npx vitest run` passes
