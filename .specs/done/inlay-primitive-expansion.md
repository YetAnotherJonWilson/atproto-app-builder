# Spec: Inlay Primitive Expansion

**Status:** ready
**Date:** 2026-04-12 (target set locked)

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

Locked by surveying danabra.mov's 10 template components (the
discovery spec's first author). Already supported from Option A:
Stack, Row, Title, Heading, Text, Caption, Fill.

**Starting cluster (this spec):** NowPlaying, Post, AviHandle,
ProfileHeader. These four share primitives heavily and together
require exactly four new primitives:

- **Avatar** — used by AviHandle, ProfileHeader
- **Cover** — used by ProfileHeader
- **Link** — used by Post, AviHandle
- **Maybe** — used by Post, AviHandle, ProfileHeader

NowPlaying needs zero new primitives (Caption only) and acts as a
smoke test that lets the integration spec land before any primitive
work ships. The cluster deliberately avoids interactive/complex
primitives so the pipeline can be proven before scope grows.

**Deferred (next primitive batch, tracked under this spec's
follow-ups):** Timestamp (Repost, Connection); List, Grid, Tabs,
Loading (Profile, ProfilePosts/Replies/Plays/Media). Tabs and List
pull in real client-side behavior that is explicitly out of scope
below, so that cluster waits until we're ready to tackle
interactivity.

Unimplemented primitives render a visible fallback, so additional
components can be attached iteratively without blocking on full
primitive coverage.

## Acceptance Criteria

- [ ] **`src/inlay/element.ts` NSID constants** — extended to include
  each primitive implemented in this spec. `KNOWN_PRIMITIVES` in
  `host-runtime.ts` is derived from `NSID` via `Object.values`, so
  adding an entry here automatically registers the primitive with the
  runtime — no separate update needed.

- [ ] **`src/inlay/host-runtime.ts`** — extended:
  - `ARIA_ROLES` updated where relevant
  - `ATTRIBUTE_PROPS` updated for any new prop shapes
  - Special-case rendering implemented for each primitive that
    needs more than a generic tag + children:
    - **Avatar** — renders an `<img>` inside the custom element;
      accepts a `src` prop (static URL in tests; the integration
      spec owns blob-ref → URL translation). `alt` is a
      pass-through prop.
    - **Cover** — same shape as Avatar (banner-sized image);
      separate primitive because styling and aspect ratio differ.
    - **Link** — wraps children in an `<a href>`. External links
      (absolute URLs) get `target="_blank" rel="noopener
      noreferrer"`; non-absolute hrefs are passed through as-is
      (the integration spec decides routing conventions).
    - **Maybe** — conditional wrapper. Renders its `then` child if
      the `when` prop is truthy, otherwise renders the `else`
      child (or nothing if absent). Tests must cover both branches
      and the missing-`else` case. Takes no ARIA role; it
      contributes no element of its own when its branch is empty.

- [ ] **`src/generator/inlay/compile.ts`** — mirrors all host-runtime
  extensions so compile-time output matches runtime DOM. Any
  divergence is either intentional (and documented) or a bug.

- [ ] **CSS for new primitives** — rules added to
  `styles/inlay-primitives.css` (the single source of truth;
  `src/generator/templates/Styles.ts` inlines this file at build
  time via Vite `?raw` import, so no generator-side CSS edits are
  needed).

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
- `styles/inlay-primitives.css` — CSS for new primitives (single
  source, consumed by both wizard and generator)
- `tests/inlay/…` — unit tests per primitive

## Ambiguity Warnings

None. Primitive CSS has a single source of truth at
`styles/inlay-primitives.css`; `src/generator/templates/Styles.ts`
inlines it via Vite `?raw` import. New primitive CSS is added to that
one file and automatically flows to both wizard and generated-app
output.

## How to Verify

- `npx vitest run tests/inlay/` — all primitive unit tests pass
- `npm run build` — TypeScript compiles
- Small in-wizard harness renders an `InlayElement` tree using each
  new primitive; result matches expectation visually
