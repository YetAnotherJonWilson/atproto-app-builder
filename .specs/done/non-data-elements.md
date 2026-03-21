# Spec: Non-Data Interactive Elements

**Status:** in-progress
**Date:** 2026-03-21

## What

Add support for non-data interactive elements as a target for "do" requirements. Currently, all "do" requirements target a data type (backed by a RecordType stored in a PDS). This change adds a toggle within the "do" form so users can instead target a non-data element — something interactive that isn't stored in a PDS (e.g., a timer, a calculator, a drawing canvas). Non-data elements are reusable: multiple requirements can reference the same named element with different verbs. An optional "Uses data from" field lets users declare a dependency on a data type.

## Why

Not all user interactions involve PDS-stored data. An app might have a timer, a color picker, a drag-and-drop sorter, or other interactive elements that exist purely in the client. The wizard needs to capture these interactions so they flow into the components and views panels, even though the generated output will initially be a placeholder or minimal scaffold. Without this, users are forced to either skip these requirements or awkwardly model them as data types.

## Data Model Changes

### New type: `NonDataElement`

Add to `src/types/wizard.ts`:

```typescript
export interface NonDataElement {
  id: string;
  name: string; // human-readable label, e.g. "Timer"
}
```

### WizardState (modified)

Add a `nonDataElements` array:

```typescript
export interface WizardState {
  // ... existing fields ...
  nonDataElements: NonDataElement[];
}
```

Initialize as `[]` in `initializeWizardState()`.

### Requirement (modified)

Add fields to the `Requirement` interface:

```typescript
export interface Requirement {
  // ... existing fields ...
  // 'do' type — interaction target
  interactionTarget?: 'data' | 'element'; // default 'data' for backward compat
  elementId?: string;                     // link to NonDataElement (when target is 'element')
  usesDataTypeId?: string;                // optional data source for element interactions
}
```

For existing `do` requirements that lack `interactionTarget`, treat them as `'data'`.

## UI Changes

### Interaction target selector

When the main type select is set to "Data Interaction", a second select appears in the `#req-header-right` area (same pattern as the nav type dropdown):

```html
<label>Target</label>
<select id="req-do-target-select">
  <option value="data">Data Type</option>
  <option value="element">Non-data Element</option>
</select>
```

Changing this select swaps the form fields in `#req-type-fields` between the existing data type form and the new element form. The verb field stays the same in both variants.

When editing an existing `do` requirement, the target select is disabled (same lockout pattern as the main type dropdown — user must delete and recreate to change target kind).

### Element form (target = "element")

When "Non-data Element" is selected:

```
<div class="form-hint">As a user of the app, I need to&hellip;</div>
<div class="form-row">
  <div class="form-group">
    <label>Verb</label>
    <input id="req-do-verb" placeholder="set, start, stop, draw, etc."
           value="[existing verb]">
  </div>
  <div class="form-group">
    <label>Element</label>
    <div class="combobox" id="req-do-element-combobox">
      <input id="req-do-element" placeholder="e.g., timer, calculator, canvas"
             autocomplete="off" value="[existing element name]">
      <div class="combobox-dropdown" id="req-do-element-dropdown">
      </div>
    </div>
    <div class="form-hint">Name the interactive element. Select an existing
    element or enter a new one.</div>
  </div>
</div>
<div class="form-row">
  <div class="form-group">
    <label>Uses data from <span class="label-optional">(optional)</span></label>
    <div class="combobox" id="req-uses-data-combobox">
      <input id="req-uses-data" placeholder="e.g., settings, preferences"
             autocomplete="off" value="[existing data type name]">
      <div class="combobox-dropdown" id="req-uses-data-dropdown">
      </div>
    </div>
    <div class="form-hint">Some elements need stored data to work. For example,
    a timer might use saved preferences to auto-configure.</div>
  </div>
</div>
```

### Element combobox behavior

The element combobox follows the same pattern as the data type combobox:

- **Dropdown visibility:** Appears on focus when at least one `NonDataElement` exists in state. Hides on blur (with click delay) or Escape.
- **Dropdown content:** Shows existing elements filtered by typed text (case-insensitive). Shows a "Create '[typed text]'" option when no exact match exists.
- **Selection:** Clicking an item selects that element. Typing a new name and tabbing/blurring treats it as a new element name (created on save).
- **Exact match:** When typed text exactly matches an existing element name (case-insensitive), the "Create" option is suppressed.

### "Uses data from" combobox behavior

This combobox shows existing RecordTypes (data types), using the same combobox pattern:

