# Step 2: Define Requirements

## System Overview

Step 2 of the ATProto App Builder wizard replaces the deprecated "Define Record Types" step with a requirements-first approach. It allows users — indie ATProto developers and newcomers learning through building — to define what their app's requirements using three categories: information (what do users of the app need to know), data interaction design (what do users need to do with their data), and navigation between views. The output is a persisted list of structured requirements that subsequent wizard steps will use to derive components, data models, and views.

## Behavioral Contract

### Primary Flows

- When the user navigates to Step 2, the system displays a view titled "Define Requirements" with a description of the step, an "Add Requirement" button, and a list of any previously saved requirements.

- When the user clicks "Add Requirement", the system displays three buttons: "I need to know something", "I need to do something (view data, interact with it, etc.)", and "I need to navigate to another view".

- When the user clicks "I need to know something", the system displays a form containing: a large text area with the label "I need to know..." and placeholder text "how this app works, what my options are, etc.", and "Save" and "Cancel" buttons.

- When the user clicks "I need to do something (view data, interact with it, etc.)", the system displays a form containing: the text "I need to", a text input labelled "verb" with placeholder "search, list, create, update, etc.", a text input labelled "data" with placeholder "a list of books, an appointment, a friend", and "Save" and "Cancel" buttons.

- When the user clicks "I need to navigate to another view", the system displays a form containing: the text "I need to go from", a dropdown menu listing existing views (or a single disabled option reading "Create some pages or components first" if no views exist), the text "to", a second dropdown menu with the same options, and "Save" and "Cancel" buttons.

- When the user fills in required fields and clicks "Save", the system adds the requirement to the list, the form closes, and the new entry appears in the requirements list on the Step 2 view.

- When the user clicks "Cancel", the system closes the form without saving and returns to the Step 2 view.

- When a requirement is displayed in the list, it includes a human-readable summary of the requirement and buttons to edit and delete it.

- When the user clicks "Edit" on a requirement, the system reopens the appropriate form for that requirement type with the previously saved values pre-filled in the input fields.

- When the user edits a requirement and clicks "Save", the system updates the existing requirement in place (same position in the list) rather than creating a new one.

- When the user clicks "Delete" on a requirement, the system removes the requirement from both the displayed list and the persisted state.

- When requirements exist in the list, each requirement's display text reflects its type:
  - "Know" type: "I need to know [user's text]"
  - "Do" type: "I need to [verb] [data]"
  - "Navigate" type: "I need to go from [view A] to [view B]"

### Error Flows

- When the user attempts to save a "know" requirement with an empty or whitespace-only text area, the Save button is disabled and the requirement cannot be saved.

- When the user attempts to save a "do" requirement with either the verb or data field empty or whitespace-only, the Save button is disabled and the requirement cannot be saved.

- When the user attempts to save a "navigate" requirement without selecting both a "from" and "to" view from the dropdowns, the Save button is disabled and the requirement cannot be saved.

### Boundary Conditions

- When the user has saved 100 requirements, the "Add Requirement" button is disabled or hidden, and the user cannot add more requirements.

- When the user navigates away from Step 2 (forward or backward in the wizard) and returns, all previously saved requirements are present and displayed in their original order.

- When no views exist for the navigation dropdowns, both dropdowns display only a disabled option reading "Create some pages or components first", making the Save button impossible to activate for navigation requirements.

- When the user closes the browser and reopens the wizard, requirements are restored from localStorage as part of the wizard state resume flow.

## Explicit Non-Behaviors

- The system must not use AI or natural language processing to interpret, suggest, validate, or transform user input, because the wizard is designed as a structured, manual requirements-gathering tool.

- The system must not generate components, data models, lexicons, or any downstream artifacts from the requirements in this step, because component generation belongs to subsequent wizard steps.

- The system must not persist requirements to a PDS or any remote service, because PDS persistence is out of scope for this phase; localStorage is the only storage mechanism.

- The system must not populate the navigation dropdowns with real view data, because the views that fill those dropdowns are defined in later wizard steps that do not yet exist. For now, the dropdowns should always show the disabled placeholder option.

