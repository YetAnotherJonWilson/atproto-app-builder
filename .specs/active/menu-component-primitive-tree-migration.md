# Spec: Menu Component Primitive-Tree Migration

**Status:** draft (stub — full detail deferred until we start this work)
**Date:** 2026-04-11

## What

Rewrite the `menu` component's rendering path to use the Inlay primitive-
tree pipeline (compile-time resolution via
`src/generator/inlay/compile.ts`, runtime via
`src/inlay/host-runtime.ts`), replacing the current hand-built NavMenu code
in the generator templates.

## Why

The `menu` component is the last wizard component type that doesn't flow
through the primitive-tree pipeline. It was implemented before the
primitive-tree model emerged, so its rendering is parallel to the Inlay
path: hand-maintained TypeScript that produces `<nav>` + `<a>` markup
directly.

Keeping it outside the pipeline has two costs:
1. **Architectural inconsistency** — every other requirement path routes
   through the primitive-tree pipeline once
   `inlay-template-components.md` and `wizard-built-primitive-trees.md` are
   done. Menu would be the only exception.
2. **Duplicate styling and markup logic** — hand-built NavMenu has its own
   CSS and DOM structure; primitives already have their own. Two systems
   to maintain where one would do.

Migration is deferred (not done inside the template spec) because it's not
blocking: the current menu works fine, and changing it has its own
verification burden. Scoping it separately keeps the change independently
testable.

## Prerequisite

- `inlay-template-components.md` — primitive set must include what a menu
  needs (Stack or Row, Link, Text).
- Ideally `wizard-built-primitive-trees.md` lands first — its Link-based
  navigate path is a near-direct template for this work.

## Scope

**In scope:**
- A wizard-built primitive tree builder for `menu` components (reading
  from the associated `navigate` + `navType: 'menu'` requirement)
- Generator changes in `src/generator/views/ViewPage.ts` — remove the menu
  branch that imports NavMenu; replace with compile-pipeline output from
  the builder
- Deletion of the NavMenu generator template file and its generated-app
  counterpart
- CSS cleanup: remove NavMenu-specific styles from the generated-app
  stylesheet if no longer referenced

**Out of scope:**
- Changing menu UX in the wizard (users still pick menu items the same
  way)
- New menu features (hierarchical menus, icons, etc.)
- Other navigate types (covered by `wizard-built-primitive-trees.md`)

## Ambiguity Warnings

1. **Menu styling parity** — Current NavMenu has specific styling.
   Primitives have their own conventions. Is it OK if the migrated menu
   looks different (still usable, still on-brand), or should we match
   current appearance exactly?
2. **Dynamic "all views" menu** — `menuIncludeAllViews: true` means the
   menu regenerates based on the current view list. The primitive tree is
   built at generation time, so "all views" resolves once, at generation
   time. Matches current behavior (generator already reads views at
   generation time) but worth confirming.

## How to Verify

Full behavioral scenarios and verification steps to be written when this
spec is promoted from stub to ready status.
