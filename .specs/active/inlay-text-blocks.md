# Spec: Inlay Text Blocks (Option A — Static Primitives)

**Status:** draft
**Date:** 2026-04-04

## What

Replace placeholder rendering for text blocks with real visual output using
Inlay primitives. Build a minimal host runtime that maps Inlay primitive NSIDs
to DOM elements. Use this runtime in the app builder workspace for live preview,
and compile to final HTML/CSS at generation time (no Inlay dependency in
generated apps).

This is the first step toward Inlay integration. It covers only static/
informational content using primitives directly — no template components, no
data fetching, no `@inlay/render` dependency. See `docs/inlay-research.md` for
full context.

## Why

Text blocks currently render as placeholder boxes with dashed borders and
requirement summaries — both in the workspace preview and in generated apps.
Users should see what their text content actually looks like, and generated apps
should include real styled output, not scaffolding.

Using Inlay primitives (rather than ad-hoc HTML) establishes the foundation for
deeper Inlay integration: the same host runtime built here will be extended in
later phases to support template components, data-bound rendering, and community
components.

## Key Design Decisions

**Text variant lives on the requirement, not the block.** A block can contain
multiple "know" requirements, and each one should control its own rendering. For
example, a single text block might contain a heading requirement ("Welcome") and
a paragraph requirement ("Some details..."). The block wraps them in a Stack;
each requirement's `textVariant` determines how it renders.

**CSS: match inlay.at's styles as a baseline.** The `org.atsui.*` primitives
have no spec-defined styling — each host decides appearance. We will start by
matching inlay.at's visual style reasonably closely (typography scale, spacing,
general feel) since that's where users will discover components. This ensures
components found on inlay.at look familiar when used in our builder and generated
apps. We can diverge or add themes later.

**Compile-time rendering.** Generated apps receive final HTML/CSS. No Inlay
runtime ships in the output. The host runtime exists only in the app builder
(for live preview) and in the generator (for compilation).

## Acceptance Criteria

- [ ] **Text variant is stored on "know" requirements** — Each "know"
  requirement has a `textVariant` field that determines how it renders.
  - When a user quick-creates a text block from an unassigned "know" requirement,
    the selected label (Paragraph, Section, Heading, Info Box, Banner) sets the
    requirement's `textVariant` and creates a text block containing it.
  - When a user creates or edits a "know" requirement directly, they can select
    a `textVariant` from a dropdown.
  - Default `textVariant` for "know" requirements created without one is
    `"paragraph"`.
  - Valid values: `"paragraph"`, `"heading"`, `"section"`, `"infoBox"`,
    `"banner"`.

- [ ] **Host runtime renders primitives to DOM** — A module maps Inlay primitive
  NSIDs to styled DOM elements.
  - The runtime accepts an Inlay element tree (the inert data structure:
    `{ type: nsid, props }`) and returns a DOM element.
  - Supports at minimum: `org.atsui.Stack`, `org.atsui.Row`, `org.atsui.Title`,
    `org.atsui.Heading`, `org.atsui.Text`, `org.atsui.Caption`.
  - Each primitive renders as a custom HTML element matching inlay.at's
    convention (e.g., `org.atsui.Title` → `<org-atsui-title>`,
    `org.atsui.Stack` → `<org-atsui-stack>`), with ARIA roles for
    accessibility (e.g., Title gets `role="heading" aria-level="1"`,
    Text gets `role="paragraph"`). Props are set as HTML attributes.
    CSS targets the custom element names.
  - Unknown NSIDs render as a visible error element (not silently dropped).

- [ ] **Text variant maps to an Inlay element tree** — Each `textVariant` on a
  "know" requirement maps to a composition of Inlay primitives using that
  requirement's `text` and `content` fields.
  - `"paragraph"` → `org.atsui.Text` containing the requirement text. If the
    requirement has `content`, render it as a second `org.atsui.Text` below,
    wrapped in `org.atsui.Stack`.
  - `"heading"` → `org.atsui.Title` for the requirement text. If the requirement
    has `content`, render `org.atsui.Text` below it, wrapped in
    `org.atsui.Stack`.
  - `"section"` → `org.atsui.Heading` for the requirement text, with
    `org.atsui.Text` for content, wrapped in `org.atsui.Stack`.
  - `"infoBox"` → `org.atsui.Stack` with a callout visual treatment (subtle
    background + left accent border + padding), containing `org.atsui.Text`
    for text and content.
  - `"banner"` → `org.atsui.Stack` with prominent full-width styling (background
    + larger text), `org.atsui.Title` for text, `org.atsui.Caption` for content.