- The system must not allow reordering of requirements in the list, because reordering is not part of the current design.

## Integration Boundaries

### localStorage (WizardState)

- **Data flowing in:** On Step 2 load, the system reads the existing `WizardState` from localStorage (key: `atproto-wizard-state`) to retrieve any previously saved requirements.
- **Data flowing out:** On every add, edit, or delete operation, the system writes the updated requirements array back to `WizardState` in localStorage, following the same auto-save pattern used by existing wizard steps.
- **Expected contract:** Requirements are stored as a new field on the `WizardState` object (e.g., `requirements`). Each requirement is an object containing at minimum: a unique ID, a type identifier (`know`, `do`, or `navigate`), and the type-specific data fields.
- **Unavailability:** localStorage is a synchronous browser API and will not be unavailable during normal operation. If localStorage is full, the browser will throw a `QuotaExceededError`; the system should not crash but no special handling is required beyond not losing the in-memory state.
- **Development:** Use the real browser localStorage; no simulated twin needed.

### Wizard Navigation (StepNavigation / HistoryManager)

- **Data flowing in:** Step 2 receives the current step index from the wizard navigation system.
- **Data flowing out:** Step 2 does not output data to the navigation system; it simply renders when the step index matches.
- **Expected contract:** Step 2 follows the same rendering contract as existing steps (see `StepRenderer.ts`), registering itself as the renderer for its step index.
- **Unavailability:** N/A — this is internal to the application.
- **Development:** Use the existing navigation infrastructure.

## Behavioral Scenarios

### Happy Path Scenarios

**Scenario 1: Add a "do" requirement**

- Setup: User is on Step 2 with an empty requirements list.
- Action: User clicks "Add Requirement". User clicks "I need to do something (view data, interact with it, etc.)". User types "create" in the verb field and "a bookmark" in the data field. User clicks "Save".
- Expected outcome: The form closes. The requirements list now shows one entry with text matching "I need to create a bookmark". The entry has edit and delete controls.

**Scenario 2: Add a "know" requirement**

- Setup: User is on Step 2 (may have existing requirements or not).
- Action: User clicks "Add Requirement". User clicks "I need to know something". User types "how to get started adding bookmarks" in the text area. User clicks "Save".
- Expected outcome: The form closes. The requirements list includes an entry with text matching "I need to know how to get started adding bookmarks".

**Scenario 3: Add all three requirement types, then navigate away and back**

- Setup: User is on Step 2 with an empty requirements list.
- Action: User adds a "know" requirement with text "what my saved bookmarks are". User adds a "do" requirement with verb "search" and data "my bookmarks". User adds a "navigate" requirement (if views exist) or cancels the navigate form (if no views exist). User clicks "Next" to go to Step 3, then clicks "Back" to return to Step 2.
- Expected outcome: All previously saved requirements are displayed in the order they were added, with correct type-specific display text. No entries are missing or duplicated.

### Error Scenarios

**Scenario 4: Attempt to save with empty fields**

- Setup: User is on Step 2 and clicks "Add Requirement", then clicks "I need to do something (view data, interact with it, etc.)".
- Action: User leaves both the verb and data fields empty. User observes the Save button.
- Expected outcome: The Save button is disabled and cannot be clicked. User types "create" in the verb field but leaves data empty. Save button remains disabled. User types "a bookmark" in the data field. Save button becomes enabled.

**Scenario 5: Navigate requirement with no existing views**

- Setup: User is on Step 2 and no views have been defined in the wizard.
- Action: User clicks "Add Requirement", then clicks "I need to navigate to another view".
- Expected outcome: Both dropdown menus show only a single disabled option reading "Create some pages or components first". The Save button is disabled. The user can only click "Cancel" to exit the form.

### Edge Case Scenarios

**Scenario 6: Edit a requirement preserves its position and type**

