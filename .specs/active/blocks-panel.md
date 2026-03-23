# Spec: Blocks Panel

**Status:** ready
**Date:** 2026-03-22
**Depends on:** Requirements Panel (Phase 3), Non-Data Elements spec
**Visual reference:** `mockups/5-blocks-panel.html`

## What

Add a "Blocks" panel (Phase 4 of the layout migration) that lets users turn requirements into buildable pieces. A block is created from one or more requirements — a single requirement maps to a simple element (e.g., a paragraph to a `<p>` tag), while multiple requirements combine into a composite component (e.g., a searchable list). Blocks are what get placed into views in the final step.

## Why

Requirements capture what the user needs. Blocks bridge requirements and views by defining *how* those needs become implementable UI pieces. Without this step, there's no way to express that some requirements should be combined into a single component, or to name and organize the pieces that will appear in views. The panel also surfaces unassigned requirements so users can see what hasn't been accounted for yet.

## Data Model Changes

### New type: `Block`

Add to `src/types/wizard.ts`:

```typescript
export interface Block {
  id: string;
  name: string;                // user-given name, e.g. "Post Feed", "About Section"
  requirementIds: string[];    // ordered list of Requirement ids
}
```

### WizardState (modified)

Add a `blocks` array:

```typescript
export interface WizardState {
  // ... existing fields ...
  blocks: Block[];
}
```

Initialize as `[]` in `initializeWizardState()`.

### Requirement assignment model

A requirement can belong to **multiple blocks** (multi-assignment). The `Block.requirementIds` array holds references; requirements themselves have no back-reference to blocks. Deleting a block does not affect its requirements.

## UI Structure

### Panel layout

The Blocks panel follows the same `render*Panel()` / `wire*Panel()` pattern as existing panels.

**Workspace header:**
```html
<div class="workspace-header">
  <h2>Blocks</h2>
  <button class="add-btn" id="blocks-add-btn">+ New Block</button>
</div>
```

**Workspace body contains (in order):**
1. Description paragraph (`.workspace-desc`)
2. Inline form (when open) — for creating or editing a block
3. Block cards grid (`.block-grid`) — existing blocks in creation order
4. Unassigned requirements section — shown only when unassigned requirements exist
5. Next-step card — "Arrange blocks into Views"

**Description text:**
> Turn your requirements into buildable pieces. Create a block from one requirement for simple elements, or combine multiple requirements into a composite component.

### Empty state

When no blocks exist and no requirements are unassigned (i.e., no requirements at all), show the standard empty workspace:

```html
<div class="empty-workspace">
  <div class="empty-icon">☐</div>
  <p>No blocks yet. Define some requirements first, then come back to turn them into blocks.</p>
</div>
```

When no blocks exist but requirements do exist, skip the empty state and show the description, the "+ New Block" button, and the unassigned requirements list with quick-create shortcuts.

### Block cards

Each block renders as a card in a responsive grid (`repeat(auto-fill, minmax(280px, 1fr))`).

```html
<div class="block-card">
  <div class="block-card-header">
    <div class="block-card-name">[Block name]</div>
    <div class="block-card-actions">
      <button title="Edit">✎</button>
      <button title="Delete">✕</button>
    </div>
  </div>
  <ul class="block-card-requirements">
    <li class="block-card-req">
      <span class="req-order">[n]</span>
      <span class="req-type-badge">[know|do|nav]</span>
      <span>[requirement display text]</span>
      <!-- reorder buttons shown on card hover, only for multi-requirement blocks -->
      <span class="reorder-btns">
        <button title="Move up">▲</button>
        <button title="Move down">▼</button>
      </span>
    </li>
  </ul>
</div>
```

**Requirement display text** uses the same format as the sidebar:
- Know: the `text` field (truncated if long)
- Do (data): `[verb] [data type displayName]`
- Do (element): `[verb] [element name]`
- Navigate: sidebar format (e.g., "go to [view]", "menu: [items]", "forward/back: [pages]")

**Reorder buttons:**
- Only shown on block cards with 2+ requirements
- Appear on card hover (opacity transition)
- Up button disabled (opacity 0.3, pointer-events none) on first item
- Down button disabled on last item
- Clicking up/down swaps the requirement with its neighbor in `requirementIds`, re-renders the card

