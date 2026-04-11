# Spec: Inlay Primitive Expansion

**Status:** ready
**Date:** 2026-04-11

## What

Extend the wizard's Inlay primitive support beyond the text-focused
set Option A shipped, adding the layout, media, navigation, and
framework primitives needed to render real community Inlay template
components. Both the wizard's live host runtime
(`src/inlay/host-runtime.ts`) and the generator's compile pipeline
(`src/generator/inlay/compile.ts`) are extended in parallel so their
outputs stay in sync.

## Why

Community Inlay template components (e.g., ProfileHeader, Post)
compose trees like `Stack > Row > Avatar + Stack > Title + Caption`
plus conditionals via `Maybe`. Without these primitives, the wizard
can't preview community components and the generator can't compile
them. This spec does the primitive groundwork so the integration
spec focuses purely on resolution, binding, and wiring.

## Architecture Context

This is primitive infrastructure that benefits all three
primitive-tree sources described in `inlay-template-components.md` §
Architecture Context — community templates, wizard-built trees for
`know`/`navigate`/non-data, and any future user-authored trees. Every
new primitive added here is reusable across sources.

## Prerequisite

None. Can run in parallel with `inlay-component-discovery.md` and
the browser spike.

## Target Set

Driven by what real community components need. ProfileHeader
(danabra.mov) is the first target and exercises: Stack, Row, Avatar,
Title, Caption, Maybe, Text. Stack, Title, Caption, and Text already
exist from Option A, leaving: **Avatar, Row, Maybe** as the minimum
new primitives.

Expand from there to cover additional target components as they're
selected: Blob, Cover, Grid, Clip, Link, Timestamp, Loading,
Fragment. The full set is not required upfront — unimplemented
primitives render a visible fallback, and support grows
iteratively.

## Acceptance Criteria

- [ ] **`src/inlay/element.ts` NSID constants** — extended to include
  each primitive implemented in this spec.

- [ ] **`src/inlay/host-runtime.ts`** — extended:
  - `KNOWN_PRIMITIVES` updated
  - `ARIA_ROLES` updated where relevant
  - `ATTRIBUTE_PROPS` updated for any new prop shapes
  - Special-case rendering implemented where the primitive needs
    more than a generic tag + children (Avatar needs `<img>`; Link
    needs `<a>` wrapper; Maybe's fallback logic; Fragment's no-
    wrapper behavior)

- [ ] **`src/generator/inlay/compile.ts`** — mirrors all host-runtime
  extensions so compile-time output matches runtime DOM. Any
  divergence is either intentional (and documented) or a bug.

- [ ] **CSS for new primitives** — styles added to whichever
  stylesheet hosts current Inlay primitive CSS (wizard and/or
  generated-app), using existing conventions.

- [ ] **Fallback for unimplemented primitives** — when either
  runtime or compile encounters a primitive NSID not in
  `KNOWN_PRIMITIVES`, it renders a visible warning element showing
  the NSID. Standardize across both paths.

- [ ] **Unit tests** — for each new primitive:
  - Host runtime: given an `InlayElement`, assert produced DOM
  - Compile pipeline: given the same input, assert produced HTML
  - Parity: runtime and compile outputs match for the same input

## Scope

**In scope:**
- NSID constant additions
- Runtime + compile extensions for the target primitive set
- CSS for each new primitive
- Unit tests in both runtime and compile paths
- Standardizing the unknown-primitive fallback

**Out of scope:**
- Interactive primitives with real client-side behavior (Tabs, List)
  beyond stub rendering
- Input primitives (blocked on Inlay RFC 028)
- Primitive discovery or dynamic registration — the list is
  hand-maintained
- Template resolution, binding, or codegen — integration spec

## Files Likely Affected

- `src/inlay/element.ts` — NSID constants
- `src/inlay/host-runtime.ts` — runtime rendering
- `src/generator/inlay/compile.ts` — compile-time rendering
- `styles/…` or `src/generator/templates/Styles.ts` — CSS (location
  follows existing patterns)
- `tests/inlay/…` — unit tests per primitive

## Ambiguity Warnings

1. **CSS location** — wizard-side styles live in `styles/`, generated-
   app styles are emitted by `src/generator/templates/Styles.ts`.
   Should new primitive CSS be duplicated in both or extracted?
   Default: follow the convention already used by current Inlay
   primitive CSS.

2. **Target set beyond ProfileHeader** — this spec anchors on
   ProfileHeader as the first concrete target, but the integration
   spec may pick a different first component. Confirm the full
   target set when the integration spec begins and batch additions.

## How to Verify

- `npx vitest run tests/inlay/` — all primitive unit tests pass
- `npm run build` — TypeScript compiles
- Small in-wizard harness renders an `InlayElement` tree using each
  new primitive; result matches expectation visually