- **Dropdown visibility:** Appears on focus when at least one RecordType exists.
- **Dropdown content:** Shows existing RecordTypes filtered by typed text, displaying `displayName`.
- **Selection:** Clicking an item selects that data type. The requirement's `usesDataTypeId` is set.
- **Create option:** Shows a "Create '[typed text]'" option, same as the main data type combobox. If selected, a new RecordType is seeded (same seeding behavior as existing data type combobox).
- **Optional:** Unlike verb and element name, this field can be left empty. An empty field means the element doesn't depend on any stored data.
- **Clearing:** If the user clears the field and saves, `usesDataTypeId` is removed from the requirement.

### Data type form (target = "data")

Unchanged from current behavior. The existing combobox, hint text, and guidance details remain as-is.

## Seeding Behavior

### Non-data elements

When a "do" requirement with target "element" is saved:

1. If the element name matches an existing `NonDataElement` (case-insensitive `name`), the requirement links to it via `elementId`.
2. If the element name is new, a `NonDataElement` is created with `id` from `generateId()` and `name` from the input (trimmed). It's appended to `wizardState.nonDataElements`. The requirement's `elementId` is set to the new element's `id`.

### "Uses data from" seeding

When the "uses data from" field has a value on save:

1. If it matches an existing RecordType's `displayName`, the requirement's `usesDataTypeId` is set to that RecordType's `id`. No new RecordType is created.
2. If it's a new name, a RecordType is seeded (same as existing data type combobox seeding: `displayName` set, `name` empty, `fields` empty). The requirement's `usesDataTypeId` is set to the new RecordType's `id`. The data sidebar updates.

### Orphan behavior

When a "do/element" requirement is deleted:
- The linked `NonDataElement` is **not** deleted. It remains available for future requirements.
- The linked RecordType (from "uses data from") is **not** deleted. Same orphan behavior as data type requirements.

## Display

### Requirement list item

Element interactions display as:

```
I need to [verb] the [element name]
```

Example: "I need to set the Timer"

The item meta shows "Data Interaction" (same as data-target `do` requirements — both are interactions).

### Sidebar item

```
Do: [verb] [element name]
```

Example: "Do: set Timer"

Same format as data interactions, using element name instead of data type name.

## Validation

- **Verb** and **Element name** are both required (same as verb + data type for data interactions).
- **"Uses data from"** is optional — its emptiness does not affect save button state.
- Save button enables/disables in real-time based on verb and element name fields only.

## Behavioral Scenarios

**Scenario 1: First non-data element requirement**
- Setup: No NonDataElements exist. User is on the Requirements panel.
- Action: User clicks Add, selects "Data Interaction" type. In the header-right area, user changes the target select from "Data Type" to "Non-data Element". The form fields swap. User enters verb="set", element="Timer", leaves "Uses data from" empty. Clicks Save.
- Expected outcome: A NonDataElement `{ name: "Timer" }` is created. The requirement shows "I need to set the Timer". Sidebar item shows "Do: set Timer". No RecordType is created.

**Scenario 2: Reusing an existing element with a different verb**
- Setup: NonDataElement "Timer" exists from Scenario 1.
- Action: User adds another "do/element" requirement. Focuses the element input — dropdown shows "Timer". User selects it. Enters verb="start". Saves.
- Expected outcome: No new NonDataElement created. Requirement links to existing "Timer" via `elementId`. List shows "I need to start the Timer".

**Scenario 3: Element with data dependency**
- Setup: RecordType "Settings" exists. User adds a "do/element" requirement.
- Action: User enters verb="configure", element="Timer". In "Uses data from", focuses the input — dropdown shows "Settings". User selects it. Saves.
- Expected outcome: Requirement has `elementId` linking to "Timer" and `usesDataTypeId` linking to "Settings". No new RecordType created.

**Scenario 4: Element with new data dependency (seeds a RecordType)**
- Setup: No RecordTypes exist. User adds a "do/element" requirement.
- Action: User enters verb="set", element="Timer", types "Preferences" in "Uses data from". Saves.
- Expected outcome: NonDataElement "Timer" is created. RecordType with `displayName: "Preferences"` is seeded. Data sidebar updates to show "Preferences" with badge "1". Requirement links to both.

**Scenario 5: Editing a do/element requirement — target locked**
- Setup: User has a "do/element" requirement "set the Timer".
- Action: User clicks Edit. The type dropdown shows "Data Interaction" (disabled). The target select shows "Non-data Element" (disabled). Verb and element fields are editable and pre-filled. User changes verb to "reset", saves.
- Expected outcome: Requirement updates to "I need to reset the Timer". Element link unchanged.

**Scenario 6: Switching target while adding (before save)**
- Setup: User clicks Add, selects "Data Interaction", starts filling in the data type form.
- Action: User switches the target select from "Data Type" to "Non-data Element".
- Expected outcome: Form fields swap to the element form. Any previously entered verb is preserved. The data type field clears and is replaced by the element field. The "Uses data from" field appears.

