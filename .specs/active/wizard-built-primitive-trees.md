# Spec: Wizard-Built Primitive Trees for Non-Template Requirements

**Status:** draft (stub — full detail deferred until we start this work)
**Date:** 2026-04-11

## What

Extend the Inlay primitive-tree rendering pipeline to cover requirement
types that don't map to community-authored Inlay template components. The
wizard constructs the primitive tree directly in code (as opposed to
resolving it from an external template), and the tree flows through the
same compile and runtime pipeline as template-sourced trees.

This covers:
- `navigate` requirements with `navType: 'direct'` — a Link-primitive tree
- `navigate` requirements with `navType: 'forward-back'` — a Row of
  button/link primitives wired to page-order navigation
- `do` requirements with only a non-data `elementId` — a placeholder widget
  primitive tree (exact shape TBD; depends on non-data element catalog)

## Why

The architectural goal is that **every wizard component is a primitive
tree**, regardless of where the tree comes from. The
`inlay-template-components.md` spec implements one source of trees
(community Inlay templates), but only the `do` + dataTypeId requirement
path maps to templates. Other requirements currently generate nothing
(direct links, forward/back, non-data widgets) or are rendered by a
parallel hand-built path (menu — see
`menu-component-primitive-tree-migration.md`).

This spec closes the coverage gap so every requirement has a primitive-
tree rendering path, and generalizes the approach `know` requirements
already use via `src/inlay/text-variants.ts`.

## Prerequisite

`inlay-template-components.md` — assumes the primitive set has been
expanded to cover at least Stack, Row, Link, Text, and whatever the
navigate/non-data paths need. Adding primitives stays in the template spec
where the first consumers motivate them; this spec reuses whatever exists.

## Scope

**In scope:**
- Builder functions in `src/inlay/` that construct primitive trees from
  navigate-direct, navigate-forward-back, and do+elementId requirement
  shapes
- Generator integration in `src/generator/views/ViewPage.ts` — new branches
  that call the builders and compile their output, alongside the existing
  text and template branches
- Any new primitives needed specifically for these paths — coordinate with
  the template spec to avoid duplicate work

**Out of scope:**
- Data-bound templates (covered by `inlay-template-components.md`)
- Menu component migration (covered by
  `menu-component-primitive-tree-migration.md`)
- User-authored primitive trees (future)
- Actions system for interactive primitives (see
  `docs/inlay-research.md` § "The Mutation / Interactivity Gap")

## Ambiguity Warnings

1. **Non-data element catalog** — What elements exist, and what primitive
   tree does each produce? Depends on what `elementId` can reference; needs
   a pass over the NonDataElement type before full spec.
2. **Interactivity constraints** — Forward-back and direct links need
   click/navigation behavior. Inlay's Link primitive handles basic links,
   but more complex patterns (button-style nav with labels, arrow controls)
   may need host-runtime support that doesn't exist yet.
3. **Tree builder location** — Should builder functions live in
   `src/inlay/` alongside `text-variants.ts`, or in a new
   `src/inlay/builders/` subdirectory? Depends on how many there end up
   being.

## How to Verify

Full behavioral scenarios and verification steps to be written when this
spec is promoted from stub to ready status.
