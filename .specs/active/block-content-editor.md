# Spec: Block Content Editor

**Status:** ready
**Date:** 2026-04-04

## What

Replace the current block creation flow for information blocks with a content
editor that lets users compose rich content directly within a block. Instead of
blocks being thin wrappers around requirement references, information blocks own
their content — a sequence of typed content nodes (heading, paragraph, caption,
etc.) that users add, remove, and reorder.

Users can also create blocks from scratch in the Blocks panel without first
defining a requirement. When they do, a know requirement is auto-created from the
block's title, keeping the requirements list complete as a record of intent.

A state migration upgrades existing data: legacy know requirements with
`content`/`textVariant` fields are cleaned up, and existing text blocks gain
`contentNodes` seeded from those legacy fields. After migration there is one
rendering path — all text blocks render from `contentNodes`.

## Why

The current model requires users to create one know requirement per UI element
(one for a heading, one for a paragraph, one for an image caption). This is
unnatural — users think in terms of intent ("show the user an overview") not in
terms of individual UI primitives. And the requirement text is reused as the
actual rendered content, which conflates two things: what the user needs to
communicate (requirement) vs. how to present it (block).

A block content editor:
- Lets users compose content naturally — add a heading, then a paragraph, then
  an image, all within one block
- Decouples requirements (intent) from blocks (presentation)
- Supports iterative building — users can start in Blocks without fully defining
  requirements first
- Builds on the Inlay primitives already implemented for preview and generation

## Key Design Decisions

**Single rendering path.** There is no backward-compat fallback that reads
`textVariant` from requirements. All text blocks render from `contentNodes`.
The state migration ensures existing blocks are upgraded on load.

**Requirements are informal intent notes.** After the prerequisite spec
(simplify-know-requirements), know requirements have only a `text` field — a
description of what the user needs to communicate. The `content` and
`textVariant` fields are legacy and cleaned up by migration.

**Blocks own presentation.** The `contentNodes` array on a Block is the source
of truth for what gets rendered and generated. The `requirementIds` link becomes
a loose "this block fulfills this intent" pointer.

## Acceptance Criteria

