# Spec: Redesign "Do" Requirement Form — Description + Pick-Then-Type Items

**Status:** ready
**Date:** 2026-03-24

## What

Replace the [verb] + [data type or widget combobox] form for "do" requirements with a [description] textarea + pick-then-type item selection. Users write a free-text user story describing the interaction, then attach one or more data types and/or one widget by clicking `[+ Data Type]` or `[+ Widget]` buttons that each open the appropriate combobox. Selected items appear as removable chips. This replaces the verb input, the Data/Widget target dropdown, and the separate data-target vs element-target form paths with a single unified form.

## Why

The current [verb] [noun] structure forces users to decompose a natural interaction ("I need to add an item to my grocery list") into a short verb and a single data type or widget name. This is awkward for compound interactions and creates friction when the user's mental model doesn't map cleanly to verb + noun. A free-text description lets users express the requirement naturally, while the pick-then-type item selector preserves the structured data (data types and widgets) that downstream panels (Blocks, Views, Generator) need.

## Data Model Changes

### Requirement (modified)

In `src/types/wizard.ts`, update the `Requirement` interface:

```typescript
export interface Requirement {
  // ... existing fields ...
  // 'do' type — NEW fields
  description?: string;        // free-text user story (replaces verb)
  dataTypeIds?: string[];      // links to RecordTypes (replaces single dataTypeId)
  // 'do' type — KEPT
  elementId?: string;          // link to NonDataElement (max one widget)
  // 'do' type — REMOVED
  // verb — replaced by description
  // data — was already superseded by dataTypeId, fully removed
  // interactionTarget — derived from presence of elementId
  // usesDataTypeId — subsumed by dataTypeIds array
  // dataTypeId — replaced by dataTypeIds array
}
```

**Derivation rule:** A requirement "has a widget" when `elementId` is set. A requirement "has data types" when `dataTypeIds` is non-empty. These replace the explicit `interactionTarget` field. BlocksPanel and other consumers derive the target from these fields rather than reading `interactionTarget`.

### Migration

Existing saved states need field migration on load. In `WizardState.ts` initialization or a migration function:

1. For each "do" requirement:
   - If `verb` exists: set `description` to `verb` + (if `data` exists: ` ${data}`). Remove `verb` and `data`.
   - If `dataTypeId` exists (single): set `dataTypeIds` to `[dataTypeId]`. Remove `dataTypeId`.
   - If `usesDataTypeId` exists: append to `dataTypeIds` (if not already present). Remove `usesDataTypeId`.
   - Remove `interactionTarget` (no longer stored).

## UI Changes

### Header-right area

The Data/Widget target dropdown (`renderDoTargetDropdown`) is removed for "do" requirements. The header-right area for "do" returns empty string (same as "know"). The "navigate" header-right (nav type dropdown) is unchanged.

### "Do" form — single path replaces two

The current `renderDoDataFields` and `renderDoElementFields` are replaced with a single `renderDoFields` function:

```
<div class="form-hint">As a user of the app, I need to&hellip;</div>
<div class="form-group">
  <label>Description</label>
  <textarea id="req-do-description"
    placeholder="e.g., add items to my grocery list, set a timer using my saved presets"
  >[existing description]</textarea>
</div>
<div class="form-group">
  <label>Data Types &amp; Widgets</label>
  <div class="form-hint">Add at least one data type or widget involved in this interaction.</div>
  <div id="req-do-items-chips">
    <!-- chips appear here as items are added -->
  </div>
  <div id="req-do-item-buttons">
    <button class="wizard-button-secondary wizard-button-small" id="req-do-add-data">
      + Data Type
    </button>
    <button class="wizard-button-secondary wizard-button-small" id="req-do-add-widget">
      + Widget
    </button>
  </div>
  <div id="req-do-item-combobox-area">
    <!-- combobox renders here when a button is clicked -->
  </div>
</div>
```

