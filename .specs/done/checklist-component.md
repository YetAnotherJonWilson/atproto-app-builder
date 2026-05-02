---
name: Checklist component type
description: Wizard component type that generates a full add/check/remove checklist UI for a record type, with user-configurable label and checked fields
type: spec
---

# Spec: Checklist component type

**Status:** ready
**Date:** 2026-05-02

## What

Add a new `checklist` wizard `ComponentType` that generates a single self-contained UI widget for a record type containing a string field (the **label** the user sees) and a boolean field (the **checked** state the checkbox reads from and writes to). The widget supports adding new items, checking/unchecking items, and deleting items, all backed by the user's PDS via the already-generated `create<Name>` / `update<Name>` / `delete<Name>` / `get<Name>s` API functions.

The wizard side adds `'checklist'` to the `ComponentType` union, exposes "Checklist" as a quick-create option for `do` requirements bound to a data type, and provides a small inline configuration UI on the component card with two dropdowns: **Label field** and **Checked field**.

The generator side adds `src/generator/components/Checklist.ts` (mirroring `NavMenu` and `RecordList`) and a new branch in `ViewPage.ts` that imports and calls the generated checklist render function.

## Why

The wizard's existing data-bound components are split across roles: `form` creates records, `list` reads them, `detail` shows one. None of them update or delete records. A checklist is the canonical example of "single-record-type CRUD in one widget" and the centerpiece of the planned Grocery List demo. Without it, building even a trivial todo-style app requires the user to compose three separate components and the generator can't currently wire them together for in-place editing anyway.

The PDS write paths (`createRecord`, `putRecord` for updates, `deleteRecord`) are already generated for every record type, so this spec is purely about (a) introducing the wizard component type and (b) emitting a runtime widget that consumes those existing functions.

## Acceptance Criteria

- [ ] **`'checklist'` is a recognized `ComponentType` with persisted field-mapping config.**
  - `ComponentType` in `src/types/wizard.ts` includes `'checklist'`.
  - A new optional field `checklistConfig?: { labelField: string; checkedField: string }` is added to the `Component` interface. Both inner fields are field *names* (matching `Field.name`) on the bound record type.
  - `COMPONENT_TYPE_LABELS` in `src/generator/components/Placeholder.ts` includes `checklist: 'Checklist'`.

- [ ] **Components panel offers "Checklist" as a quick-create option for `do` requirements bound to a data type.**
  - In `ComponentsPanel.ts`, the `QUICK_NAMES['do-data']` array gains `{ label: 'Checklist', componentType: 'checklist' }`. It appears alongside Form, List, Card, Table, Detail View on the quick-create row of any `do` requirement that has at least one data type.
  - It does NOT appear for `do` requirements that use a widget element (`elementId`), or for `know` / `navigate` requirements.
  - Choosing it creates a `Component` with `componentType: 'checklist'`, `requirementIds: [<the do requirement>]`, and a `checklistConfig` populated by the **default-pick convention** below (so the component is immediately usable without configuration).

- [ ] **Default-pick convention for `checklistConfig`.**
  - When a checklist component is created (or when its config is unset), defaults are computed from the bound record type:
    - **labelField:** first non-system, required string field; otherwise the first non-system string field; otherwise unset.
    - **checkedField:** first boolean field; otherwise unset.
  - The same convention is reused if the user later changes the dropdown back to "(default)" — see config UI below.

- [ ] **Component card shows two inline dropdowns for label and checked fields.**
  - On any component card with `componentType === 'checklist'`, two `<select>` controls appear inside the card body (below the type label, above any existing card actions): "Label field" and "Checked field".
  - **Label field** dropdown options: every non-system string field on the bound record type, by `Field.name`. Plus a leading "(default)" option that resolves to the convention pick at generate time. Empty if the record type has no compatible fields.
  - **Checked field** dropdown options: every boolean field on the bound record type, by `Field.name`. Plus a leading "(default)" option. Empty if the record type has no compatible fields.
  - Each dropdown's selected value reflects `component.checklistConfig.labelField` / `.checkedField`. Selecting "(default)" stores the conventionally-picked field name (so the config is always concrete in state — no `undefined` after a user has interacted).
  - Changing a dropdown calls `saveWizardState()` immediately (no Save button needed; matches existing inline-edit patterns in the panel).
  - If the bound record type has zero string fields OR zero boolean fields, the card shows an inline warning instead of the dropdowns: "Checklist needs a string field and a boolean field on `<RecordType.displayName>`. Add them in the Data section."
  - If the user-selected field name no longer exists on the bound record type (e.g. the field was renamed in the Data section), the dropdown shows the stale value as a disabled "Missing: `<name>`" option preselected, with a one-line warning beneath: "This field no longer exists. Pick another." The user must change the selection before generation will succeed.