- [ ] **Workspace preview renders text blocks using the host runtime** — When
  the Blocks panel displays a text block, it renders the actual Inlay primitive
  output instead of the placeholder card.
  - The preview updates live when the user changes a requirement's `textVariant`.
  - Each "know" requirement in the block is rendered according to its own
    `textVariant`.
  - Multiple "know" requirements in the same block are rendered in sequence
    within an `org.atsui.Stack`.
  - Non-"know" requirements in the block (if any) continue to render as before
    (requirement summary text).

- [ ] **Generator compiles text blocks to HTML/CSS** — The generator outputs
  final HTML and CSS for text blocks, not placeholder scaffolding.
  - The generator runs the same variant → element tree → DOM mapping at
    generation time and serializes the result to HTML strings.
  - Generated CSS includes styles for the Inlay primitive classes.
  - Generated apps have no Inlay runtime dependency — output is plain HTML/CSS.
  - Text blocks with no "know" requirements fall back to the existing placeholder.

## Scope

**In scope:**
- `textVariant` field on Requirement type (for "know" requirements) and
  persistence with migration for existing data
- Host runtime module for primitive → DOM rendering
- Variant-to-element-tree mapping (per requirement)
- Workspace preview using host runtime
- Generator compile-time rendering for text blocks
- CSS for Inlay primitives
- Tests for host runtime and variant mapping

**Out of scope:**
- Template components (Option B — later phase)
- Data-bound components (record fetching, bindings)
- `@inlay/render` package integration
- Component discovery / browsing
- Non-text block types (list, form, detail, etc.)
- Interactive primitives (Tabs, List)
- User-defined custom components

## Files Likely Affected

- `src/types/wizard.ts` — Add `textVariant` field to `Requirement` interface,
  add `TextVariant` type
- `src/app/state/WizardState.ts` — Migration to default `textVariant` on
  existing "know" requirements
- `src/app/views/panels/BlocksPanel.ts` — Store `textVariant` on quick-create,
  render text block preview via host runtime instead of placeholder card
- `src/app/views/panels/RequirementsPanel.ts` — Add `textVariant` selector to
  "know" requirement creation/edit form
- `src/inlay/host-runtime.ts` — New file: primitive NSID → DOM element mapping
- `src/inlay/element.ts` — New file: Inlay element tree data structure and
  helpers for creating element trees
- `src/inlay/text-variants.ts` — New file: textVariant → Inlay element tree
  mapping (per requirement)
- `src/generator/components/Placeholder.ts` — Skip "know" requirements in text
  blocks that have variants (they use the new path)
- `src/generator/views/ViewPage.ts` — Use compiled Inlay output for text blocks
- `src/generator/inlay/compile.ts` — New file: element tree → HTML string
  compilation for generator output
- `styles.css` — Inlay primitive CSS classes

## Inlay.at Primitive Style Reference

These are the actual styles used by inlay.at's host. Our implementation should
match these closely. Source files: `host-primitives.css` (structural) and
`host-theme.css` (visual) in the inlay.at repo.

### Root Defaults

```css
font-family: system-ui, sans-serif;
font-size: 15px;
line-height: 1.5;
-webkit-font-smoothing: antialiased;
```

Color tokens:
```css
--text-primary: #111;
--text-body: #444;
--text-secondary: #999;
```

### Gap Values (Stack, Row)

| Prop value | CSS |
|-----------|-----|
| `"none"` | `gap: 0` |
| `"small"` | `gap: 6px` |
| `"medium"` (default) | `gap: 12px` |
| `"large"` | `gap: 24px` |

### Primitives

**Stack** (`org.atsui.Stack`) — HTML: `<org-atsui-stack>` (custom element)
```css
/* Structural */
display: flex;
flex-direction: column;
width: 100%;
box-sizing: border-box;
/* Props → attributes: gap, align (align-items), justify, inset (padding: 12px),
   sticky (position: sticky; top: 0), separator (<hr> between children) */
```

**Row** (`org.atsui.Row`) — HTML: `<org-atsui-row>`
```css
display: flex;
flex-direction: row;
flex-wrap: nowrap;
align-items: center;  /* default align is center, not stretch */
```

**Title** (`org.atsui.Title`) — HTML: `<org-atsui-title>`
```css
display: block;
overflow-wrap: break-word;
font-size: 1.5rem;         /* 22.5px at base 15px */
font-weight: 700;
line-height: 1.2;
letter-spacing: -0.02em;
color: var(--text-primary); /* #111 */
```

**Heading** (`org.atsui.Heading`) — HTML: `<org-atsui-heading>`
```css
display: block;
overflow-wrap: break-word;
font-weight: 600;
color: var(--text-primary); /* #111 */
/* Inherits font-size: 15px and line-height: 1.5 from root */
```