### Pick-then-type flow

1. User clicks `[+ Data Type]` or `[+ Widget]`.
2. The appropriate combobox appears in `#req-do-item-combobox-area`, searching `recordTypes` or `nonDataElements` respectively. Combobox behavior (dropdown, filtering, create option, exact match suppression) is identical to the existing comboboxes.
3. User selects an existing item or types a new name (triggering "Create" on save).
4. The combobox closes and a **chip** appears in `#req-do-items-chips`:

```html
<span class="item-chip" data-item-type="data" data-item-id="[id]">
  grocery item
  <button class="item-chip-remove" aria-label="Remove">&times;</button>
</span>
```

Or for a new (not yet created) item:

```html
<span class="item-chip" data-item-type="widget" data-item-name="Timer">
  Timer <span class="item-chip-type">(new widget)</span>
  <button class="item-chip-remove" aria-label="Remove">&times;</button>
</span>
```

5. The `[+ Data Type]` button remains available for adding more data types.
6. The `[+ Widget]` button disables once a widget chip exists (max one).
7. Clicking the `x` on a chip removes it. If a widget chip is removed, `[+ Widget]` re-enables.

### Chip display

Each chip shows:
- The item's display name (RecordType `displayName` or NonDataElement `name`)
- For new items not yet in state: a `(new data type)` or `(new widget)` suffix
- An `x` button to remove

Chips for data types and widgets look the same except for the "(new ...)" suffix on unsaved items. No special color coding or icons needed.

### Combobox cancel

If the user clicks a `[+ ...]` button but then wants to cancel without selecting:
- Clicking outside the combobox (blur) closes it without adding a chip.
- Pressing Escape closes it without adding a chip.
- The buttons return to their previous enabled/disabled state.

### Editing a "do" requirement

When editing:
- Description textarea pre-fills with existing `description`.
- Existing linked data types and widget appear as chips (with their current names from state).
- `[+ Widget]` is disabled if a widget chip is already present.
- User can remove chips (unlinking items) and add new ones.
- Removing a data type chip does not delete the RecordType (orphan behavior, same as today).
- Removing a widget chip does not delete the NonDataElement (same as today).

### Guidance details

The existing `<details>` element with compound action guidance ("Does your action involve two things?") is removed. The new design handles compound interactions naturally by allowing multiple items, making the guidance unnecessary.

## Seeding Behavior

Unchanged from current behavior, applied per-item on save:

- **New data type name** → `resolveOrCreateDataType` creates a RecordType, appends to `wizardState.recordTypes`, returns the ID. Added to `dataTypeIds`.
- **Existing data type selected** → ID added to `dataTypeIds`. No new RecordType.
- **New widget name** → `resolveOrCreateElement` creates a NonDataElement, appends to `wizardState.nonDataElements`, returns the ID. Set as `elementId`.
- **Existing widget selected** → ID set as `elementId`. No new NonDataElement.
- **Data sidebar updates** after any new RecordType is seeded (same as today).

## Display

### Requirement list item

```
[description]                                      <- item-name
grocery item, grocery list, Timer                  <- item-meta
```

- `item-name`: the `description` text.
- `item-meta`: comma-separated list of linked data type display names and widget name. If a widget is present, append `(widget)` after its name to distinguish it.

Example: description "add items to my grocery list using saved presets", linked to data types "grocery item" and "grocery list" plus widget "Timer":

```
add items to my grocery list using saved presets
grocery item, grocery list, Timer (widget)
```

### Sidebar item

```
Do: [truncated description]
```

Example: `Do: add items to my grocery l...`

Same truncation behavior as today, using `description` instead of `verb + data`.

### Placeholder generator

The placeholder summary for "do" requirements changes from `"${verb} ${dataType.displayName}"` to just the `description` text. The linked items are already communicated through the block's other metadata.

## Validation

