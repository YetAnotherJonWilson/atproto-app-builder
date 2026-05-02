# Spec: Components panel — "+ New Component" creation flow rework

**Status:** done (2026-05-01)
**Date:** 2026-05-01

## What
Rework the entry point and form behavior of "+ New Component" in the Components panel so users can: (a) deliberately choose between creating a text/info component and combining existing requirements into a multi-requirement component, (b) attach multiple `know` requirements to a single text component, and (c) reach the chip-selector path for unassigned requirements of any type. Currently "+ New Component" hardcodes content-editor mode and auto-fabricates a fresh `know` requirement, which makes the button effectively useless when the user has unassigned `do` or `navigate` requirements they want to fulfill, and prevents combining multiple `know` requirements into one text component.

## Why

Three concrete pain points discovered while using the Components panel:

1. **"+ New Component" only ever opens the content editor.** `openNewForm()` at `ComponentsPanel.ts:733` hardcodes `isContentEditorMode = true`. The chip selector — which supports requirements of any type — is only reachable by editing an *existing* non-text component. This makes the button feel broken when the user has unassigned `do`/`navigate` requirements they want to combine.
2. **No way to attach multiple `know` requirements to a text component.** A text component's `requirementIds` array can hold multiple ids in the data model, but the content-editor form has no UI to pick or edit linked know requirements; it auto-creates a single fresh `know` req on save when none is linked.
3. **Forced auto-creation of a `know` requirement.** When the user creates a text component without first linking a requirement, `saveComponent()` at `ComponentsPanel.ts:1040` silently creates a new `know` requirement with the component's name as the text. This is invisible to the user and pollutes the requirements list.

## Acceptance Criteria

- [ ] **"+ New Component" opens a mode-picker step instead of jumping into content editor.**
  - When the user clicks "+ New Component", the inline form renders a chooser with two side-by-side cards: "Text / info content" and "Combine requirements".
  - Each card has a heading (the option name) and a one-line description: "Text / info content" → "Headings, paragraphs, info boxes — fulfills know requirements"; "Combine requirements" → "Pick existing requirements (any type) and bundle them as one component".
  - Visual treatment: same weight as `.next-step-card` (border, padding, hover affordance), sized smaller so two fit side-by-side comfortably inside the inline form. On narrow viewports the cards stack vertically.
  - The chooser also has a "Cancel" button (matching the existing form-cancel styling) that closes the form and re-shows "+ New Component".
  - When the user selects a card, the form transitions to the corresponding sub-form (content editor or chip selector). The "+ New Component" button stays hidden until the form is closed.
  - Clicking outside the cards does not transition; only the cards and Cancel are interactive.