- [ ] **The generator emits a working checklist component file per assigned checklist component.**
  - For each `Component` with `componentType === 'checklist'` that is assigned to at least one view AND whose `checklistConfig` resolves to two valid field names on the bound record type, the generator writes `src/components/<PascalName>.ts` (filename derived via the same `componentFileNames` map used for menus).
  - The emitted file exports `render<PascalName>(container: HTMLElement): void` and is responsible for the full lifecycle: initial fetch, render list, wire input, wire checkbox, wire delete.
  - The view-page generator imports and calls this function the same way it currently calls menu component functions.

- [ ] **The generated checklist UI behaves as specified.**
  - On mount: calls `get<RecordTypePascal>s({ limit: 100 })` and renders the items. While the request is in flight, shows "Loading…". On error, shows "Failed to load: <message>" with a Retry button.
  - Renders an input + "Add" button at the top. Pressing Enter in the input or clicking "Add" with non-empty trimmed text calls `create<RecordTypePascal>({ <labelField>: trimmedText, <checkedField>: false, createdAt: new Date().toISOString() })` (only including `createdAt` if the record type defines it). On success, the new item is prepended to the list and the input cleared. On error, the input keeps its value and an inline "Failed to add: <message>" message appears below the input until the next keystroke.
  - Each list item renders as: a checkbox bound to the checked field's current value, the label text, and a delete button (`×`).
  - Toggling the checkbox immediately reflects the new state in the UI and calls `update<RecordTypePascal>(item.uri, { ...item, <checkedField>: newValue })`. On error, the checkbox reverts to its prior state and an inline "Failed to update" message appears next to the item for ~3 seconds.
  - Each item tracks an in-flight update generation counter. If the user clicks the checkbox again before a prior `update` resolves, the older response handler is a no-op (it sees a stale generation number and exits without touching the UI). This prevents a slow first response from clobbering a newer state.
  - Clicking delete immediately removes the item from the UI and calls `delete<RecordTypePascal>(item.uri)`. On error, the item is restored and an inline "Failed to delete" message appears next to it for ~3 seconds. No confirmation dialog (items are cheap to re-add).
  - Items are displayed in `createdAt`-descending order if the record type has a `createdAt` field; otherwise in the order returned by `listRecords`.
  - When the list is empty (after the initial fetch resolves with zero items, or after the user deletes the last remaining item), the body shows the literal text `No items yet. Add your first one above.` styled via `.checklist-empty`. The input row stays visible above the message.

- [ ] **The generator handles unresolvable configs gracefully.**
  - A config is **unresolvable** when: the bound record type has no string field, OR no boolean field, OR `checklistConfig.labelField` / `.checkedField` references a field name that no longer exists on the bound record type.
  - If unresolvable, the generator does NOT emit a `<PascalName>.ts` component file. Instead, the view page renders a placeholder for that component with one of these messages, picking the most specific that applies:
    - "Checklist needs a string field and a boolean field on `<RecordType.displayName>`."
    - "Checklist label field `<name>` no longer exists on `<RecordType.displayName>`."
    - "Checklist checked field `<name>` no longer exists on `<RecordType.displayName>`."
  - This reuses the existing placeholder branch in `ViewPage.ts`.

- [ ] **Styles are added for the checklist widget and the in-card config.**
  - New rules in `src/generator/templates/Styles.ts` for `.checklist-input-row`, `.checklist-add-btn`, `.checklist-list`, `.checklist-item`, `.checklist-item-checked`, `.checklist-delete-btn`, `.checklist-error`, `.checklist-empty`. Visual treatment matches the existing list/form styling.
  - A checked item's label is styled with strikethrough and reduced opacity.
  - In the wizard styles (`styles/workspace/components-panel.css` or equivalent), small additions for `.checklist-config`, `.checklist-config-row`, `.checklist-config-warning`, `.checklist-config-stale` to lay out the two dropdowns and warning lines inside the component card without making the card visually noisy.