- [ ] **State migration upgrades legacy data** — When state is loaded via
  `setWizardState`, legacy know requirements and text blocks are migrated.
  - For each "know" requirement that has a `content` field: combine `text` and
    `content` into `text` (e.g., `"Welcome — Here's how to get started"`), then
    delete `content`.
  - For each "know" requirement that has a `textVariant` field: delete
    `textVariant`.
  - For each text block (`blockType: 'text'`) that has no `contentNodes`: build
    `contentNodes` from its linked know requirements' **pre-migration** data.
    The migration must read `textVariant`/`text`/`content` from requirements
    before cleaning those fields up. The mapping follows the same logic as
    `text-variants.ts`:
    - `"paragraph"` → one node: `{ type: 'paragraph', text: req.text }`; if
      `content` exists, add a second `{ type: 'paragraph', text: req.content }`.
    - `"heading"` → `{ type: 'heading', text: req.text }`; if `content`, add
      `{ type: 'paragraph', text: req.content }`.
    - `"section"` → `{ type: 'heading', text: req.text }`; if `content`, add
      `{ type: 'paragraph', text: req.content }`.
    - `"infoBox"` → `{ type: 'infoBox', text: req.text }`; if `content`, add
      `{ type: 'paragraph', text: req.content }` inside the same infoBox or as
      a sibling (match current rendering behavior).
    - `"banner"` → `{ type: 'banner', text: req.text }`; if `content`, add
      `{ type: 'caption', text: req.content }`.
  - Non-know requirements in text blocks are ignored during migration (they
    don't contribute content nodes).
  - The migration is idempotent — running it on already-migrated state has no
    effect.

- [ ] **Blocks have a content model** — Information blocks (blockType `"text"`)
  store an ordered array of content nodes.
  - Supported node types: `heading`, `paragraph`, `caption`, `infoBox`,
    `banner`, `image` (image may be stubbed initially).
  - Each node has a `type` and a `text` field (string). Image nodes have a
    `src` and optional `alt` field instead of `text`.
  - The content array is stored on the Block as a `contentNodes` field.
  - The `ContentNode` type is a discriminated union on `type`.

- [ ] **Content editor UI in the Blocks panel** — When creating or editing an
  information block, users see a content editor instead of the current
  requirement-chip selector.
  - The editor shows the current list of content nodes, each rendered as an
    editable card with: a type indicator, a text input/textarea, and
    remove/reorder controls.
  - An "Add content" control lets the user append a new node, choosing its type
    from a dropdown or button group (Heading, Paragraph, Caption, Info Box,
    Banner).
  - Nodes can be reordered via up/down buttons (consistent with existing
    reorder patterns in the app).
  - Nodes can be deleted individually.
  - The block name field remains — it serves as the block's label in the grid,
    sidebar, and views panel.

- [ ] **Single rendering path from contentNodes** — Text block preview and
  generation both read from `contentNodes` exclusively.
  - The existing `renderInlayPreviews()` function is updated to build Inlay
    element trees from `contentNodes` instead of from requirement fields.
  - The requirement-based rendering path (reading `textVariant`/`text`/`content`
    from requirements) is removed.
  - Text blocks with empty `contentNodes` (or no `contentNodes`) render as the
    existing empty placeholder.
  - Each content node maps to Inlay primitives using the same mapping logic
    as the current text-variants module, but reading from block content nodes.

- [ ] **Live preview updates as content is edited** — The Inlay preview in the
  block card updates to reflect the content nodes.
  - Preview updates on each edit without requiring a save.

- [ ] **Create block from scratch** — Users can create a new block in the Blocks
  panel without an existing requirement.
  - The "+ New Block" button opens the content editor with an empty content list.
  - The user enters a block name and adds content nodes.
  - On save, if no know requirement is linked, a new know requirement is
    auto-created with `text` set to the block name and `type: "know"`. The
    block's `requirementIds` includes this auto-created requirement.
  - The auto-created requirement appears in the Requirements panel sidebar and
    list.

- [ ] **Quick-create still works** — The existing quick-create flow (clicking
  "+ Block" on an unassigned know requirement) continues to work.
  - Quick-create creates the block with a single content node matching the
    selected type (e.g., selecting "Heading" creates a heading node with the
    requirement's text as placeholder content).
  - Quick-create no longer sets `textVariant` on the requirement (requirements
    don't have that field going forward).
  - The requirement remains linked via `requirementIds`.

- [ ] **Generator uses content nodes** — The generator reads `contentNodes` from
  blocks to produce compiled HTML/CSS output.
  - No fallback to requirement-based rendering.
  - Uses the same Inlay compile pipeline already in place.

## Scope

**In scope:**
- `ContentNode` type and `contentNodes` field on Block
- State migration in `setWizardState`: seed contentNodes on existing text
  blocks, clean up `content`/`textVariant` on know requirements
- Content editor UI (add, edit, remove, reorder nodes)
- Live Inlay preview from content nodes (replacing requirement-based preview)
- Create-from-scratch flow with auto-requirement creation
- Generator support for content nodes (replacing requirement-based generation)
- Remove the old textVariant default migration (the `textVariant = 'paragraph'`
  loop in `setWizardState`)
- Update `text-variants.ts` or create a replacement module to accept content
  nodes

**Out of scope:**
- Image upload or blob handling (image node can be defined in the type but
  stubbed in the UI — placeholder or URL-only)
- Drag-and-drop reordering (use button-based reorder, consistent with app)
- Rich text editing within a node (plain text only for now)
- Template components or data-bound blocks (later Inlay phase)
- Changes to non-text block types (list, form, detail, etc.)
- Removing `content`/`textVariant` from the `Requirement` TypeScript type
  (they become unused legacy fields that may be cleaned up in a future spec)

## Files Likely Affected

- `src/types/wizard.ts` — Add `ContentNode` discriminated union type,
  add `contentNodes?: ContentNode[]` field on `Block`
- `src/app/state/WizardState.ts` — Migration logic in `setWizardState`:
  seed `contentNodes` on text blocks from legacy requirement data, merge
  `content` into `text` on know requirements, delete `textVariant`/`content`,
  remove old `textVariant` default migration
- `src/app/views/panels/BlocksPanel.ts` — Content editor UI, revised form
  rendering, preview from content nodes (replace `renderInlayPreviews`),
  create-from-scratch flow, update quick-create to write content nodes
  instead of `textVariant`
- `src/inlay/text-variants.ts` — Update or replace to accept content nodes
  instead of requirement fields
- `src/generator/views/ViewPage.ts` — Read `contentNodes` when rendering text
  blocks (remove requirement-based path)
- `src/generator/inlay/compile.ts` — May need a new entry point for compiling
  content node arrays
- `src/app/views/panels/RequirementsPanel.ts` — No changes expected

## Resolved Decisions

1. **Content node data model** — Discriminated union on `type` for type safety.
   Each node variant is a separate type in the union (e.g.,
   `{ type: 'heading', text: string } | { type: 'image', src: string, alt?: string }`).

2. **Image node scope** — Include the `image` variant in the `ContentNode` type
   definition now (`{ type: 'image', src: string, alt?: string }`), but don't
   add an image option to the editor UI. Rendering and migration can account for
   it; the editor will gain image support in a future spec.

3. **Linked requirement display** — Keep showing the linked requirement on the
   block card as a small badge or note (e.g., "Fulfills: App overview"). It no
   longer drives rendering but provides useful intent context.

4. **Migration ordering** — Two sequential loops in `setWizardState`:
   (a) iterate text blocks, read linked requirements' legacy fields, seed
   `contentNodes`; then (b) iterate know requirements, merge `content` into
   `text`, delete `content` and `textVariant`. Order matters — block seeding
   must read legacy fields before requirement cleanup removes them.

## Behavioral Scenarios

**Scenario: Build an information block from scratch**
- Setup: User is on the Blocks panel. No unassigned know requirements exist.
- Action: User clicks "+ New Block". Enters name "About This App". Clicks
  "Add content" and selects "Heading" — types "Welcome to TaskFlow". Clicks
  "Add content" again and selects "Paragraph" — types "TaskFlow helps you
  manage your daily tasks." Clicks "Save Block".
- Expected outcome: A block is created with two content nodes (heading +
  paragraph). A know requirement is auto-created with text "About This App".
  The block card shows the Inlay preview with the heading and paragraph. The
  requirements sidebar shows the new "About This App" requirement.

**Scenario: Quick-create then edit content**
- Setup: User has an unassigned know requirement "Pricing details".
- Action: User clicks "+ Block" and selects "Section". The block is created.
  User clicks the edit button on the new block card.
- Expected outcome: The content editor opens showing one heading node
  pre-populated with "Pricing details". User can add more nodes (e.g., a
  paragraph with the actual pricing text), reorder, or change the existing node.

**Scenario: Reorder content nodes**
- Setup: User is editing a block with three nodes: heading, paragraph, caption.
- Action: User clicks the down arrow on the heading node.
- Expected outcome: The heading moves to position 2 (paragraph, heading,
  caption). The preview updates immediately.

**Scenario: Delete a content node**
- Setup: User is editing a block with two nodes: heading and paragraph.
- Action: User clicks the remove button on the heading node.
- Expected outcome: The heading node is removed. Only the paragraph remains.
  The preview updates to show just the paragraph.

**Scenario: Migration upgrades legacy know requirements**
- Setup: State is loaded with a know requirement:
  `{ id: "r1", type: "know", text: "Welcome", content: "Here's how to get started", textVariant: "section" }`
  and a text block:
  `{ id: "b1", name: "Intro", requirementIds: ["r1"], blockType: "text" }`
- Action: `setWizardState` runs.
- Expected outcome:
  - The block gains `contentNodes`:
    `[{ type: "heading", text: "Welcome" }, { type: "paragraph", text: "Here's how to get started" }]`
  - The requirement becomes:
    `{ id: "r1", type: "know", text: "Welcome — Here's how to get started" }`
    (`content` and `textVariant` deleted)
  - The block renders from `contentNodes`, showing a heading and paragraph.

**Scenario: Migration with know requirement that has no content field**
- Setup: State is loaded with a know requirement:
  `{ id: "r2", type: "know", text: "App overview", textVariant: "paragraph" }`
  and a text block referencing it.
- Action: `setWizardState` runs.
- Expected outcome:
  - The block gains `contentNodes: [{ type: "paragraph", text: "App overview" }]`
  - The requirement becomes:
    `{ id: "r2", type: "know", text: "App overview" }` (`textVariant` deleted)

**Scenario: Migration is idempotent**
- Setup: State has already been migrated — blocks have `contentNodes`,
  requirements have no `content`/`textVariant`.
- Action: `setWizardState` runs again.
- Expected outcome: No changes. Blocks already have `contentNodes` so the
  seeding step is skipped. Requirements have no legacy fields so cleanup
  is a no-op.

**Scenario: Text block with no know requirements after migration**
- Setup: A text block exists with only "do" or "navigate" requirements (unusual
  but possible). It has no know requirements to seed content from.
- Action: `setWizardState` runs, then block is displayed.
- Expected outcome: The block gets an empty `contentNodes` array (no know
  requirements to seed from). It renders as the empty placeholder.

## How to Verify

1. Create a block from scratch with multiple content types — verify preview
   renders each node correctly.
2. Quick-create a block, then edit to add more content — verify the transition
   works.
3. Reorder and delete content nodes — verify preview updates live.
4. Generate an app with blocks that have content nodes — verify the output HTML
   uses Inlay primitives correctly.
5. Manually create a localStorage state with legacy know requirements
   (`content`/`textVariant` fields) and text blocks without `contentNodes` —
   reload and verify migration produces correct `contentNodes` and cleans up
   requirements.
6. Verify migration is idempotent — reload again, confirm no changes.
7. Run `npm run build` — TypeScript compiles cleanly.
8. Run `npx vitest run` — all tests pass.