### Inline form (create / edit)

The form appears below the description when the user clicks "+ New Block" or a block's edit button. Only one form open at a time (same pattern as RequirementsPanel).

```html
<div class="inline-form" id="blocks-form">
  <div class="form-group">
    <label>Block Name</label>
    <input type="text" id="block-name-input"
           placeholder="e.g., Post Feed, Search Bar, Nav Menu">
  </div>

  <div class="form-group">
    <label>Requirements</label>

    <!-- Selected chips -->
    <div class="selected-chips" id="block-selected-chips">
      <!-- Populated dynamically -->
    </div>

    <div class="form-hint">
      Selected requirements will be combined in the order shown. Click ✕ to remove.
    </div>

    <!-- Available requirements list -->
    <div class="available-list-label">Available Requirements</div>
    <ul class="available-list" id="block-available-list">
      <!-- All requirements listed here -->
    </ul>
  </div>

  <div class="form-footer">
    <button class="btn-primary" id="block-save-btn">Save Block</button>
    <button class="btn-ghost" id="block-cancel-btn">Cancel</button>
  </div>
</div>
```

**Selected chips area:**
- Shows selected requirements as numbered chip tags at the top
- Each chip: `<span class="chip"><span class="chip-order">[n]</span> [text] <button class="chip-remove">✕</button></span>`
- When empty, shows placeholder text: "Click requirements below to add them"
- Chips animate in (scale 0.85 → 1, opacity 0 → 1, 0.15s)
- Clicking ✕ on a chip removes it and unchecks the corresponding item in the available list
- Order numbers update when chips are added/removed

**Available requirements list:**
- Shows ALL requirements (including those assigned to other blocks)
- Each item shows: checkbox area, type badge (know/do/nav), requirement display text
- Clicking an unselected item: adds it as the next chip (appended to end of selected list), marks item as selected (highlighted background, checkmark)
- Clicking a selected item: removes its chip, un-highlights the item
- Items selected in the current form are highlighted with `var(--chip-bg)` background and a checkmark in the checkbox area

**Validation:**
- Save button is disabled when: name is empty OR no requirements are selected (minimum 1)
- Save button enables/disables in real-time as the user types in the name field and adds/removes requirements

### Unassigned requirements section

Shown below the block grid whenever at least one requirement is not assigned to any block. A requirement is "unassigned" if its id does not appear in any block's `requirementIds` array.

```html
<div class="unassigned-section" id="blocks-unassigned">
  <div class="available-list-label">
    Unassigned Requirements
    <span class="unassigned-count"> — [n] remaining</span>
  </div>
  <div class="form-hint">
    Click "+ Block" on any requirement to quickly create a single-requirement block,
    or use "+ New Block" above to combine multiple requirements.
  </div>
  <ul class="available-list">
    <li class="available-item">
      <span class="avail-type">[type]</span>
      <span class="avail-text">[requirement text]</span>
      <button class="quick-btn">+ Block</button>
    </li>
  </ul>
</div>
```

This section is separated from the block grid by a top border with margin/padding.

When all requirements are assigned to at least one block, this entire section is hidden.

### Quick-create shortcut

The "+ Block" button appears on each unassigned requirement row (visible on hover on desktop, always visible on mobile/touch).

Clicking "+ Block" shows a small dropdown of common block name options based on the requirement type:

**Know requirements:** Paragraph, Section, Heading, Info Box, Banner
**Do (data) requirements:** Form, List, Card, Table, Detail View
**Do (element) requirements:** Widget, Tool, Control
**Navigate requirements:** Link, Button, Menu Item, Tab

Clicking a dropdown option:
1. Creates a new Block with the selected name and a single `requirementIds` entry
2. Appends it to `wizardState.blocks`
3. Saves state
4. Re-renders the panel (new block card appears, requirement moves out of unassigned list if it was only in this block)
5. Updates sidebar

Clicking outside the dropdown or pressing Escape closes it without action.

### Sidebar integration

The sidebar Blocks section shows block names:
```
<div class="sidebar-item"><span class="dot"></span> [Block name]</div>
```