- [ ] **Tests cover the generator paths and the config UI.**
  - `tests/generator/checklist.test.ts`:
    - Compatible record type with explicit `checklistConfig` → generated file contains `render<PascalName>`, calls `create<PascalName>`, `update<PascalName>`, `delete<PascalName>`, `get<PascalName>s`, and references the **configured** label and checked field names (not the convention pick when they differ).
    - Compatible record type with no `checklistConfig` → generator falls back to convention picks.
    - Record type missing boolean → generator returns `null` (or equivalent skip signal); view page emits placeholder branch with the expected message.
    - Record type missing string → same.
    - Stale config (`labelField` references a removed field) → generator returns null; view page emits the "label field no longer exists" placeholder.
    - First-string-field convention prefers required over optional.
  - `tests/views/ComponentsPanel.test.ts`:
    - Quick-create "Checklist" option appears under a do-data requirement and creates a component with `componentType: 'checklist'` and a default-populated `checklistConfig`.
    - Changing the Label field dropdown updates `component.checklistConfig.labelField` in wizard state.
    - Card with a stale field name renders the "Missing: …" disabled option and the warning line.

- [ ] **`npm run verify` passes.**
  - `npm run build`, `vitest run`, and `playwright test` (the smoke spec in `e2e/smoke.spec.ts`) all pass. No new e2e flow is required for the checklist itself in this spec.

## Scope