- [ ] **Content editor supports linking 0..N `know` requirements via a chip selector.**
  - The content-editor form includes a new section labeled "Linked know requirements" placed above the existing "Content" section.
  - The section renders chips for currently-linked know requirements (using each requirement's short text via `getRequirementShortText`). Each chip has a × button to remove it.
  - Below the chips is an "Available know requirements" list of all `know` requirements not currently linked to *any* component (i.e., the unassigned set, filtered to `type === 'know'`). Clicking an item adds it as a chip.
  - When zero know requirements are linked, the chip area shows a placeholder like "Optional — link existing know requirements this component fulfills".
  - On save, the component's `requirementIds` is set to the chip selection (preserving order). No auto-fabrication of a fresh requirement happens.
  - When the user has not linked any requirement AND has not entered any content nodes AND has not entered a name, the Save button is disabled. If at least a name is entered, Save is enabled and produces a component with empty `requirementIds` and empty `contentNodes`.
  - When editing an existing text component, the chip selector is pre-populated with that component's currently linked know requirements (filtered to ones still extant in state).

- [ ] **Chip selector mode is reachable from "+ New Component".**
  - After picking "Combine requirements" in the mode picker, the form renders the existing chip-selector form (`renderChipSelectorForm`) with empty initial selection.
  - The chip selector continues to list all requirements of all types (matching today's behavior).
  - Save creates a component with `componentType` undefined (the existing default for non-text composite components) and `requirementIds` set to the chip selection. No `contentNodes` are added.

- [ ] **No silent auto-creation of `know` requirements anywhere in the flow.**
  - `saveComponent()` no longer creates a fresh `know` requirement when saving a text component without linked requirements. Instead it saves the component with `requirementIds: []`.
  - The "Fulfills" badge logic at `ComponentsPanel.ts:223` continues to work — when the linked-know list is empty, the badge is omitted (it already filters by `r.type === 'know'`, so an empty list naturally produces an empty badge string).

- [ ] **Quick-create from unassigned requirements is unchanged.**
  - The per-requirement "+ Component" button in the unassigned section keeps its current behavior: it creates a single-requirement component directly, bypassing the mode picker. This is the fast path and must not regress.

## Scope

**In scope:**
- New mode-picker step rendered inside the inline form when "+ New Component" is clicked.
- Add a "Linked know requirements" chip section to the content-editor form (`renderContentEditorForm`).
- Wire chip add/remove inside the content editor to update component state on save.
- Make `openNewForm()` no longer hardcode `isContentEditorMode`; introduce a "no mode chosen yet" intermediate state.
- Remove the auto-fabricate-a-know-requirement branch from `saveComponent()` in content-editor mode.

**Out of scope:**
- Inlay component library / browser (separate spec: `inlay-component-library.md`).
- Changes to the per-requirement quick-create dropdown options or labels.
- Changes to how unassigned requirements are listed (the "+ Component" path) except as already noted.
- Reordering or restyling existing component cards.
- Multi-requirement `do`/`navigate` flows beyond what the chip selector already supports.
- Allowing a know requirement to be linked to multiple components simultaneously (current model: each requirement belongs to at most one component, enforced by the unassigned filter).

## Files Likely Affected
- `src/app/views/panels/ComponentsPanel.ts` — main changes:
  - New `renderModePicker()` function and a new module-level state flag (e.g. `formMode: 'mode-picker' | 'content' | 'chip' | null`).
  - `openNewForm()` sets `formMode = 'mode-picker'` instead of `isContentEditorMode = true`.
  - `renderInlineForm()` switches on `formMode`.
  - `renderContentEditorForm()` gets a new "Linked know requirements" section; module state needs a `linkedKnowReqIds: string[]` array tracked separately from `selectedReqIds` so that content-editor and chip-selector flows don't share state accidentally.
  - `wireContentEditorForm()` wires the new chip add/remove handlers.
  - `saveComponent()` content-editor branch uses `linkedKnowReqIds` and skips the auto-fabricate path.
- `styles/workspace/components-panel.css` or `styles/workspace/inline-form.css` — add styles for mode-picker cards. (Keep it consistent with existing inline-form patterns.)
- `tests/` — add Vitest coverage for the save-component logic changes (no auto-fabrication; multi-know linking).

## Behavioral Scenarios

**Scenario: Create a multi-requirement composite from "+ New Component"**
- Setup: User has 3 unassigned requirements: 1 know ("App description"), 1 do ("Submit feedback form"), 1 navigate ("Home → Feedback").
- Action: User clicks "+ New Component" → picks "Combine requirements" → enters name "Feedback widget" → clicks the do and navigate items in the available list → clicks Save.
- Expected outcome: A new component "Feedback widget" appears with `requirementIds` containing the do and navigate ids in click order. The know req remains unassigned. The card renders the existing requirement-list footer (since it has no `contentNodes`).

**Scenario: Create a text component fulfilling two existing know requirements**
- Setup: User has 2 unassigned know requirements: "Headline copy" and "Subheadline copy".
- Action: User clicks "+ New Component" → picks "Text / info content" → enters name "Hero text" → in the new "Linked know requirements" section, clicks both requirements (now chips) → adds a Heading content node "Welcome" and a Paragraph "Lorem ipsum" → clicks Save.
- Expected outcome: New text component "Hero text" with `requirementIds: [headline, subhead]` (in click order), `contentNodes: [heading, paragraph]`. Both know requirements move out of the unassigned section. The card shows the Fulfills badge with both requirement texts.

**Scenario: Create a text component with no linked requirements**
- Setup: No unassigned know requirements; user just wants standalone content.
- Action: User clicks "+ New Component" → "Text / info content" → enters name "Footer disclaimer" → adds a Paragraph node → Save.
- Expected outcome: Component saved with `requirementIds: []` and `contentNodes: [paragraph]`. No new know requirement is created. Card renders preview without Fulfills badge.

**Scenario: Cancel from mode picker**
- Setup: Components panel open.
- Action: User clicks "+ New Component" → clicks Cancel in the mode picker.
- Expected outcome: Form closes. "+ New Component" button reappears. No state changes.

**Scenario: Per-requirement quick-create still works**
- Setup: User has an unassigned know requirement "About copy".
- Action: User clicks "+ Component" on the requirement row → picks "Paragraph" from the dropdown.
- Expected outcome: A single-requirement text component is created directly, identical to today's behavior. Mode picker is not involved.

**Scenario: Edit existing text component to add a second linked know req**
- Setup: Existing text component "Greeting" with one linked know req "Welcome message"; one other unassigned know req exists, "Tagline".
- Action: User clicks edit pencil → "Linked know requirements" section shows one chip → user clicks "Tagline" in available list → Save.
- Expected outcome: Component now has both requirementIds linked. Both reqs disappear from the unassigned section. Fulfills badge updates to list both.

**Scenario: Save disabled until name entered**
- Setup: Mode picker selected → content editor open.
- Action: User adds a Paragraph content node but leaves name blank.
- Expected outcome: Save button stays disabled. Once user types a name, Save enables.

## How to Verify

1. Manual: walk through each behavioral scenario in the running app (`npm run dev`).
2. Vitest:
   - `saveComponent` text branch with `linkedKnowReqIds: []` produces component with `requirementIds: []`, no new requirement appended.
   - `saveComponent` text branch with `linkedKnowReqIds: ['a','b']` writes those ids in order.
   - `saveComponent` chip-selector branch unchanged.
3. Playwright smoke (`e2e/smoke.spec.ts`): if it touches the components panel, ensure it still passes; otherwise a single new e2e step exercising "+ New Component → Combine requirements → save with multi-req" would be valuable but not required.
4. `npm run verify` must pass (build + vitest + playwright).