- Setup: User has three requirements saved: a "know" requirement, a "do" requirement with verb "create" and data "a bookmark", and another "know" requirement. They appear in this order.
- Action: User clicks "Edit" on the second requirement (the "do" requirement). The form reopens showing "I need to do something" with "create" pre-filled in the verb field and "a bookmark" pre-filled in the data field. User changes the verb to "save" and clicks "Save".
- Expected outcome: The requirements list still has three entries in the same order. The second entry now reads "I need to save a bookmark". No duplicate entries were created. The first and third entries are unchanged.

**Scenario 7: Delete removes from both view and persisted state**

- Setup: User has two requirements saved.
- Action: User clicks "Delete" on the first requirement. User navigates away from Step 2 and returns.
- Expected outcome: Only one requirement remains in the list — the one that was not deleted. The deleted requirement does not reappear after navigation.

## Ambiguity Warnings

1. **Where does Step 2 sit in the new step numbering?**
   The current wizard has steps 0-7. Step 0 is a landing page, Step 1 is "Getting Started" (staying as-is). The deprecated steps start at index 2. Does "Step 2: Define Requirements" take the exact same index (step 2) in the wizard, replacing the deprecated step at that position? Or is the step indexing being reworked?
   - _Likely agent assumption:_ Replace the deprecated Step 2 at the same index.
   - _Please confirm or clarify._

2. **WizardState schema for requirements.**
   The existing `WizardState` interface has fields like `recordTypes`, `queryMethods`, `procedureMethods`. The new requirements need a new field. Should the agent add a `requirements` array to `WizardState` and remove or leave the deprecated fields (`recordTypes`, `queryMethods`, `procedureMethods`, `appConfig`)?
   - _Likely agent assumption:_ Add `requirements` field, leave deprecated fields in place to avoid breaking other code.
   - _Please confirm or clarify._

3. **Requirement ID generation.**
   Each requirement needs a unique ID for edit/delete operations. Should IDs be generated using the existing `generateId()` utility in `src/utils/`, or is there a preferred approach?
   - _Likely agent assumption:_ Use the existing `generateId()` utility.
   - _Please confirm or clarify._

4. **Edit form: pre-filled as values or placeholders?**
   You said "previous entries displayed as placeholders in the appropriate areas." Did you mean the values should populate the input fields as _values_ (editable content in the field), or literally as _placeholder attributes_ (gray hint text that disappears on focus)? Using placeholder attributes would mean the fields appear "empty" and the user would have to retype everything.
   - _Likely agent assumption:_ Pre-fill as actual input values, not placeholder attributes.
   - _Please confirm or clarify._

5. **Delete confirmation.**
   Should deleting a requirement require a confirmation dialog ("Are you sure?"), or should it delete immediately on click?
   - _Likely agent assumption:_ Delete immediately without confirmation.
   - _Please confirm or clarify._

6. **Visual design of the requirements list.**
   The spec describes what text each entry shows, but not its visual structure. Should entries match the visual pattern of the existing deprecated steps (e.g., the record types list with card-like entries), or is a simpler list acceptable?
   - _Likely agent assumption:_ Match the existing visual patterns in the wizard.
   - _Please confirm or clarify._

7. **Should the deprecated step files be removed or modified as part of this work?**
   The deprecated `deprecatedStep2RecordTypes.ts` currently occupies the Step 2 rendering slot. Should the agent remove/replace it, or leave it alongside the new step?
   - _Likely agent assumption:_ Replace it in the step renderer but leave the file in the codebase for reference.
   - _Please confirm or clarify._

## Implementation Constraints

- **Language/framework:** TypeScript, vanilla DOM manipulation — consistent with the existing codebase. No UI frameworks.
- **Build system:** Vite (existing).
- **Testing:** Vitest (existing). Unit tests should be added for the requirements state management logic (add, edit, delete, validation).
- **File location:** New step code should follow the existing pattern in `src/app/views/` and `src/app/operations/`.
- **State management:** Follow the existing `WizardState` pattern with localStorage auto-save via `saveWizardState()`.
- **Existing code reuse:** Logic from deprecated step files (particularly dialog/form patterns and list rendering) may be referenced or adapted, but the new step should be its own clean implementation.

---

_Spec version: 1.0 — Scoped to Step 2: Define Requirements only._
