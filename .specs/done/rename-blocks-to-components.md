# Spec: Rename Blocks to Components

**Status:** ready
**Date:** 2026-04-09

## What

Rename the "block" concept to "component" throughout the wizard UI, codebase,
types, generator, and tests. This is a behavior-preserving refactor — no
functional changes, just terminology alignment.

## Why

The wizard's target audience is developers, who are familiar with the term
"component" from React, Vue, Angular, Web Components, and design systems. As we
integrate Inlay (which calls its building blocks "components"), maintaining a
separate "block" vocabulary creates unnecessary friction and conceptual mismatch.

This rename is a prerequisite for the Inlay template components spec
(`.specs/active/inlay-template-components.md`), which introduces a model where
everything on a view is a component — most are Inlay components that display a
data type, and a few are special-case components (menu, static content, form).

## Acceptance Criteria

- [ ] **Type definitions renamed** — `Block` → `Component`, `BlockType` →
  `ComponentType`, related fields updated consistently
- [ ] **State and storage renamed** — Wizard state field, persistence keys,
  and any serialized references updated; existing saved state migrates cleanly
- [ ] **Wizard UI renamed** — "Blocks" panel becomes "Components" panel; all
  user-facing labels, headings, button text, placeholder text, and help text
  updated
- [ ] **Generator renamed** — Internal variable names, function names, file
  names, and comments referring to blocks become components; generator output
  behavior unchanged
- [ ] **Tests renamed and passing** — Test files, describe/it labels, and
  fixtures updated; all existing tests still pass
- [ ] **Documentation renamed** — CLAUDE.md, BACKLOG.md, specs in `.specs/done/`
  and `.specs/active/` updated where they reference blocks (for active specs;
  done specs may be left as historical record — TBD)
- [ ] **No behavioral changes** — Wizard flow, generator output, and tests all
  produce the same results as before the rename

## Scope

**In scope:**
- Type renames in `src/types/`
- File renames where appropriate (e.g., `BlocksPanel.ts` → `ComponentsPanel.ts`)
- All UI strings in panels, dialogs, and forms
- Generator internal naming
- Test file and fixture renames
- State persistence migration (if needed for existing saved projects)
- Updating active specs that reference blocks

**Out of scope:**
- Any functional changes to behavior
- Inlay integration work (handled by `inlay-template-components.md`)
- Updating done specs (historical record)
- Renaming `blockType` values themselves (menu, list, etc.) — those become
  `componentType` values with the same names

## Critical Context

**Existing collision:** A stub file `src/app/views/panels/ComponentsPanel.ts`
already exists. It was created during the layout migration as a placeholder for
a separate "components" concept that was never implemented. Its `renderComponentsPanel()`
function returns "Coming soon" content. **This stub should be deleted** as part
of the rename — `BlocksPanel.ts` will be renamed to take its place.

**The sidebar section is already named "components".** Look at
`src/types/wizard.ts:89`:
```typescript
export type SectionName = 'requirements' | 'data' | 'components' | 'views' | 'generate';
```
And `src/app/views/workspace.html` uses `data-section="components"` for the
sidebar section that currently contains the Blocks panel. The section ID was
forward-thinking — it already says "components". What needs to change is the
section title, the panel file, and the underlying data model:
- `src/app/views/WorkspaceLayout.ts:38` currently has:
  `components: { title: 'Blocks', render: renderBlocksPanel }`
- This should become:
  `components: { title: 'Components', render: renderComponentsPanel }`

**State migration is already a familiar pattern.** `WizardState.ts` already has
existing migration code for the `blocks` field at lines 156-158:
```typescript
if (!state.blocks) {
  state.blocks = [];
}
```
The new migration adds: if `state.blocks` exists and `state.components` doesn't,
copy `state.blocks` to `state.components` and delete `state.blocks`. Apply this
in the same loading code path.

**Unrelated `block` references to leave alone:** `src/generator/app/UI.ts:31`
uses `statusEl.style.display = 'block'` — this is the CSS `display: block`
value, completely unrelated to the rename. Grep results will include false
positives for this style.

## Files Likely Affected

