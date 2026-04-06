# Spec: Simplify Know Requirements

**Status:** ready
**Date:** 2026-04-04

## What

Simplify "know" (Information) requirements to be informal intent descriptions
rather than structured content that flows directly into block rendering. Remove
the "Content" and "Display Style" fields from the know requirement form, leaving
just the "Description" field. The display style choice remains in the Blocks
panel where it belongs — it's a UI/block-level concern, not a requirement-level
one.

## Why

Currently, users choose a display style (Paragraph, Heading, Section, etc.) in
two places: when creating a know requirement (RequirementsPanel) and again when
creating a block from that requirement (BlocksPanel quick-create dropdown). This
is confusing and the two can conflict silently.

More fundamentally, a know requirement represents an intent — "the user needs to
know X" — not a specific UI element. A single intent like "the user needs to
understand how the app works" might need a heading, a paragraph, an image, and a
caption to fulfill. Forcing users to decompose that into separate requirements
per UI element is unnatural.

By making know requirements informal, we:
- Eliminate the duplicate display-style choice
- Let requirements be natural expressions of intent
- Keep the Blocks panel as the single place where UI decisions are made
- Lay groundwork for a future block content editor where users compose rich
  content from primitives

## Acceptance Criteria

- [ ] **Know requirement form has only a Description field** — When creating or
  editing a know requirement, the form shows a single "Description" textarea.
  - The "Content" textarea (`#req-know-content`) is removed from the form.
  - The "Display Style" dropdown (`#req-know-variant`) is removed from the form.
  - The Description textarea keeps its current placeholder: "e.g. I need to know
    how this app works".
  - Saving a know requirement stores the description in the `text` field, as
    before. The `content` and `textVariant` fields are not set by the form.

- [ ] **Existing data is preserved** — Requirements that already have `content`
  or `textVariant` values retain them.
  - The `content` and `textVariant` fields remain on the `Requirement` type — no
    type changes.
  - Block rendering logic that reads `textVariant` and `content` continues to
    work for requirements that have those values set.
  - No migration is needed — fields are simply no longer written by the
    requirement form.

- [ ] **BlocksPanel quick-create is unchanged** — The quick-create dropdown in
  the Blocks panel (Paragraph, Section, Heading, Info Box, Banner) continues to
  work as before.
  - Clicking a quick-create option still sets `textVariant` on the requirement
    and creates a text block.
  - This is the single place where display style is chosen going forward.

- [ ] **Requirement display text remains useful** — The requirement card in the
  list and sidebar still shows the description text.
  - `getDisplayText()` for know requirements returns `req.text` (no change
    needed — it already does this).
  - `getSidebarText()` for know requirements returns `Know: {truncated text}`
    (no change needed).
  - `getTypeLabel()` for know requirements still returns `"Information"`.

## Scope

**In scope:**
- Remove "Content" and "Display Style" fields from the know requirement form in
  RequirementsPanel
- Remove the `content` field collection from `collectKnowFields()` (or
  equivalent save logic)
- Remove the `textVariant` field collection from `collectKnowFields()`

**Out of scope:**
- Changes to the `Requirement` type definition (fields stay for backward compat)
- Changes to BlocksPanel quick-create behavior
- Changes to Inlay host runtime, text-variants, or compile logic
- Block content editor (separate spec)
- Removing `content`/`textVariant` from the type entirely (can be done later if
  they move to blocks)

## Files Likely Affected

- `src/app/views/panels/RequirementsPanel.ts` — Remove Content textarea and
  Display Style dropdown from `renderTypeFields()` for `type === 'know'`. Remove
  corresponding field collection in the save/collect logic.

## Behavioral Scenarios

**Scenario: Create a new know requirement**
- Setup: User is on the Requirements panel with the form open, type set to
  "Information".
- Action: User sees only a "Description" textarea. Types "Users need to
  understand the pricing tiers" and clicks "Add Requirement".
- Expected outcome: Requirement is created with `text: "Users need to understand
  the pricing tiers"`, `type: "know"`. No `content` or `textVariant` is set on
  the requirement. The requirement appears in the list showing the description
  text.

**Scenario: Edit an existing know requirement that has content/textVariant**
- Setup: A know requirement exists with `text: "Welcome"`,
  `content: "Here's how to get started"`, `textVariant: "section"` (set via
  quick-create previously).
- Action: User clicks edit on this requirement.
- Expected outcome: The form shows only the Description field, pre-filled with
  "Welcome". The content and textVariant values are not shown in the form but
  remain on the requirement object. Saving the form updates only `text`.

**Scenario: Quick-create a block from a simplified know requirement**
- Setup: User has a know requirement with just `text: "App overview"` (no
  content, no textVariant).
- Action: User goes to Blocks panel, clicks "+ Block" next to the requirement,
  selects "Heading" from the dropdown.
- Expected outcome: The requirement's `textVariant` is set to `"heading"`. A
  text block is created. The block preview renders "App overview" as a heading
  via Inlay primitives.

**Scenario: Block preview for requirement with no textVariant**
- Setup: A know requirement with just `text: "Some info"` is assigned to a text
  block (e.g., via the "+ New Block" form rather than quick-create).
- Action: Block is displayed in workspace.
- Expected outcome: The text-variants module defaults to `"paragraph"` when
  `textVariant` is undefined (this is existing behavior — `textVariant ??
  'paragraph'` in BlocksPanel). The block renders "Some info" as a paragraph.

## How to Verify

1. Create a new know requirement — confirm only the Description field is shown.
2. Save it — confirm no `content` or `textVariant` in the stored state.
3. Quick-create a block from it — confirm the dropdown still works and sets
   `textVariant`.
4. Edit an existing know requirement — confirm only Description is shown.
5. Run `npm run build` — TypeScript compiles cleanly.
6. Run `npx vitest run` — all tests pass.