Badge count shows the number of blocks. The section gets `has-items` class when blocks exist.

### Next-step card

```html
<div class="next-step">
  <div class="next-step-card" data-section="views">
    <div>
      <div class="next-step-label">Next step</div>
      <div class="next-step-title">Arrange blocks into Views</div>
    </div>
    <div class="next-step-arrow">→</div>
  </div>
</div>
```

## Acceptance Criteria

- [ ] The Blocks panel renders in the workspace when the Blocks sidebar section is active
  - When the user clicks the Blocks section in the sidebar, the workspace renders the Blocks panel with header, description, block grid, and unassigned section.
  - The "+ New Block" button appears in the workspace header.
  - The Blocks section in the sidebar shows the correct badge count and block names.

- [ ] Users can create a block via the "New Block" form
  - When the user clicks "+ New Block", an inline form opens with a name input and requirement selector.
  - The requirement selector shows all requirements with type badges. Clicking a requirement adds it as a numbered chip. Clicking again removes it.
  - The Save button is disabled until both a name is entered and at least one requirement is selected.
  - When saved, a new Block is appended to `wizardState.blocks` with the entered name and selected requirement IDs in selection order. The form closes, the block card appears, and the sidebar updates.

- [ ] Users can create a block via the quick-create shortcut
  - When the user hovers over an unassigned requirement, a "+ Block" button appears.
  - Clicking "+ Block" shows a dropdown of common block name options appropriate to the requirement type.
  - Clicking a name option creates a single-requirement block with that name, saves state, and re-renders the panel.

- [ ] Users can edit an existing block
  - When the user clicks the edit button on a block card, the inline form opens pre-populated with the block's name and selected requirements (shown as chips, with corresponding items checked in the available list).
  - The user can rename the block, add/remove requirements, and save. The block updates in place (same position in the array).
  - The user cannot remove all requirements — the Save button disables if zero requirements are selected.

- [ ] Users can delete a block
  - When the user clicks the delete button on a block card, the block is removed from `wizardState.blocks`. The card disappears, sidebar updates.
  - The block's requirements are unaffected — they remain in `wizardState.requirements` and become available for other blocks or appear in the unassigned list.

- [ ] Users can reorder requirements within a multi-requirement block
  - Block cards with 2+ requirements show up/down arrow buttons on hover.
  - Clicking up/down swaps the requirement with its neighbor in the `requirementIds` array.
  - The up button is disabled on the first item; the down button is disabled on the last item.
  - Reorder saves state immediately and re-renders the card.

- [ ] Unassigned requirements are shown below the block grid
  - When at least one requirement is not in any block's `requirementIds`, the "Unassigned Requirements" section appears below the block grid with a count, hint text, and a list of unassigned requirements with quick-create buttons.
  - When all requirements are assigned to at least one block, the section is hidden.

- [ ] The panel is responsive
  - At viewports >= 768px, the Blocks panel renders in the workspace (sidebar + workspace layout).
  - At viewports < 768px, the same panel content renders inside the Blocks accordion section.
  - Block cards stack to single column on narrow viewports (grid switches to `1fr`).
  - The form's name input expands to full width on narrow viewports.
  - Quick-create "+ Block" buttons are always visible (not hover-dependent) on touch/narrow viewports.
  - The selected chips area remains visible above the available requirements list at all viewport widths, ensuring users can see their selections while browsing the list.

- [ ] The accordion section for Blocks works correctly
  - The Blocks accordion section shows badge count and summary text when collapsed.
  - Summary text shows block names joined with " · ", or "None yet" if empty.
  - Opening the Blocks accordion section renders and wires the Blocks panel inside the accordion body.

## Scope

**In scope:**
- `Block` type and `blocks` array on WizardState
- BlocksPanel render and wire functions
- Inline form with chip-based requirement selector
- Block cards with reorder controls
- Quick-create shortcut with name dropdown
- Unassigned requirements section with hint text
- Sidebar integration (badge, items, active state)
- Accordion integration
- Responsive behavior at 768px and 400px breakpoints
- WorkspaceLayout registration of BlocksPanel