### Type definitions and state
- `src/types/wizard.ts` — Lines 98 (`BlockType`), 121-127 (`Block` interface),
  132 (`View.blockIds`), 179 (`WizardState.blocks`). Rename `Block` →
  `Component`, `BlockType` → `ComponentType`, `blockType` → `componentType`,
  `blockIds` → `componentIds`, `blocks` → `components`. Note: `ContentNode`
  types stay as-is (they're content within a component, not a "block content
  node").
- `src/app/state/WizardState.ts` — Initialization and migration. Lines 136
  (`blocks: []`), 156-158 (existing blocks migration), 186-227 (text-block
  contentNodes seeding migration). Add the blocks→components migration.

### UI panels
- `src/app/views/panels/BlocksPanel.ts` → rename to `ComponentsPanel.ts`
  (overwriting the existing stub). Update internal function names
  (`renderBlocksPanel` → `renderComponentsPanel`), all "Block" / "Blocks" UI
  strings, and the `data-section="components"` selectors at lines 1006 and 1043
  (no change needed there since the section is already "components").
- `src/app/views/panels/ComponentsPanel.ts` — **delete the existing stub**;
  the renamed BlocksPanel takes its place.
- `src/app/views/WorkspaceLayout.ts` — Line 38 (section config: title and
  render function), line 303 (comment), import statements. Update `Blocks` →
  `Components` for the section title.
- `src/app/views/workspace.html` — No change needed (already uses
  `data-section="components"`).
- Other panels that reference blocks: `src/app/views/panels/DataPanel.ts`,
  `RequirementsPanel.ts`, `ViewsPanel.ts`, `GeneratePanel.ts`. Likely just
  variable names, comments, or references to the Block type.

### Generator
- `src/generator/views/ViewPage.ts` — The main block rendering loop (lines
  ~58+). Variable names (`block${i}` → `component${i}`), CSS class strings
  (`'block'` → `'app-component'`, `'block-placeholder'` →
  `'app-component-placeholder'`, `'block inlay-root'` →
  `'app-component inlay-root'`), comments (`// Block: ...` → `// Component:
  ...`), iterator variable `b.block` references.
- `src/generator/templates/Styles.ts` — Line 169 (`.block`), line 174
  (`.block-placeholder`), surrounding CSS rules. Rename selectors to
  `.app-component` and `.app-component-placeholder`.
- `src/generator/index.ts` — Top-level generator orchestration; updates to
  pass renamed fields and possibly file naming.
- `src/generator/components/Placeholder.ts` — Generates placeholder HTML for
  unconfigured blocks; references the Block type.
- `src/generator/components/NavMenu.ts`, `src/generator/inlay/compile.ts`,
  `src/generator/app/UI.ts` — Likely contain references to blocks in comments
  or names (verify with grep).
- `src/inlay/text-variants.ts` — May have block references in comments.

### Operations and services
- `src/app/operations/FieldOps.ts`, `ProcedureOps.ts` — Likely reference Block
  type only in passing.
- `src/app/services/PdsSaveController.ts`, `ProjectService.ts` — Handle save/
  load to PDS. Verify they don't have hardcoded "blocks" field references that
  would break the migration.

### Tests
All test files that reference blocks need updating:
- `tests/views/BlocksPanel.test.ts` → rename to `ComponentsPanel.test.ts`
- `tests/views/ViewsPanel.test.ts`
- `tests/views/RequirementsPanel.test.ts`
- `tests/views/GeneratePanel.test.ts`
- `tests/views/resolveNameCollision.test.ts`
- `tests/services/PdsSaveController.test.ts`
- `tests/services/ProjectService.test.ts`
- Add a new test for the blocks→components migration in WizardState

### Documentation
- `CLAUDE.md` — Project structure section if it mentions blocks
- `BACKLOG.md` — Already updated
- Active specs that reference blocks (use grep to find them)
- `.specs/active/inlay-template-components.md` — Already uses component
  terminology consistently with rename in mind

### Deprecated files to leave alone
- `src/app/views/deprecatedStep7Generate.ts` — Deprecated, may reference blocks
  but should be left as-is or deleted in a separate cleanup pass

## Ambiguity Warnings

1. **State migration** — RESOLVED
   One-time migration on load. When loading state from either localStorage or
   the PDS, check for a "blocks" field; if present, rename to "components" in
   memory and write back as "components" on the next save. Migration applies
   to both storage locations. After all existing users have loaded their
   projects once, the old field naturally disappears.

2. **Done specs** — RESOLVED
   Leave done specs as-is. They describe work that was completed under the old
   "blocks" terminology and serve as historical record. Updating them risks
   introducing inaccuracies in spec text that referenced code at the time of
   that work.

3. **Generator output naming** — RESOLVED
   Yes, rename generator output for consistency. The CSS class hook is purely
   presentational (no JavaScript depends on it), so a class name is the right
   approach (not a data attribute). To avoid collisions with generic names and
   the CSS `display: block` value, use `app-component` as the specific name:

   - `.block` → `.app-component` (CSS class on the wrapper `<section>`)
   - `.block-placeholder` → `.app-component-placeholder`
   - Variable name `block${i}` → `component${i}` in generated JS
   - Code comments `// Block: ...` → `// Component: ...`

   Affected files: `src/generator/views/ViewPage.ts`,
   `src/generator/templates/Styles.ts`. Existing generated apps would need
   regeneration to pick up the new class names.

## Implementation Approach

Suggested order to minimize churn and keep the build green:

1. **Type rename first.** Update `src/types/wizard.ts` (Block → Component,
   BlockType → ComponentType, blocks → components, blockIds → componentIds,
   blockType → componentType). The TypeScript compiler will then surface every
   call site that needs updating.
2. **Fix compile errors site by site.** Work through generator, panels,
   operations, services. Don't try to rename UI strings yet — focus on getting
   the build green with the new types.
3. **Add the migration.** Update `WizardState.ts` to migrate `state.blocks` →
   `state.components` on load. Test by hand with a saved state that has the
   old field name.
4. **Rename files.** `BlocksPanel.ts` → `ComponentsPanel.ts` (deleting the
   stub), `BlocksPanel.test.ts` → `ComponentsPanel.test.ts`. Update imports.
5. **Update UI strings.** All user-facing labels from "Block" to "Component".
6. **Update generator output strings.** CSS class names (`block` →
   `app-component`), variable names, comments.
7. **Update tests.** Test names, fixtures, assertions.
8. **Run the full verify suite.**

## How to Verify

1. Run `npm run build` — TypeScript compiles cleanly
2. Run `npx vitest run` — all tests pass (including new migration test)
3. Open the wizard — UI shows "Components" everywhere "Blocks" used to appear;
   sidebar section title is now "Components"
4. **Migration test:** Manually edit localStorage `atproto-wizard-state` to
   have a `blocks` field (rename `components` back to `blocks`), reload —
   the wizard loads the data correctly and on next save the field is back
   to `components`
5. Create a project, add components, save to PDS, reload from PDS — state
   persists correctly via PDS path too
6. Generate an app — output uses new CSS class names (`.app-component`); the
   generated app still functions identically (open the generated app in a
   browser to verify)
7. Grep the codebase for "block" / "Block" / "blocks" / "Blocks" — only
   legitimate uses remain. Expected legitimate uses: `style.display = 'block'`
   in `UI.ts` (CSS value), historical references in `.specs/done/`, possibly
   ContentNode-related text content.