- **Description** must be non-empty (trimmed) for save to enable.
- **At least one item** (data type or widget) must be attached as a chip for save to enable.
- Save button enables/disables in real-time as the user types in the description and adds/removes chips.
- No minimum on data types specifically — one widget with no data types is valid.
- No maximum on data types. Maximum one widget.

## Behavioral Scenarios

**Scenario 1: Adding a "do" requirement with one data type**
- Setup: No requirements exist. User clicks Add, selects "Data Interaction".
- Action: Form appears with description textarea and `[+ Data Type]` / `[+ Widget]` buttons. User types "track my meditation sessions" in the description. Clicks `[+ Data Type]`. Combobox appears — no existing types, so no dropdown. User types "meditation session" and presses Enter/Tab. Chip appears: "meditation session (new data type)". User clicks Save.
- Expected outcome: Requirement saved with `description: "track my meditation sessions"`, `dataTypeIds: ["<new-id>"]`. RecordType "meditation session" is created. Data sidebar badge increments. List shows "track my meditation sessions" with meta "meditation session".

**Scenario 2: Adding a "do" requirement with multiple data types**
- Setup: RecordType "grocery item" exists.
- Action: User adds a "do" requirement. Types "manage my grocery lists and their items" in description. Clicks `[+ Data Type]`. Combobox shows "grocery item". User selects it — chip appears. Clicks `[+ Data Type]` again. Types "grocery list" — sees "Create 'grocery list'" option. Clicks it — second chip appears. Clicks Save.
- Expected outcome: Requirement has `dataTypeIds` linking to existing "grocery item" and newly created "grocery list". Two chips were visible before save. List meta shows "grocery item, grocery list".

**Scenario 3: Adding a "do" requirement with a widget only**
- Setup: User adds a "do" requirement.
- Action: Types "use the drawing canvas to sketch ideas" in description. Clicks `[+ Widget]`. Types "canvas". Chip appears: "canvas (new widget)". `[+ Widget]` button disables. User clicks Save.
- Expected outcome: Requirement has `elementId` linking to newly created NonDataElement "canvas". No `dataTypeIds`. List meta shows "canvas (widget)".

**Scenario 4: Adding a "do" requirement with a widget and data types**
- Setup: RecordType "presets" exists.
- Action: User adds "do" requirement. Types "set my timer using saved presets" in description. Clicks `[+ Widget]`, types "Timer", chip appears. `[+ Widget]` disables. Clicks `[+ Data Type]`, selects "presets", chip appears. Clicks Save.
- Expected outcome: Requirement has `elementId` for "Timer" and `dataTypeIds` for "presets". List meta shows "presets, Timer (widget)".

**Scenario 5: Widget button disables after one widget, re-enables on remove**
- Setup: User is filling in a "do" requirement form.
- Action: Clicks `[+ Widget]`, adds "Timer". `[+ Widget]` disables. User clicks `x` on the Timer chip.
- Expected outcome: Timer chip removed. `[+ Widget]` re-enables. User can add a different widget.

**Scenario 6: Canceling a combobox without selecting**
- Setup: User is filling in a "do" requirement form with one data type chip already added.
- Action: Clicks `[+ Data Type]`. Combobox appears. User presses Escape (or clicks outside).
- Expected outcome: Combobox closes. No new chip added. Existing chip unchanged.

**Scenario 7: Save button requires description AND at least one item**
- Setup: User is on the "do" requirement form, both fields empty.
- Action: Types "do something" in description — Save still disabled (no items). Clicks `[+ Data Type]`, adds "thing" — Save enables. Removes the chip — Save disables. Adds it back — Save enables. Clears description — Save disables.
- Expected outcome: Save button tracks both conditions in real-time.

**Scenario 8: Editing a requirement — chips pre-populated**
- Setup: A "do" requirement exists with description "add items to my grocery list", linked to data types "grocery item" and "grocery list".
- Action: User clicks Edit.
- Expected outcome: Description textarea shows "add items to my grocery list". Two chips visible: "grocery item" and "grocery list". `[+ Widget]` is enabled (no widget attached). `[+ Data Type]` is enabled.

