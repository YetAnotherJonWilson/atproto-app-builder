# Spec: Data Panel — Read-Only Cards

**Status:** draft
**Date:** 2026-03-19
**Depends on:** `.specs/active/requirements-data-type-combobox.md`

## What
The Data panel displays RecordTypes (seeded from "do" requirements) as read-only cards in a grid. When no data types exist, it shows an empty state with a "Go to Requirements" button. Cards show the display name and completion status. No editing, no adding, no deleting — cards are informational placeholders.

## Why
Once users have seeded data types through the requirements form (see prerequisite spec), they need visibility into what types exist. The Data panel provides a simple overview — confirming that requirements are creating data types and showing what work remains (lexicon name, fields). Full editing comes in a future spec; this spec establishes the panel layout and rendering.

## Data Panel UI

The Data panel renders into `#workspace-panel-body`. The workspace shell provides `<h2>Define Data</h2>` in `#workspace-panel-header`.

### Panel States

**State A: Empty (no data types exist)**

Uses the `.empty-workspace` CSS class.

```
<div class="empty-workspace">
  <div class="empty-icon">&#9634;</div>
  <p>Define the data your app works with.</p>
  <p>Data types are created automatically when you add "Data Interaction"
  requirements. Go to the Requirements section to get started.</p>
  <button class="add-btn" id="data-go-to-req-btn">Go to Requirements</button>
</div>
```

The "Go to Requirements" button navigates to the requirements section (clicks the requirements sidebar header).

**State B: Has data types (card grid)**

```
<p class="workspace-desc">
  Each data type will become a Lexicon record type in your app.
  Details and fields can be added in a future step.
</p>

<div class="item-grid" id="data-list">
  [DataTypeCard 1]
  [DataTypeCard 2]
  ...
</div>
```

No manual "+ Add Data Type" button — data types are created through the requirements form only.

### Data Type Card

Each RecordType renders as a read-only card in the grid. Cards are always expanded (no collapse/expand toggle).

```
<div class="item-card" data-record-id="[id]">
  <div>
    <div class="item-name">[displayName]</div>
    <div class="item-meta">[completion status]</div>
  </div>
</div>
```

Cards have no action buttons (no edit, no delete) in this spec. They are informational only.

### Completion Status

The `item-meta` text on each card indicates what's still needed:
- If `name` is empty and `fields` is empty: "Name and fields needed"
- If `name` is empty but `fields` is non-empty: "Lexicon name needed"
- If `name` is set but `fields` is empty: "Fields needed"
- If `name` is set and `fields` is non-empty: field count, e.g. "3 fields"

Note: In this spec, all newly seeded RecordTypes will have empty `name` and empty `fields`, so all cards will show "Name and fields needed". This is expected — editing capabilities come in a future spec.

### Card Order

Cards are displayed in creation order (the order they appear in `wizardState.recordTypes`).

## Behavioral Scenarios

**Scenario 1: Empty data panel with no requirements**
- Setup: User has no "do" requirements and no RecordTypes.
- Action: User clicks the Data section in the sidebar.
- Expected outcome: State A is shown with guidance to add requirements first and a "Go to Requirements" button.

**Scenario 2: Viewing seeded data type cards**
- Setup: User has created two "do" requirements that seeded "book" and "grocery item" RecordTypes (via the prerequisite combobox spec).
- Action: User clicks the Data section in the sidebar.
- Expected outcome: State B shows two read-only cards: "book" and "grocery item", each showing "Name and fields needed". Cards are in creation order.

**Scenario 3: "Go to Requirements" button navigates**
- Setup: User is viewing the empty Data panel (State A).
- Action: User clicks "Go to Requirements".
- Expected outcome: The requirements sidebar header is clicked programmatically, switching to the Requirements panel.

**Scenario 4: Panel re-renders with fresh state**
- Setup: User is viewing the Data panel with one card ("book"). User switches to Requirements, adds a new "do" requirement seeding "grocery item", then switches back to Data.
- Action: User clicks the Data section in the sidebar.
- Expected outcome: State B shows two cards: "book" and "grocery item". The panel reads fresh state on render.

## Scope

**In scope:**
- Data panel rendering with empty state (State A) and card grid (State B)
- Read-only data type cards showing displayName and completion status
- "Go to Requirements" navigation from empty state
- Wiring the data panel in WorkspaceLayout

**Out of scope:**
- Combobox, seeding, and `dataTypeId` linkage — prerequisite spec (`.specs/active/requirements-data-type-combobox.md`)
- Editing data type properties (displayName, name, description, fields) — future spec
- Manual creation or deletion of data types
- Sidebar updates for data types — handled by the prerequisite spec
- Accordion (narrow viewport) layout
- Data modeling guidance — see `.specs/active/data-modeling-guidance.md`

## Future Work (noted, not implemented)

1. **Data type editing:** Card interactivity — editing displayName, setting lexicon name, adding/editing/deleting fields.
2. **Pre-generation validation:** Warn about orphaned data types, incomplete types.
3. **Delete data types:** Allow users to delete orphaned data types.
4. **Data modeling guidance:** Contextual tips and decision aids. See `.specs/active/data-modeling-guidance.md`.

## Files Likely Affected

### Modified Files
- `src/app/views/panels/DataPanel.ts` — Replace stub with card grid and empty state rendering
- `src/app/views/WorkspaceLayout.ts` — Wire data panel rendering (call `renderDataPanel()` and `wireDataPanel()` when the data section is active)

### New Files
- `tests/views/DataPanel.test.ts` — Unit tests for data panel rendering and state transitions

## Integration Boundaries

### WizardState → DataPanel (read-only)
- **Data flowing in:** DataPanel reads `wizardState.recordTypes` to render cards.
- **Expected contract:** Each RecordType has `id`, `displayName`, `name`, `description`, and `fields` (as defined by the prerequisite spec's data model changes).
- **Unavailability:** Panel reads from localStorage-backed state. If no RecordTypes exist, State A is shown.

## How to Verify
1. With no data types, click the Data section — confirm empty state with "Go to Requirements" button
2. Click "Go to Requirements" — confirm it switches to the Requirements panel
3. Create "do" requirements to seed data types, then click the Data section — confirm cards appear
4. Confirm cards show displayName and "Name and fields needed" status
5. Confirm cards are in creation order
6. Confirm cards have no edit/delete buttons
7. `npm run build` compiles without errors
8. `npx vitest run` passes