**Out of scope:**
- Views panel (Phase 5 — consumes blocks but not built yet)
- Generated code output for blocks
- Component catalog / template system (future feature)
- Drag-and-drop reordering (using up/down buttons instead)
- Block descriptions or metadata beyond name + requirements
- Output tier indicators (placeholder/scaffold/functional)

## Files Likely Affected

### New Files
- `src/app/views/panels/BlocksPanel.ts` — `renderBlocksPanel()`, `wireBlocksPanel()`, form handling, quick-create logic
- `styles/workspace/blocks-panel.css` — Block card, chip, unassigned section, quick-create dropdown styles
- `tests/views/BlocksPanel.test.ts` — Unit tests for block creation, editing, deletion, reordering, quick-create

### Modified Files
- `src/types/wizard.ts` — Add `Block` interface, add `blocks` to `WizardState`
- `src/app/state/WizardState.ts` — Initialize `blocks: []` in `initializeWizardState()`
- `src/app/views/WorkspaceLayout.ts` — Register `renderBlocksPanel` / `wireBlocksPanel` in `SECTION_CONFIG`, add accordion summary logic for blocks

## Integration Boundaries

### BlocksPanel → WizardState
- **Data flowing in:** Reads `wizardState.requirements`, `wizardState.recordTypes`, `wizardState.nonDataElements`, `wizardState.blocks` to render the panel.
- **Data flowing out:** Writes to `wizardState.blocks` via `saveWizardState()` when blocks are created, edited, deleted, or reordered.
- **Expected contract:** `Block.requirementIds` contains valid Requirement ids. Orphaned ids (from deleted requirements) should be tolerated — display "[deleted requirement]" or filter them out during render.

### BlocksPanel → Sidebar
- **Data flowing out:** After any state change, calls the sidebar update function to refresh the Blocks section badge count and item list.

### BlocksPanel → RequirementsPanel
- **No direct coupling.** Blocks reference requirements by id. If a requirement is deleted in the RequirementsPanel, blocks that referenced it will have a stale id. The BlocksPanel should handle this gracefully by filtering out missing requirement ids during render.

## Behavioral Scenarios

**Scenario 1: First block via New Block form**
- Setup: 3 requirements exist (know: "App description", do: "create Post", nav: "go to Profile"). No blocks exist.
- Action: User clicks "+ New Block". Types "About Section" in name field. Clicks "App description" in the available list — a chip "1 App description" appears. Clicks Save.
- Expected outcome: Block `{ name: "About Section", requirementIds: [reqId] }` is created. Block card appears with one requirement listed. Sidebar shows "About Section" with badge "1". Unassigned section shows 2 remaining requirements.

**Scenario 2: Composite block with multiple requirements**
- Setup: Block "About Section" exists. Requirements: "create Post", "search Post", "view Post" are unassigned.
- Action: User clicks "+ New Block". Types "Post Feed". Clicks "search Post" (chip 1 appears), then "view Post" (chip 2), then "create Post" (chip 3). Clicks Save.
- Expected outcome: Block with 3 requirements in selection order: search, view, create. Block card shows numbered requirements 1-2-3. Reorder buttons visible on card hover.

**Scenario 3: Quick-create from unassigned list**
- Setup: Requirement "go to Profile" (nav type) is unassigned.
- Action: User hovers over "go to Profile" in the unassigned list. Clicks "+ Block". Dropdown shows: Link, Button, Menu Item, Tab. User clicks "Link".
- Expected outcome: Block `{ name: "Link", requirementIds: [navReqId] }` is created. "go to Profile" disappears from unassigned list. Block card "Link" appears in the grid.

**Scenario 4: Editing a block — adding a requirement**
- Setup: Block "Post Feed" has requirements [search, view].
- Action: User clicks edit on "Post Feed" card. Form opens with name "Post Feed", chips showing "1 search Post" and "2 view Post". User clicks "create Post" in the available list — chip "3 create Post" appears. Clicks Save.
- Expected outcome: Block now has 3 requirements. Card updates to show all three. Sidebar item unchanged (still "Post Feed").

