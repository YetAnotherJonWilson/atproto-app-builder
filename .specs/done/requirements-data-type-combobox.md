# Spec: Requirements Panel — Data Type Combobox & Seeding

**Status:** done
**Date:** 2026-03-19

## What
Replace the plain text "Data" input in the "do" requirement form with a combobox that lets users select an existing data type or create a new one. When a new data type name is entered, a RecordType is seeded in `wizardState.recordTypes`. Requirements are linked to their data type via a `dataTypeId` field. The requirement type dropdown is locked when editing an existing requirement.

## Why
The plain text "Data" input gives users no visibility into data types that already exist, leading to accidental duplicates and disconnected data modeling. A select-or-create combobox makes the relationship between requirements and data types explicit, encourages reuse, and seeds the data model as a natural side effect of defining requirements. Locking the type dropdown on edit prevents confusing type-switching behavior — users delete and recreate instead.

## Data Model Changes

### RecordType (modified)

In `src/types/wizard.ts`, update `RecordType`:

```typescript
export interface RecordType {
  id: string;
  name: string;           // lexicon-compatible identifier; empty string until user sets it (future)
  displayName: string;    // human-readable label, seeded from requirement's data type selection
  description: string;
  fields: Field[];
}
```

- `displayName` is added to hold the human-readable label from the requirement (e.g., "grocery item").
- `name` remains a string (empty string `''` when unset). It will be populated in a future spec when lexicon editing is added.

### Requirement (modified)

Add `dataTypeId` to the `Requirement` interface:

```typescript
export interface Requirement {
  // ... existing fields ...
  // 'do' type — link to associated RecordType
  dataTypeId?: string;
}
```

When a "do" requirement is saved, `dataTypeId` is set to the selected or newly created RecordType's `id`.

## Requirements Form — Data Type Select-or-Create

### Current state
The "do" requirement form currently has two plain text inputs:
```
[Verb: ________]  [Data: ________]
```

### New behavior
The "Data" input is replaced with a **combobox** — a text input with a dropdown of existing data types. The user either selects an existing data type or types a new name to create one.

**Form layout:**
```
<div class="form-hint">As a user of the app, I need to&hellip;</div>
<div class="form-row">
  <div class="form-group">
    <label>Verb</label>
    <input id="req-do-verb" placeholder="search, list, create, update, etc.">
  </div>
  <div class="form-group">
    <label>Data Type</label>
    <div class="combobox" id="req-do-data-combobox">
      <input id="req-do-data" placeholder="e.g., grocery item, book, appointment"
             autocomplete="off">
      <div class="combobox-dropdown" id="req-do-data-dropdown">
        <!-- populated dynamically -->
      </div>
    </div>
    <div class="form-hint">What kind of thing does this action work with? Select an
    existing type or enter a new one. Focus on the thing being acted on — if your
    action involves two things (like "add an item to a list"), the item is the
    data type. The list is a separate type you'll connect later.</div>
  </div>
</div>
```

### Combobox behavior

**Dropdown visibility:**
- The dropdown appears when the data type input is focused AND at least one RecordType exists in `wizardState.recordTypes`.
- The dropdown hides when the input loses focus (with a small delay so clicks on dropdown items register) or when Escape is pressed.
- If no RecordTypes exist yet, the dropdown does not appear — the input behaves as a plain text field.

**Dropdown content:**
- Each existing RecordType appears as a selectable item, showing its `displayName`.
- Items are filtered as the user types: only RecordTypes whose `displayName` contains the typed text (case-insensitive) are shown.
- If the typed text does not match any existing type, the dropdown shows a "Create '[typed text]'" option at the bottom.
- If the typed text exactly matches an existing type's `displayName` (case-insensitive), the "Create" option is not shown.

**Selection:**
- Clicking a dropdown item (or pressing Enter when it is highlighted) selects that RecordType. The input value is set to the selected type's `displayName`. The form stores the selected `dataTypeId` internally.
- If the user types a new name and either presses Tab/Enter or the input loses focus without selecting from the dropdown, the text is treated as a new data type name. A new RecordType will be created on save.

**Dropdown item markup:**
```
<div class="combobox-item" data-record-id="[id]">
  [displayName]
</div>
<div class="combobox-item combobox-create">
  Create "[typed text]"
</div>
```

### Editing a "do" requirement

When a user edits an existing "do" requirement:
- The form pre-fills with the current verb and data type. The combobox input shows the linked RecordType's `displayName`.
- The user can change the data type selection to a different existing type or create a new one.
- Changing the data type **unlinks** the requirement from its previous RecordType (the old RecordType is not deleted — it becomes orphaned if no other requirements reference it).
- The requirement's `dataTypeId` is updated to the newly selected/created RecordType's `id`.

### Locking the type dropdown on edit

When a user edits an existing requirement (any type — know, do, or navigate):
- The type dropdown (`#req-type-select`) is disabled, showing the current type but not allowing change.
- The user can edit the type-specific fields (verb, data type, etc.) but cannot switch between know/do/navigate.
- If the user needs a different type, they delete this requirement and create a new one.