**Scenario 9: Editing — removing a data type chip**
- Setup: User is editing the requirement from Scenario 8.
- Action: User removes the "grocery list" chip by clicking `x`.
- Expected outcome: Chip disappears. On Save, requirement's `dataTypeIds` only contains "grocery item" ID. The "grocery list" RecordType is NOT deleted — it remains as an orphan.

**Scenario 10: Editing — adding a widget to an existing data-only requirement**
- Setup: User is editing a requirement that has only data types.
- Action: Clicks `[+ Widget]`, types "sorter", chip appears. Clicks Save.
- Expected outcome: Requirement now has `elementId` linking to new NonDataElement "sorter" in addition to existing `dataTypeIds`.

**Scenario 11: Block creation — requirement with widget auto-names**
- Setup: A "do" requirement has `elementId` set (has a widget).
- Action: User clicks "+ Block" for this requirement in the Blocks panel.
- Expected outcome: Block auto-creates with name derived from the widget (same behavior as today). No quick-name dropdown shown.

**Scenario 12: Block creation — requirement with only data types shows dropdown**
- Setup: A "do" requirement has `dataTypeIds` but no `elementId`.
- Action: User clicks "+ Block" for this requirement in the Blocks panel.
- Expected outcome: Quick-name dropdown appears with Form, List, Card, Table, Detail View options (same behavior as today).

**Scenario 13: Block creation — requirement with both widget and data types**
- Setup: A "do" requirement has both `elementId` and `dataTypeIds`.
- Action: User clicks "+ Block" for this requirement in the Blocks panel.
- Expected outcome: Block auto-creates with name derived from the widget (widget takes precedence for block naming). Same as widget-only behavior.

**Scenario 14: Duplicate data type excluded from combobox**
- Setup: User is filling in a "do" requirement and has already added "grocery item" as a data type chip.
- Action: User clicks `[+ Data Type]`. Combobox dropdown appears showing existing data types.
- Expected outcome: "grocery item" does not appear in the dropdown. Other existing data types are shown normally. User cannot add "grocery item" a second time.

**Scenario 15: Migration — existing verb+data requirement**
- Setup: An existing saved state has a "do" requirement with `verb: "create"`, `data: "book"`, `dataTypeId: "abc123"`, `interactionTarget: "data"`.
- Action: App loads and runs migration.
- Expected outcome: Requirement now has `description: "create book"`, `dataTypeIds: ["abc123"]`. Fields `verb`, `data`, `dataTypeId`, and `interactionTarget` are removed.

**Scenario 16: Migration — existing element requirement with usesDataTypeId**
- Setup: An existing "do" requirement has `verb: "set"`, `elementId: "el1"`, `usesDataTypeId: "dt1"`, `interactionTarget: "element"`.
- Action: App loads and runs migration.
- Expected outcome: Requirement has `description: "set"`, `elementId: "el1"`, `dataTypeIds: ["dt1"]`. Fields `verb`, `interactionTarget`, and `usesDataTypeId` are removed.

## Scope

**In scope:**
- Description textarea replacing verb input for "do" requirements
- Pick-then-type item selection (`[+ Data Type]` / `[+ Widget]` buttons + comboboxes + chips)
- Multiple data types per requirement, max one widget
- Data model changes: `description`, `dataTypeIds` array, removal of `verb`, `data`, `interactionTarget`, `usesDataTypeId`, `dataTypeId`
- Migration of existing saved states
- Updated display text, sidebar text, and placeholder generator summary
- BlocksPanel derivation of target from `elementId` presence (replacing `interactionTarget` check)
- Validation: description + at least one item