**In scope:**
- `'checklist'` added to `ComponentType` union.
- `checklistConfig?: { labelField: string; checkedField: string }` added to the `Component` interface, with a state migration that leaves it `undefined` for existing components (the generator's default-pick handles that case at generation time).
- `'Checklist'` quick-create option in `ComponentsPanel.ts` for do-data requirements, populating defaults from the convention.
- Inline two-dropdown config UI on checklist component cards (label field + checked field).
- Default-pick convention helper (label + checked field picker) — colocated in `Checklist.ts` and reused by the panel for default population.
- New generator: `src/generator/components/Checklist.ts`.
- Wiring in `src/generator/index.ts` to emit checklist component files (per assigned checklist component, same pattern as menu).
- New branch in `src/generator/views/ViewPage.ts` to import and call the generated checklist function (or fall through to the placeholder branch when the config is unresolvable).
- New `.checklist-*` styles in `src/generator/templates/Styles.ts` and the panel CSS.
- Generator unit tests + panel tests for the new quick-create option, dropdown wiring, and stale-field rendering.
- `Placeholder.ts` label.

**Out of scope:**
- Editing an item's label after creation.
- Reordering items by drag.
- Pagination / infinite scroll past the first 100 items.
- Checklist on a record type the user owns somewhere else (e.g. a shared list). Items are always written to the logged-in user's PDS.
- A live preview of the checklist inside the components panel card (placeholder + dropdowns are enough for v1).
- Inlay-template integration for the checklist (Inlay templates are read-only renderers today; out of scope here).
- Migrating existing `Component` records that might be in saved wizard state from before this spec (none can exist with `componentType: 'checklist'` yet, so no migration is needed).

## Files Likely Affected

- `src/types/wizard.ts` — add `'checklist'` to `ComponentType`; add `checklistConfig?: { labelField: string; checkedField: string }` to `Component`.
- `src/app/views/panels/ComponentsPanel.ts` — add quick-create option in `QUICK_NAMES['do-data']`; add inline dropdown config UI on checklist cards; populate `checklistConfig` defaults on quick-create.
- `src/generator/components/Placeholder.ts` — add `'Checklist'` to `COMPONENT_TYPE_LABELS`.
- `src/generator/components/Checklist.ts` — **new**: emits the per-component render function.
- `src/generator/index.ts` — emit `src/components/<PascalName>.ts` for each assigned checklist component (mirror the menu loop); compute file/function names alongside the menu loop so they share `componentFileNames`.
- `src/generator/views/ViewPage.ts` — new branch for `componentType === 'checklist'` that imports and calls the generated function (or falls through to the existing placeholder branch when the record type is incompatible).
- `src/generator/templates/Styles.ts` — add `.checklist-*` styles.
- `tests/generator/checklist.test.ts` — **new**.
- `tests/views/ComponentsPanel.test.ts` — extend with a checklist quick-create case.

## Integration Boundaries

### Generated `api.ts`
- **Data flowing in:** `get<RecordTypePascal>s({ limit })` returns `{ <camelName>s: Item[], cursor, total }` where each item has `uri`, `cid`, plus the record's own fields.
- **Data flowing out:** `create<RecordTypePascal>(value)`, `update<RecordTypePascal>(uri, value)`, `delete<RecordTypePascal>(uri)`.
- **Expected contract:** these signatures are already generated; the checklist consumes them as-is. If they change, this generator must be updated in lockstep.
- **Unavailability:** API errors surface as inline messages in the widget (per acceptance criteria above). No global error UI.

### Wizard state
- **Data flowing in:** the bound record type (resolved via the do requirement's `dataTypeIds[0]`, same lookup `findBoundRecordType` already does in `ViewPage.ts`); the component's `checklistConfig`.
- **Data flowing out:** the new `componentType` value and `checklistConfig` persisted on the `Component`.
- **Expected contract:** the bound record type has fields with `name`, `type`, `required`, `isSystem`. The default-pick helper and the dropdown UI both read those and nothing else.
- **Unavailability:** if no record type can be resolved, the existing inlay/menu branches already handle that case via placeholders. The checklist branch should mirror that fallback.

## Behavioral Scenarios

**Scenario: Add Checklist component to a do requirement**
- Setup: User has a `do` requirement "Manage my grocery items" with data type `groceryItem` (fields: `text` string required, `checked` boolean, `createdAt` datetime system).
- Action: In the Components panel, user clicks the requirement's quick-create row and chooses "Checklist".
- Expected outcome: A new Component appears with `componentType: 'checklist'`, `requirementIds: [<reqId>]`, and `checklistConfig: { labelField: 'text', checkedField: 'checked' }` (defaults populated from the convention). Card shows "Checklist" type label and two dropdowns preselected to those values.

**Scenario: User picks a different label field**
- Setup: Record type has `text` (string required) and `notes` (string optional) and `done` (boolean). Card defaults to `labelField: 'text'`.
- Action: User opens the "Label field" dropdown on the card and selects `notes`.
- Expected outcome: `component.checklistConfig.labelField` is updated to `'notes'` and persisted via `saveWizardState()`. No regenerate is triggered (generation is a separate step). Subsequent generation emits a checklist that binds `notes` as the label.

**Scenario: Generate app with a configured checklist component**
- Setup: One view "Home" containing the checklist component above with `checklistConfig: { labelField: 'notes', checkedField: 'done' }`.
- Action: User generates the app.
- Expected outcome: The output zip contains `src/components/<PascalName>.ts` exporting the checklist render function. The component reads/writes the `notes` and `done` fields (not `text`).

**Scenario: Add an item at runtime**
- Setup: Generated app open, user logged in, checklist visible with no items. Configured with `labelField: 'text'`, `checkedField: 'checked'`.
- Action: User types "Milk" in the input and presses Enter.
- Expected outcome: A `create<RecordTypePascal>` call posts a record with `text: "Milk"`, `checked: false`, `createdAt: <now>`. On success, "Milk" appears as the first list item, unchecked. Input clears.

**Scenario: Check an item**
- Setup: Checklist with item "Milk" unchecked.
- Action: User clicks the checkbox.
- Expected outcome: Checkbox immediately shows checked, label gets strikethrough. `update<RecordTypePascal>(uri, { ...item, checked: true })` runs in the background. On success, no further UI change. On error, checkbox reverts and a "Failed to update" message appears next to the item for 3 seconds.

**Scenario: Delete an item**
- Setup: Checklist with item "Milk".
- Action: User clicks the × button.
- Expected outcome: Item disappears immediately. `delete<RecordTypePascal>(uri)` runs. On error, item reappears with a "Failed to delete" message for 3 seconds.

**Scenario: Incompatible record type at generation time**
- Setup: User attaches a checklist to a do requirement whose record type has fields `name` (string) and `count` (integer) — no boolean. Card shows the inline warning instead of dropdowns.
- Action: User generates the app anyway.
- Expected outcome: No `<PascalName>.ts` component file emitted. View page renders a placeholder section with the message "Checklist needs a string field and a boolean field on `<RecordType.displayName>`." Generation does not error.

**Scenario: Stale field reference (field renamed after configuration)**
- Setup: Checklist component has `checklistConfig: { labelField: 'text', checkedField: 'done' }`. User goes back to the Data section and renames `text` → `title`. Returns to Components panel.
- Action: Card re-renders.
- Expected outcome: The "Label field" dropdown shows a disabled "Missing: text" option preselected, with the warning "This field no longer exists. Pick another." beneath it. Generating the app at this point emits the placeholder branch with "Checklist label field `text` no longer exists on `<RecordType.displayName>`."

**Scenario: Default-pick convention prefers required string over optional**
- Setup: User adds a checklist component via quick-create on a requirement bound to a record type with fields `notes` (string optional, declared first), `text` (string required), `done` (boolean).
- Action: Quick-create runs.
- Expected outcome: `checklistConfig.labelField` is `'text'` (required wins over field order), `checkedField` is `'done'`.

**Scenario: User signed out at runtime**
- Setup: Generated app loaded but session expired.
- Action: Checklist mounts.
- Expected outcome: `get<RecordTypePascal>s` throws `User not logged in. Please sign in first.` (the existing `ensureSession` error). The checklist shows "Failed to load: User not logged in. Please sign in first." with a Retry button. Add/toggle/delete actions during this state surface the same error inline.

## How to Verify

1. **Vitest:** the new generator tests in `tests/generator/checklist.test.ts` plus the panel test addition.
2. **Manual (`npm run dev`):**
   - Build a Grocery List app per the demo storyboard. Confirm the checklist quick-create option appears, both dropdowns populate, and changing the label-field dropdown persists.
   - Generate the zip, unzip, `npm install`, `npm run dev` in the generated app, log in via OAuth, exercise add/check/delete. Confirm records appear in the user's PDS via `pdsls.dev` or `bsky.app`.
3. **`npm run verify`** must pass.

## Implementation Notes

Captured during spec exploration so a fresh implementer doesn't have to rediscover them.

### Pre-existing pieces this spec depends on (verified)

- **Update + delete API methods are already generated.** `src/generator/atproto/Api.ts` emits `create<Pascal>`, `update<Pascal>(uri, data)`, `delete<Pascal>(uri)`, and `get<Pascal>s(options)` for every record type. No changes to `Api.ts` needed.
- **Multi-node text components work today.** `Component.contentNodes` is an array; the components panel has an editor with add/remove/reorder. The Grocery List demo's Header component (heading + paragraph) needs no new wizard work.
- **Single-view apps with no `navigate` requirements work today.** NavMenu generation is gated on `componentType === 'menu'`, not view count.

### Codebase patterns to mirror

- **Per-component file emission:** copy the menu-component loop in `src/generator/index.ts` (around line 153). It filters `assignedComponents` by `componentType === 'menu'`, then loops to write `src/components/<PascalName>.ts`. The checklist loop should run alongside it and reuse the same `componentFileNames` map (built once via `buildUniqueNames(assignedComponents, toPascalCase)`) so menu and checklist files share the dedup namespace.
- **View-page integration:** `src/generator/views/ViewPage.ts` walks each view's components and emits a per-component branch. The new checklist branch goes alongside the `// Real NavMenu component` branch around line 87. When the checklist's config is unresolvable, fall through to the existing placeholder branch by passing the appropriate fallback message into `generatePlaceholderHtml` — or, simpler, emit the placeholder section directly from a new `emitChecklistFailure` helper modeled on `emitInlayFailure` (line 249).
- **Bound-record-type lookup:** `findBoundRecordType(component, wizardState)` is currently a private helper in `ViewPage.ts` (line 265). It walks `component.requirementIds`, finds a `do` requirement with at least one `dataTypeIds` entry, and returns the matching `RecordType`. Either export it from `ViewPage.ts` or extract it to a shared module — the checklist generator needs the same lookup.
- **Field shape:** `Field` (defined in `src/types/wizard.ts`) has `name`, `type` (string union including `'string'`, `'boolean'`, `'datetime'`, etc.), `required`, `isSystem`. Field selection logic should filter by `type === 'string' && !isSystem` for label candidates and `type === 'boolean'` for checked candidates.
- **Quick-create wiring:** `QUICK_NAMES['do-data']` in `src/app/views/panels/ComponentsPanel.ts` (line 68) is the array to extend. The button click handler is in the same file; no new event wiring needed beyond adding the array entry and populating `checklistConfig` defaults at component-creation time.
- **Inline card edits persist via `saveWizardState()`** — same pattern as the existing card-edit affordances. No debounce needed for a `<select>` change.

### Things that don't exist yet

- No precedent for an inline `<select>`-based config UI on a component card. The closest analogues are the chip-based requirement selectors and the content-node editor — both inline, both call `saveWizardState()` on change. New CSS classes (`.checklist-config*`) are fine; reuse existing form-control styles where possible.
- No precedent for a "stale field reference" warning anywhere in the wizard. The behavior described in the spec (disabled "Missing: …" option + warning line) is novel; it's small, but worth handling carefully because the user can be in this state without realizing it.

## Future Considerations (non-binding)

- Editable labels (click to edit text in place).
- Drag-to-reorder (would require either `sortKey` field on the record type or a derived in-app order).
- Filter chips: "All / Active / Done".
- Bulk actions: "Clear completed".
- Inlay-template version of the checklist once Inlay supports interactive write-capable templates.