**Scenario 7: Switching target back clears element fields**
- Setup: User is on the element form, has entered verb="set", element="Timer".
- Action: User switches the target select back to "Data Type".
- Expected outcome: Form fields swap to the data type form. Verb "set" is preserved. Element and "uses data from" values are cleared. The data type combobox appears empty.

**Scenario 8: Exact element name match suppresses Create option**
- Setup: NonDataElement "Timer" exists. User opens a new "do/element" requirement.
- Action: User types "timer" (lowercase) in the element field.
- Expected outcome: Dropdown shows existing "Timer" item. No "Create 'timer'" option appears (case-insensitive match).

**Scenario 9: Deleting requirement orphans element**
- Setup: One requirement references NonDataElement "Timer". No other requirements reference it.
- Action: User deletes the requirement.
- Expected outcome: "Timer" remains in `wizardState.nonDataElements`. If user creates a new "do/element" requirement, "Timer" appears in the element dropdown.

**Scenario 10: Save button validation — "uses data from" is optional**
- Setup: User is on the element form.
- Action: User enters verb="start", element="Timer", leaves "Uses data from" empty.
- Expected outcome: Save button is enabled. "Uses data from" being empty does not block saving.

## Scope

**In scope:**
- Target toggle (select) within the "do" requirement form
- Non-data element combobox (select-or-create)
- "Uses data from" optional combobox
- `NonDataElement` type and `nonDataElements` array on WizardState
- Requirement fields: `interactionTarget`, `elementId`, `usesDataTypeId`
- Seeding NonDataElements on save
- Seeding RecordTypes from "uses data from" on save
- Display in requirement list and sidebar
- Target select lockout on edit

**Out of scope:**
- Components panel rendering of non-data elements (future — components panel spec)
- Generated code output for non-data elements (future)
- Deleting orphaned NonDataElements
- Non-data element management UI (no dedicated panel or list)
- Any visual representation in the Data panel (non-data elements are not data)

## Files Likely Affected

### Modified Files
- `src/types/wizard.ts` — Add `NonDataElement` interface, add `nonDataElements` to `WizardState`, add `interactionTarget`, `elementId`, `usesDataTypeId` to `Requirement`
- `src/app/state/WizardState.ts` — Initialize `nonDataElements: []` in `initializeWizardState()`
- `src/app/views/panels/RequirementsPanel.ts` — Target select in header-right for `do` type, element form rendering, element combobox wiring, "uses data from" combobox wiring, save/edit logic, display text updates
- `tests/views/RequirementsPanel.test.ts` — Tests for element interactions

### New Files
- None expected — changes are additions to existing files

## Integration Boundaries

### RequirementsPanel → WizardState (non-data elements)
- **Data flowing out:** When a "do/element" requirement is saved, RequirementsPanel creates or selects a NonDataElement and writes the updated `nonDataElements` and `requirements` arrays via `saveWizardState()`.
- **Expected contract:** NonDataElement is appended to `wizardState.nonDataElements`. Requirement's `elementId` is set.

### RequirementsPanel → WizardState (uses data from)
- **Data flowing out:** When "uses data from" names a new data type, RequirementsPanel seeds a RecordType (same as existing combobox seeding) and sets `usesDataTypeId`.
- **Expected contract:** Same seeding contract as the data type combobox. Data sidebar updates after seeding.

### Backward Compatibility
- Existing `do` requirements without `interactionTarget` default to `'data'`. No migration needed.
- `nonDataElements` initializes as `[]`. Existing saved states without this field get it on next `initializeWizardState()` call.

## Resolved Ambiguities

1. **Verb placeholder text for elements** — Different placeholder text for each target: "search, list, create, update, etc." for data types, "set, start, stop, draw, etc." for elements. The interaction patterns differ.

2. **Guidance details for elements** — No compound action guidance section for the element form. Element interactions are simpler and the "uses data from" field handles the main compound case.

## How to Verify

1. Open the requirements form, select "Data Interaction" — confirm a "Target" select appears in the header-right showing "Data Type" and "Non-data Element"
2. Switch to "Non-data Element" — confirm form swaps to element combobox + "Uses data from" field
3. Enter verb and element name, save — confirm NonDataElement is created in state, requirement displays correctly
4. Add another requirement — confirm existing element appears in the element dropdown
5. Add a requirement with "Uses data from" referencing a new data type — confirm RecordType is seeded and data sidebar updates
6. Edit a do/element requirement — confirm target select is disabled
7. Delete a do/element requirement — confirm NonDataElement persists in state
8. Switch target from "Data Type" to "Non-data Element" and back — confirm fields swap correctly and verb is preserved
9. `npm run build` compiles without errors
10. `npx vitest run` passes