**Text** (`org.atsui.Text`) — HTML: `<org-atsui-text>`
```css
display: block;
overflow-wrap: break-word;
color: var(--text-body);    /* #444 */
/* Inherits font-size: 15px, line-height: 1.5, font-weight: 400 */
```

**Caption** (`org.atsui.Caption`) — HTML: `<org-atsui-caption>`
```css
display: block;
overflow-wrap: break-word;
font-size: 0.8125rem;       /* ~12.2px at base 15px */
color: var(--text-secondary); /* #999 */
```

**Fill** (`org.atsui.Fill`) — HTML: `<org-atsui-fill>`
```css
display: flex;
flex-direction: column;
flex: 1;
min-width: 0;
min-height: 0;
```

### Notes

- Primitives render as **custom HTML elements** (e.g., `<org-atsui-stack>`),
  not standard elements like `<div>` or `<h1>`. Props are set as HTML attributes.
- All styling is via CSS selectors on the custom element names — no inline styles.
- Inlay.at separates structural CSS (layout, display) from visual CSS (colors,
  fonts, spacing). We can follow the same pattern or combine them.
- Primitives use `system-ui, sans-serif`, not the host app's custom fonts.

## Behavioral Scenarios

**Scenario: Quick-create a heading block**
- Setup: User has an unassigned "know" requirement with text "Welcome to TaskFlow"
- Action: User clicks "Heading" in the quick-create options next to the
  requirement
- Expected outcome: The requirement's `textVariant` is set to `"heading"`. A new
  text block is created with `blockType: 'text'` and the requirement assigned.
  The workspace preview shows "Welcome to TaskFlow" rendered as a styled heading
  (via `org.atsui.Title`), not as a placeholder box.

**Scenario: Multi-requirement block with mixed variants**
- Setup: User has a text block containing two "know" requirements:
  - req-1: text "Getting Started", textVariant "heading"
  - req-2: text "Here's how to use the app.", textVariant "paragraph"
- Action: Block is displayed in workspace.
- Expected outcome: Preview shows "Getting Started" as a styled heading, then
  "Here's how to use the app." as body text below it. Each renders according to
  its own variant, wrapped together in a Stack.

**Scenario: Change text variant on a requirement**
- Setup: User has a "know" requirement with `textVariant: 'paragraph'` showing
  "About this application" as body text in a text block.
- Action: User edits the requirement and changes the variant to "banner".
- Expected outcome: The workspace preview of the containing text block updates
  to show "About this application" in a prominent banner layout. No page reload.

**Scenario: Generate app with text blocks**
- Setup: User has a view with a text block containing two requirements — a
  heading ("My App") and a paragraph ("Built with AT Protocol.").
- Action: User generates the app.
- Expected outcome: The generated view file contains HTML with Inlay custom
  elements (`<org-atsui-title>`, `<org-atsui-text>`, etc.) with ARIA roles
  for accessibility. No placeholder boxes, no dashed borders. The generated
  `styles.css` includes the primitive styles. No Inlay JavaScript is included
  in the output.

**Scenario: Requirement with text and content fields**
- Setup: User has a "know" requirement with text "Getting Started" and content
  "Follow these steps to set up your first project." and `textVariant: 'section'`
- Action: Requirement is in a text block displayed in workspace.
- Expected outcome: Preview shows "Getting Started" as a section heading
  (`org.atsui.Heading`) with "Follow these steps..." as body text
  (`org.atsui.Text`) below it, wrapped in a Stack.

**Scenario: Text block with no know requirements**
- Setup: User manually creates a text block and assigns only "do" or "navigate"
  requirements to it (unusual but possible).
- Action: Block is displayed in workspace.
- Expected outcome: Falls back to existing placeholder rendering since there's
  no text content to render through Inlay primitives.

**Scenario: Mixed requirement types in a text block**
- Setup: User has a text block with one "know" requirement (textVariant:
  "heading") and one "do" requirement.
- Action: Block is displayed in workspace.
- Expected outcome: The "know" requirement renders via Inlay primitives (as a
  heading). The "do" requirement renders as a summary line (existing behavior).
  Both appear in order within the block.

## How to Verify

1. Create text blocks with each variant (paragraph, heading, section, infoBox,
   banner) and verify the workspace preview shows styled output, not placeholders.
2. Create a text block with multiple "know" requirements using different variants
   and verify each renders according to its own variant.
3. Change a requirement's variant and confirm the block preview updates.
4. Generate an app with text blocks and inspect the output HTML/CSS — verify
   semantic elements, proper classes, no Inlay runtime code, no placeholder boxes.
5. Run `npx vitest run` — host runtime and variant mapping tests pass.
6. Run `npm run build` — TypeScript compiles cleanly.