**Out of scope:**
- Changes to "know" or "navigate" requirement forms
- Changes to block creation behavior beyond the derivation fix
- Changes to the generator beyond placeholder summary text
- Reordering chips / data types within a requirement
- Visual styling of chips beyond basic functionality (can refine later)
- Any changes to how NonDataElements or RecordTypes are managed elsewhere

## Files Likely Affected

### Modified Files
- `src/types/wizard.ts` — Update `Requirement` interface (add `description`, `dataTypeIds`; remove `verb`, `data`, `dataTypeId`, `interactionTarget`, `usesDataTypeId`)
- `src/app/state/WizardState.ts` — Add migration logic for existing saved states
- `src/app/views/panels/RequirementsPanel.ts` — Replace `renderDoDataFields` + `renderDoElementFields` with `renderDoFields`; replace `renderDoTargetDropdown` with empty return; add chip rendering, pick-then-type button wiring, combobox-in-area logic; update `buildRequirementFromForm`, `getDisplayText`, `getSidebarText`, validation
- `src/app/views/panels/BlocksPanel.ts` — Replace `req.interactionTarget === 'element'` checks with `req.elementId` checks
- `src/generator/components/Placeholder.ts` — Update summary to use `description` instead of `verb + data`
- `tests/views/RequirementsPanel.test.ts` — Update tests for new form structure, chip behavior, validation
- `styles/workspace/combobox.css` or equivalent — Add `.item-chip`, `.item-chip-remove`, `.item-chip-type` styles

### New Files
- None expected

## Resolved Ambiguities

1. **Chip ordering** — Chips display in insertion order. No grouping by type.

2. **Duplicate data type prevention** — A data type already attached as a chip is excluded from the combobox dropdown. Users cannot add the same data type twice to one requirement.

3. **Description always required** — Both description and at least one item are required for save. No exceptions.

## Integration Boundaries

### RequirementsPanel &rarr; WizardState (data types)
- **Data flowing out:** On save, RequirementsPanel resolves or creates RecordTypes for each data type chip and writes the `dataTypeIds` array.
- **Expected contract:** Same `resolveOrCreateDataType` behavior. Multiple calls per save (one per data type chip).

### RequirementsPanel &rarr; WizardState (widgets)
- **Data flowing out:** On save, RequirementsPanel resolves or creates a NonDataElement for the widget chip (if any) and writes `elementId`.
- **Expected contract:** Same `resolveOrCreateElement` behavior. At most one call per save.

### BlocksPanel (consumer)
- **Data flowing in:** Reads `req.elementId` to determine block creation behavior (auto-name vs dropdown). Previously read `req.interactionTarget`.
- **Migration note:** No separate migration needed — the field check changes from `interactionTarget === 'element'` to `!!req.elementId`.

### Placeholder generator (consumer)
- **Data flowing in:** Reads `req.description` for summary text. Previously read `req.verb` + data type name.

### Backward Compatibility
- Migration runs on state load, converting old fields to new fields.
- The `Requirement` interface removes the old fields — TypeScript compilation will surface any missed references.

## How to Verify

1. Open the requirements form, select "Data Interaction" — confirm no target dropdown appears in header-right, form shows description textarea + item buttons
2. Type a description, add a data type via `[+ Data Type]` — confirm chip appears, save enables
3. Add a second data type — confirm both chips visible
4. Add a widget via `[+ Widget]` — confirm chip appears, `[+ Widget]` disables
5. Remove the widget chip — confirm `[+ Widget]` re-enables
6. Save — confirm requirement displays description as item-name and linked items as item-meta
7. Edit the requirement — confirm description and chips pre-populate correctly
8. Remove a data type chip and save — confirm the RecordType persists as orphan
9. In Blocks panel, confirm "+ Block" on a widget requirement auto-names, and on a data-only requirement shows the dropdown
10. Load an app with old-format requirements — confirm migration produces correct `description` and `dataTypeIds`
11. `npm run build` compiles without errors
12. `npx vitest run` passes