**Scenario 5: Editing a block — removing a requirement**
- Setup: Block "Post Feed" has requirements [search, view, create].
- Action: User clicks edit. Clicks ✕ on the "search Post" chip. Remaining chips renumber to 1 (view) and 2 (create). Clicks Save.
- Expected outcome: Block now has 2 requirements: [view, create]. "search Post" appears in the unassigned list (assuming no other block references it).

**Scenario 6: Deleting a block**
- Setup: Block "About Section" references requirement "App description".
- Action: User clicks delete on "About Section" card.
- Expected outcome: Block is removed. "App description" requirement is unaffected — it appears in the unassigned list. Sidebar badge decrements.

**Scenario 7: Reordering requirements on a block card**
- Setup: Block "Post Feed" has requirements in order: [search, view, create].
- Action: User hovers over the card. Clicks the down arrow on "search Post" (position 1).
- Expected outcome: Order becomes [view, search, create]. Numbers update to 1-2-3. State is saved immediately.

**Scenario 8: Requirement used in multiple blocks**
- Setup: Block "Post Feed" uses requirement "view Post". User creates a new block.
- Action: User clicks "+ New Block", types "Post Detail". In the available list, "view Post" is listed (not grayed out, not filtered). User clicks it — chip appears. Clicks Save.
- Expected outcome: Both "Post Feed" and "Post Detail" have "view Post" in their `requirementIds`. "view Post" does not appear in the unassigned list (it's in at least one block).

**Scenario 9: Save button validation**
- Setup: User opens the New Block form.
- Action: User types a name but selects no requirements. Then clears the name but selects a requirement. Then enters both.
- Expected outcome: Save disabled → Save disabled → Save enabled. Validation is real-time.

**Scenario 10: Deleted requirement in a block**
- Setup: Block "Post Feed" references requirement ids [A, B, C]. Requirement B is deleted via the Requirements panel.
- Action: User navigates to the Blocks panel.
- Expected outcome: "Post Feed" card shows requirements A and C (B is filtered out as missing). If the user edits the block, only A and C appear as chips. Saving the edit persists the cleaned-up `requirementIds` without B.

**Scenario 11: Unassigned section visibility**
- Setup: 3 requirements exist. All 3 are assigned to blocks.
- Action: User views the Blocks panel.
- Expected outcome: The "Unassigned Requirements" section is not shown. Only the block grid and next-step card are visible.

**Scenario 12: Quick-create dropdown dismissal**
- Setup: User hovers over an unassigned requirement and clicks "+ Block". Dropdown is open.
- Action: User clicks outside the dropdown (or presses Escape).
- Expected outcome: Dropdown closes. No block is created.

**Scenario 13: Mobile accordion view**
- Setup: Viewport is < 768px. User has 2 blocks and 2 unassigned requirements.
- Action: User taps the Blocks accordion header.
- Expected outcome: Accordion opens showing block cards (single column), unassigned requirements list with always-visible "+ Block" buttons, and the hint text. The inline form (if opened) shows chips above the available list — chips remain visible while scrolling through requirements.

## How to Verify

1. Open the app and navigate to the Blocks panel via sidebar — verify header, description, and empty state render correctly
2. Click "+ New Block" — verify form opens with name input and requirement selector
3. Select requirements by clicking — verify chips appear numbered, items highlight, save button enables
4. Remove a chip — verify it disappears, numbers update, item un-highlights
5. Save a block — verify card appears in grid, sidebar updates, form closes
6. Create a composite block with 3+ requirements — verify reorder buttons appear on card hover
7. Click reorder arrows — verify order changes and persists
8. Click edit on a block — verify form pre-populates correctly
9. Click delete on a block — verify removal, sidebar update, requirements appear in unassigned list
10. Use quick-create on an unassigned requirement — verify dropdown shows correct options, clicking one creates the block
11. Assign all requirements — verify unassigned section disappears
12. Add a requirement to multiple blocks — verify it works and doesn't appear in unassigned list
13. Delete a requirement that's in a block, then view the block — verify graceful handling
14. Resize below 768px — verify accordion layout, single-column cards, always-visible quick-create buttons, chips visible above available list
15. `npm run build` compiles without errors
16. `npx vitest run` passes