### Validation

- Both verb and data type fields must be non-empty for the save button to enable.
- If the data type input is empty or whitespace-only, the save button remains disabled.
- No additional error message is needed — the disabled button is sufficient (matches existing behavior for other requirement types).

## Seeding Behavior

### When a "do" requirement is saved with a new data type name
1. The system creates a new `RecordType` with:
   - `id`: generated via `generateId()`
   - `displayName`: the text the user typed (trimmed)
   - `name`: empty string `''`
   - `description`: empty string `''`
   - `fields`: empty array `[]`
2. The `RecordType` is appended to `wizardState.recordTypes`.
3. The requirement's `dataTypeId` is set to the new RecordType's `id`.
4. State is saved and the data panel sidebar updates (badge count, item list).

### When a "do" requirement is saved with an existing data type selected
1. No new RecordType is created.
2. The requirement's `dataTypeId` is set to the selected RecordType's `id`.
3. State is saved and the sidebar updates.

### When a "do" requirement is edited and the data type changes
1. The requirement's `dataTypeId` is updated to the new selection (existing or newly created).
2. The previously linked RecordType is **not** deleted. It remains in `wizardState.recordTypes` as an orphan if no other requirements reference it.

### When a "do" requirement is deleted
- The linked RecordType is **not** deleted. It becomes orphaned.
- Orphaned RecordTypes remain available for selection by future requirements via the combobox.
- Cleanup of orphaned RecordTypes is addressed by future validation checks (see Future Work).

### Sidebar updates after seeding

When RecordTypes are added, the data section sidebar updates:
1. Badge count: `.sidebar-section[data-section="data"] .badge` — set to `wizardState.recordTypes.length`
2. Item list: `.sidebar-item` entries showing `displayName` (truncated if needed)
3. `.has-items` class on `.sidebar-section[data-section="data"]`

This reuses the same sidebar update pattern as the requirements panel. The update function should be callable from RequirementsPanel after seeding without requiring the Data panel to be rendered.

## Behavioral Scenarios

**Scenario 1: Adding a first "do" requirement seeds a data type**
- Setup: No RecordTypes exist. User is on the Requirements panel.
- Action: User adds a "do" requirement with verb="create", types "book" in the data type field. No dropdown appears (no existing types). User saves.
- Expected outcome: A RecordType is created with `displayName: "book"`, `name: ""`, empty description and fields. The data sidebar badge shows "1". The requirement's `dataTypeId` links to the new RecordType.

**Scenario 2: Second requirement shows existing types in dropdown**
- Setup: One RecordType exists: "book". User opens the "do" requirement form.
- Action: User sets verb="list", then focuses the data type input. Dropdown appears showing "book". User types "gr" — dropdown filters to show nothing from existing types, plus a "Create 'gr'" option. User continues typing "grocery item", then tabs out of the combobox. The input retains "grocery item" as a new type name (no RecordType is created yet). User clicks Save.
- Expected outcome: A second RecordType is created with `displayName: "grocery item"`. The requirement links to it. Data sidebar badge shows "2".

**Scenario 3: Selecting an existing data type**
- Setup: RecordTypes exist: "book" and "grocery item". User opens the "do" requirement form.
- Action: User sets verb="update", focuses data type input. Dropdown shows "book" and "grocery item". User clicks "book".
- Expected outcome: Input shows "book". On save, the requirement's `dataTypeId` is set to the existing "book" RecordType. No new RecordType is created. Badge stays at "2".

**Scenario 4: Editing a requirement changes its data type link**
- Setup: User has a "do" requirement "create a book" linked to the "book" RecordType.
- Action: User edits the requirement, changes the data type to "novel" (a new name), and saves.
- Expected outcome: A new RecordType "novel" is created. The requirement's `dataTypeId` now points to "novel". The "book" RecordType is **not deleted** — it remains as an orphan. Data sidebar badge shows "3" (book, grocery item, novel).

**Scenario 5: Deleting a requirement orphans its data type**
- Setup: User has a "do" requirement linked to "novel". No other requirements reference "novel".
- Action: User deletes the requirement.
- Expected outcome: The "novel" RecordType remains in `wizardState.recordTypes`. Badge stays at "3". If the user later creates a new "do" requirement, "novel" appears in the dropdown for re-selection.

**Scenario 6: Re-selecting an orphaned data type**
- Setup: "novel" is an orphaned RecordType (no requirements link to it). User opens a new "do" requirement form.
- Action: User types "nov" in the data type field. Dropdown shows "novel" (filtered match). User clicks it.
- Expected outcome: On save, the requirement links to the existing "novel" RecordType. No new RecordType is created.

**Scenario 7: Exact match suppresses "Create" option**
- Setup: A RecordType with `displayName: "book"` exists. User opens the "do" requirement form.
- Action: User types "book" (exactly matching the existing type). Dropdown shows the "book" item but no "Create 'book'" option.
- Expected outcome: User can only select the existing "book" type, preventing accidental duplicates.

**Scenario 8: Requirement type cannot change on edit**
- Setup: User has a "do" requirement.
- Action: User clicks edit on the requirement.
- Expected outcome: The type dropdown is disabled, showing "Data Interaction" but not allowing change. The user can edit the verb and data type, but cannot switch to "know" or "navigate".

**Scenario 9: Requirement card displays data type name**
- Setup: User saves a "do" requirement with verb="create" and data type="book".
- Action: User views the requirements list.
- Expected outcome: The requirement card shows "I need to create book" (using the data type's `displayName`). The `item-meta` shows "Data Interaction".

## Scope

**In scope:**
- Combobox component for selecting or creating data types in the "do" requirement form
- Seeding RecordTypes when a new data type name is entered
- Linking requirements to RecordTypes via `dataTypeId`
- Data model changes: `RecordType.displayName` added, `Requirement.dataTypeId` added
- Disabling the type dropdown when editing any existing requirement
- Data sidebar badge and item list updates after seeding
- Form hint text with compound action guidance

**Out of scope:**
- Data panel UI (card grid, empty state) — see `.specs/active/data-panel-cards.md`
- Editing data type properties in the data panel — future spec
- Manual creation of data types (no "+ Add Data Type" button)
- Deleting data types
- Auto-generating lexicon name from the display name
- Validation checks before app generation
- Data modeling guidance beyond the form hint — see `.specs/active/data-modeling-guidance.md`

## Future Work (noted, not implemented)

1. **Data panel read-only cards:** Display seeded RecordTypes as cards in the Data panel. See `.specs/active/data-panel-cards.md`.
2. **Data type editing:** Card interactivity — editing displayName, setting lexicon name, adding/editing/deleting fields.
3. **Pre-generation validation:** Warn about orphaned data types, incomplete types, unresolved requirements.
4. **Delete data types:** Allow users to delete orphaned data types.
5. **Auto-name generation:** Auto-suggest a lexicon-compatible `name` from the `displayName`.
6. **Lexicon search:** Search for existing lexicons that match the data type.
7. **Data modeling guidance:** See `.specs/active/data-modeling-guidance.md`.

## Files Likely Affected

### Modified Files
- `src/types/wizard.ts` — Add `displayName` to `RecordType`, add `dataTypeId` to `Requirement`
- `src/app/views/panels/RequirementsPanel.ts` — Replace data text input with combobox, seed RecordTypes on save, manage `dataTypeId` link, disable type dropdown on edit, update data sidebar after seeding
- `src/app/views/WorkspaceLayout.ts` — Export or expose data sidebar update function so RequirementsPanel can call it after seeding
- `src/app/state/WizardState.ts` — Ensure `recordTypes` initializes with new shape (include `displayName`)

### New Files
- `styles/workspace/combobox.css` — Styles for the combobox dropdown component
- `tests/views/RequirementsPanel.combobox.test.ts` — Unit tests for combobox behavior and seeding logic

## Integration Boundaries

### RequirementsPanel → WizardState (seeding)
- **Data flowing out:** When a "do" requirement is saved, RequirementsPanel creates or selects a RecordType and writes the updated `recordTypes` and `requirements` arrays to state via `saveWizardState()`.
- **Expected contract:** RecordType is added to `wizardState.recordTypes` array. Requirement's `dataTypeId` is set.
- **Unavailability:** Both panels read/write the same localStorage-backed state. No cross-panel eventing needed.

### RequirementsPanel → Data Sidebar
- **Data flowing out:** After seeding, RequirementsPanel calls a sidebar update function to refresh the data section's badge, item list, and has-items class.
- **Expected contract:** The sidebar update function reads from `wizardState.recordTypes` and updates DOM elements under `.sidebar-section[data-section="data"]`.

### Generator (downstream consumer)
- **Data flowing in:** The generator reads `wizardState.recordTypes` to produce lexicon schemas.
- **Impact of changes:** Adding `displayName` is additive and does not break existing generator code. RecordTypes seeded by this spec will have empty `name` and `fields`, so they are not yet usable by the generator.

## How to Verify
1. Open the requirements form, select "Data Interaction" — confirm the data type field is a combobox with the hint text
2. With no existing types, type a name and save — confirm a RecordType is created and the data sidebar badge updates
3. Open a second "do" requirement — confirm the first type appears in the dropdown
4. Select an existing type — confirm no duplicate RecordType is created
5. Type a name that matches an existing type exactly — confirm no "Create" option appears
6. Edit a requirement and change its data type — confirm the old RecordType is preserved (orphaned)
7. Delete a requirement — confirm its RecordType persists in the sidebar
8. Edit any requirement — confirm the type dropdown is disabled
9. `npm run build` compiles without errors
10. `npx vitest run` passes
